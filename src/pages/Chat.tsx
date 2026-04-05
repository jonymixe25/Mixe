import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, handleFirestoreError } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { Send, ArrowLeft, Loader2, User as UserIcon, Image as ImageIcon, Video, Phone, X, Camera, Mic, MicOff, VideoOff, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  createdAt: any;
}

const Chat: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [contact, setContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const signalingUnsubscribes = useRef<(() => void)[]>([]);

  // Generate a consistent chatId for two users
  const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  useEffect(() => {
    if (!user || !contactId) return;

    const fetchContact = async () => {
      try {
        const contactDoc = await getDoc(doc(db, 'users', contactId));
        if (contactDoc.exists()) {
          setContact(contactDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching contact:', error);
      }
    };

    fetchContact();

    const chatId = getChatId(user.uid, contactId);
    
    // Auto-start call if requested via query param
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('startCall') === 'true') {
      startCall();
      // Remove the query param from URL without refreshing
      navigate(location.pathname, { replace: true });
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrivateMessage));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, contactId]);

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    if (!user || !contactId) return;
    const chatId = getChatId(user.uid, contactId);
    
    // Listen for incoming calls
    const callDoc = doc(db, 'calls', chatId);
    const unsubscribeCall = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data) {
        if (data.status === 'calling' && data.callerId !== user.uid) {
          setCallStatus('incoming');
          setIsCalling(true);
        } else if (data.status === 'connected') {
          setCallStatus('connected');
        } else if (data.status === 'ended') {
          endCall(false);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `calls/${chatId}`);
    });

    return () => {
      unsubscribeCall();
      signalingUnsubscribes.current.forEach(unsub => unsub());
      signalingUnsubscribes.current = [];
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user, contactId]);

  const startCall = async () => {
    if (!user || !contactId) return;
    setIsCalling(true);
    setCallStatus('calling');
    const chatId = getChatId(user.uid, contactId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesCol = collection(db, 'calls', chatId, 'callerCandidates');
          addDoc(candidatesCol, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(doc(db, 'calls', chatId), {
        callerId: user.uid,
        receiverId: contactId,
        status: 'calling',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        createdAt: serverTimestamp(),
      });

      // Listen for answer
      const unsubAnswer = onSnapshot(doc(db, 'calls', chatId), async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        }
      }, (error) => {
        console.error('Answer signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubAnswer);

      // Listen for receiver candidates
      const unsubIce = onSnapshot(collection(db, 'calls', chatId, 'receiverCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      }, (error) => {
        console.error('ICE signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubIce);

    } catch (error) {
      console.error('Error starting call:', error);
      endCall();
    }
  };

  const answerCall = async () => {
    if (!user || !contactId) return;
    const chatId = getChatId(user.uid, contactId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesCol = collection(db, 'calls', chatId, 'receiverCandidates');
          addDoc(candidatesCol, event.candidate.toJSON());
        }
      };

      const callDoc = await getDoc(doc(db, 'calls', chatId));
      const callData = callDoc.data();

      if (callData?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(doc(db, 'calls', chatId), {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          status: 'connected',
        });
      }

      // Listen for caller candidates
      const unsubIce = onSnapshot(collection(db, 'calls', chatId, 'callerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      }, (error) => {
        console.error('ICE signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubIce);

    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
  };

  const endCall = async (notify = true) => {
    if (notify && user && contactId) {
      const chatId = getChatId(user.uid, contactId);
      try {
        await updateDoc(doc(db, 'calls', chatId), { status: 'ended' });
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }

    signalingUnsubscribes.current.forEach(unsub => unsub());
    signalingUnsubscribes.current = [];

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setIsCalling(false);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !contactId) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const chatId = getChatId(user.uid, contactId);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName,
        text,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${getChatId(user.uid, contactId)}/messages`);
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-[#ff4e00] animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/contacts')}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 overflow-hidden border border-white/10">
              <img 
                src={contact?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`} 
                alt="avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-bold text-sm lg:text-base"><span>{contact?.displayName || 'Usuario'}</span></h2>
              <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold"><span>En línea</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={startCall}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-[#ff4e00]"
              title="Video Llamada"
            >
              <Video className="w-5 h-5" />
            </button>
            <button 
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40"
              title="Llamada de voz"
            >
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-full h-full max-w-4xl flex flex-col items-center justify-center gap-8">
              {/* Remote Video (Main) */}
              <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
                {callStatus === 'connected' ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <div className="w-24 h-24 rounded-full bg-white/10 overflow-hidden border-4 border-[#ff4e00]/20">
                      <img 
                        src={contact?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-xl font-bold uppercase italic tracking-tight">
                      <span>{callStatus === 'calling' ? 'Llamando...' : 'Llamada Entrante'}</span>
                    </h3>
                    <p className="text-white/40 italic"><span>{contact?.displayName}</span></p>
                  </div>
                )}

                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute bottom-6 right-6 w-1/4 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-[#ff4e00] shadow-2xl z-10">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-6">
                {callStatus === 'incoming' ? (
                  <>
                    <button
                      onClick={answerCall}
                      className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-all transform hover:scale-110 shadow-xl shadow-emerald-500/20"
                    >
                      <Phone className="w-8 h-8 text-white fill-current" />
                    </button>
                    <button
                      onClick={() => endCall()}
                      className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all transform hover:scale-110 shadow-xl shadow-red-500/20"
                    >
                      <X className="w-8 h-8 text-white" />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={toggleMute}
                      className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <button 
                      onClick={toggleVideo}
                      className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                    <button
                      onClick={() => endCall()}
                      className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all transform hover:scale-110 shadow-xl shadow-red-500/20"
                    >
                      <X className="w-8 h-8 text-white" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
            <UserIcon className="w-12 h-12" />
            <p className="text-sm italic"><span>Comienza la conversación con {contact?.displayName}</span></p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-4 rounded-3xl text-sm ${
                msg.senderId === user?.uid 
                  ? 'bg-[#ff4e00] text-white rounded-tr-none' 
                  : 'bg-white/10 text-white/90 rounded-tl-none border border-white/10'
              }`}>
                <p className="italic"><span>{msg.text}</span></p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 lg:p-6 border-t border-white/10 bg-white/5 flex gap-3">
        <button 
          type="button"
          className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white/40"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#ff4e00] transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="p-3 bg-[#ff4e00] text-white rounded-2xl hover:bg-[#ff4e00]/90 transition-all disabled:opacity-50 disabled:scale-95"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};

export default Chat;
