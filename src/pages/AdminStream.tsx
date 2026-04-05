import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where, handleFirestoreError, orderBy, limit } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Radio, Image as ImageIcon, Wand2, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../components/Modal';

const AdminStream: React.FC = () => {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Real-time Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploadingChatImage, setIsUploadingChatImage] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
  const guestVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC Broadcaster State
  const peerConnections = useRef<{ [viewerId: string]: RTCPeerConnection }>({});
  const signalingUnsubscribes = useRef<{ [viewerId: string]: (() => void)[] }>({});
  const guestSignalingUnsubscribes = useRef<(() => void)[]>([]);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user) return;
    // ... existing active stream listener ...

    const q = query(
      collection(db, 'streams'),
      where('userId', '==', user.uid),
      where('status', '==', 'live')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const streamDoc = snapshot.docs[0];
        setActiveStream({ id: streamDoc.id, ...streamDoc.data() } as StreamSession);
      } else {
        setActiveStream(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'streams');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeStream) {
      setChatMessages([]);
      return;
    }

    const chatQuery = query(
      collection(db, 'streams', activeStream.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChatMessages(messages);
    }, (error) => {
      console.error('Chat error:', error);
    });

    return () => unsubscribeChat();
  }, [activeStream]);

  useEffect(() => {
    if (!activeStream) return;

    const requestsRef = collection(db, 'streams', activeStream.id, 'joinRequests');
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJoinRequests(requests);
    });

    return () => unsubscribe();
  }, [activeStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    let unsubscribeSignaling: (() => void) | null = null;

    if ((activeStream || isPreviewing) && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { facingMode }, 
        audio: true 
      })
        .then(stream => {
          localStream.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCameraError(null);
          
          if (activeStream) {
            // Listen for new viewers
            const signalingRef = collection(db, 'streams', activeStream.id, 'signaling');
            unsubscribeSignaling = onSnapshot(signalingRef, (snapshot) => {
              snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                  const viewerId = change.doc.id;
                  if (!peerConnections.current[viewerId]) {
                    await createPeerConnection(activeStream.id, viewerId);
                  }
                }
              });
            }, (error) => {
              console.error('Signaling error:', error);
            });
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setCameraError(err.message || 'No se pudo acceder a la cámara');
          setIsPreviewing(false);
        });
    }

    return () => {
      if (unsubscribeSignaling) unsubscribeSignaling();
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      // Close all peer connections and signaling
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      
      Object.values(signalingUnsubscribes.current).forEach(unsubs => unsubs.forEach(unsub => unsub()));
      signalingUnsubscribes.current = {};

      guestSignalingUnsubscribes.current.forEach(unsub => unsub());
      guestSignalingUnsubscribes.current = [];
    };
  }, [activeStream, isPreviewing, facingMode]);

  const createPeerConnection = async (streamId: string, viewerId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peerConnections.current[viewerId] = pc;

    // Add local tracks to the peer connection
    localStream.current?.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current!);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatesRef = collection(db, 'streams', streamId, 'signaling', viewerId, 'adminCandidates');
        addDoc(candidatesRef, event.candidate.toJSON());
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const viewerRef = doc(db, 'streams', streamId, 'signaling', viewerId);
    await updateDoc(viewerRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      },
      status: 'offered'
    });

    const unsubs: (() => void)[] = [];

    // Listen for answer
    const unsubscribeAnswer = onSnapshot(viewerRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.answer && pc.signalingState !== 'stable') {
        const answer = new RTCSessionDescription(data.answer);
        await pc.setRemoteDescription(answer);
      }
    }, (error) => {
      console.error('Answer signaling error:', error);
    });
    unsubs.push(unsubscribeAnswer);

    // Listen for viewer ICE candidates
    const viewerCandidatesRef = collection(db, 'streams', streamId, 'signaling', viewerId, 'viewerCandidates');
    const unsubscribeIce = onSnapshot(viewerCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    }, (error) => {
      console.error('ICE signaling error:', error);
    });
    unsubs.push(unsubscribeIce);

    signalingUnsubscribes.current[viewerId] = unsubs;
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleAcceptJoin = async (requestId: string, guestId: string) => {
    if (!activeStream) return;
    try {
      await updateDoc(doc(db, 'streams', activeStream.id, 'joinRequests', requestId), {
        status: 'accepted'
      });
      // The guest will now initiate a WebRTC connection to send their stream to the admin
      setupGuestReceiver(activeStream.id, guestId);
    } catch (error) {
      console.error('Error accepting join request:', error);
    }
  };

  const setupGuestReceiver = async (streamId: string, guestId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ontrack = (event) => {
      setGuestStream(event.streams[0]);
      if (guestVideoRef.current) {
        guestVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Signaling for guest stream (Admin is the receiver here)
    const guestSignalingRef = doc(db, 'streams', streamId, 'guestSignaling', guestId);
    
    const unsubOffer = onSnapshot(guestSignalingRef, async (snapshot) => {
      const data = snapshot.data();
      if (data?.offer && pc.signalingState === 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(guestSignalingRef, {
          answer: { type: answer.type, sdp: answer.sdp }
        });
      }
    }, (error) => {
      console.error('Guest offer signaling error:', error);
    });
    guestSignalingUnsubscribes.current.push(unsubOffer);

    const guestCandidatesRef = collection(db, 'streams', streamId, 'guestSignaling', guestId, 'guestCandidates');
    const unsubIce = onSnapshot(guestCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    }, (error) => {
      console.error('Guest ICE signaling error:', error);
    });
    guestSignalingUnsubscribes.current.push(unsubIce);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const adminCandidatesRef = collection(db, 'streams', streamId, 'guestSignaling', guestId, 'adminCandidates');
        addDoc(adminCandidatesRef, event.candidate.toJSON());
      }
    };
  };

  const handleStartStream = async () => {
    if (!user || !title) return;
    setLoading(true);
    try {
      const streamData = {
        userId: user.uid,
        userName: user.displayName,
        title,
        description,
        status: 'live',
        startedAt: serverTimestamp(),
        viewerCount: 0,
        likes: 0,
      };
      await addDoc(collection(db, 'streams'), streamData);
      setIsPreviewing(false); // Camera will be handled by activeStream effect
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'streams');
    } finally {
      setLoading(false);
    }
  };

  const handleEndStream = async () => {
    if (!activeStream) return;
    setLoading(true);
    try {
      const streamRef = doc(db, 'streams', activeStream.id);
      await updateDoc(streamRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
      
      // Stop camera
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsPreviewing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `streams/${activeStream.id}`);
    } finally {
      setLoading(false);
    }
  };

  const suggestTitle = async () => {
    setSuggesting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Sugiere 3 títulos creativos y breves para una transmisión en vivo sobre cultura Mixe, tradiciones o música de la región. Devuelve solo los títulos separados por comas.",
      });
      const suggestions = response.text?.split(',') || [];
      if (suggestions.length > 0) {
        setTitle(suggestions[0].trim());
      }
    } catch (error) {
      console.error('Error suggesting title:', error);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeStream) return;
    
    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
        userId: user.uid,
        userName: user.displayName,
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `streams/${activeStream.id}/messages`);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeStream) return;

    setIsUploadingChatImage(true);
    setChatUploadProgress(0);
    try {
      const { storage, ref, uploadBytesResumable, getDownloadURL } = await import('../firebase');
      const storageRef = ref(storage, `chat/${activeStream.id}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setChatUploadProgress(p);
        },
        (error) => {
          console.error('Error uploading chat image:', error);
          setIsUploadingChatImage(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
            userId: user.uid,
            userName: user.displayName,
            imageUrl: url,
            createdAt: serverTimestamp(),
          });
          setIsUploadingChatImage(false);
          setChatUploadProgress(0);
          if (chatImageInputRef.current) chatImageInputRef.current.value = '';
        }
      );
    } catch (error) {
      console.error('Error starting chat image upload:', error);
      setIsUploadingChatImage(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Finalizar Transmisión"
        onConfirm={handleEndStream}
        confirmText="Finalizar"
        confirmVariant="danger"
      >
        <p className="text-white/60 italic"><span>¿Estás seguro de que deseas terminar la transmisión en vivo? Esta acción no se puede deshacer.</span></p>
      </Modal>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
            <Radio className={`w-6 h-6 ${activeStream ? 'text-red-500 animate-pulse' : 'text-[#ff4e00]'}`} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase italic"><span>Panel de Transmisión</span></h1>
        </div>
        {activeStream && (
          <div className="flex items-center gap-4 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-500 text-sm font-bold uppercase tracking-widest"><span>En Vivo</span></span>
            <div className="h-4 w-px bg-red-500/20" />
            <div className="flex items-center gap-2 text-red-500/60 text-xs font-bold">
              <Users className="w-3 h-3" />
              <span>{activeStream.viewerCount}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Preview Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 relative group shadow-2xl shadow-[#ff4e00]/5">
            {activeStream || isPreviewing ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
                
                {guestStream && (
                  <div className="absolute bottom-4 right-4 w-1/3 aspect-video bg-black rounded-2xl overflow-hidden border-2 border-[#ff4e00] shadow-xl z-10">
                    <video
                      ref={guestVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest">
                      <span>Invitado</span>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-6 left-6 flex gap-2">
                  <button 
                    onClick={toggleCamera}
                    className="bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 hover:bg-white/10 transition-all group"
                    title="Cambiar Cámara"
                  >
                    <Sparkles className="w-5 h-5 text-white/60 group-hover:text-[#ff4e00]" />
                  </button>
                  {!activeStream && (
                    <button 
                      onClick={() => setIsPreviewing(false)}
                      className="bg-red-500/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 hover:bg-red-500 transition-all group"
                      title="Apagar Cámara"
                    >
                      <StopCircle className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center p-6">
                    <Video className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-red-500 font-bold mb-2"><span>Error de Cámara</span></p>
                    <p className="text-white/60 text-xs italic"><span>{cameraError}</span></p>
                    <button 
                      onClick={() => {
                        setCameraError(null);
                        setIsPreviewing(true);
                      }}
                      className="mt-4 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                    >
                      <span>Reintentar</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                <Video className="w-16 h-16 mb-4" />
                <p className="font-medium italic mb-4"><span>La cámara está apagada</span></p>
                <button 
                  onClick={() => setIsPreviewing(true)}
                  className="bg-[#ff4e00] text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-[#ff4e00]/90 transition-colors"
                >
                  <span>Encender Cámara</span>
                </button>
              </div>
            )}
            
            {(activeStream || isPreviewing) && (
              <div className="absolute top-6 left-6 flex gap-2">
                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${activeStream ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    <span>{activeStream ? 'REC' : 'VISTA PREVIA'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {activeStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-xl font-bold mb-2"><span>{activeStream.title}</span></h2>
                <p className="text-white/60 text-sm italic"><span>{activeStream.description || 'Sin descripción'}</span></p>
              </div>
              
              {/* Real-time Chat */}
              <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col h-[300px]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
                    <span>Chat en Vivo</span>
                  </h3>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest"><span>En vivo</span></span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="text-xs">
                      <span className={`font-bold mr-2 ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                        <span>{msg.userName}:</span>
                      </span>
                      {msg.imageUrl ? (
                        <div className="mt-1 rounded-lg overflow-hidden border border-white/10 max-w-[150px]">
                          <img src={msg.imageUrl} alt="chat" className="w-full h-auto" />
                        </div>
                      ) : (
                        <span className="text-white/80 italic"><span>{msg.text}</span></span>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 flex gap-2">
                  <input
                    type="file"
                    ref={chatImageInputRef}
                    onChange={handleChatImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    type="button"
                    onClick={() => chatImageInputRef.current?.click()}
                    disabled={isUploadingChatImage}
                    className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-white/40 relative overflow-hidden"
                  >
                    {isUploadingChatImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <div 
                          className="absolute bottom-0 left-0 h-0.5 bg-[#ff4e00] transition-all duration-300"
                          style={{ width: `${chatUploadProgress}%` }}
                        />
                      </>
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff4e00]"
                  />
                  <button type="submit" className="p-2 bg-[#ff4e00] rounded-xl hover:bg-[#ff4e00]/90 transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#ff4e00]/5 to-transparent border border-white/10 rounded-3xl p-8 text-center space-y-4">
              <Radio className="w-12 h-12 text-[#ff4e00]/20 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold uppercase italic tracking-tight"><span>Listo para transmitir</span></h3>
                <p className="text-sm text-white/40 italic"><span>Configura los detalles a la derecha para comenzar tu transmisión en vivo.</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="space-y-6">
          {!activeStream ? (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40"><span>Título del Stream</span></label>
                    <button
                      onClick={suggestTitle}
                      disabled={suggesting}
                      className="text-[#ff4e00] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Sugerir</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none transition-all text-sm"
                    placeholder="Ej: Música Mixe en vivo..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40"><span>Descripción</span></label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none transition-all text-sm min-h-[100px] resize-none"
                    placeholder="¿De qué trata tu transmisión?"
                  />
                </div>
              </div>

              <button
                onClick={handleStartStream}
                disabled={loading || !title}
                className="w-full bg-[#ff4e00] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#ff4e00]/90 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>Iniciar Transmisión</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40"><span>Tiempo Transcurrido</span></p>
                <p className="text-3xl font-mono font-bold tracking-tighter"><span>00:42:15</span></p>
              </div>

              <div className="h-px bg-white/10" />

              <button
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
                className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/90 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <StopCircle className="w-5 h-5" />
                    <span>Finalizar Stream</span>
                  </>
                )}
              </button>
            </div>
          )}

              <div className="bg-gradient-to-br from-[#ff4e00]/20 to-transparent border border-[#ff4e00]/20 rounded-3xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#ff4e00]" />
                  <span>Solicitudes para Unirse</span>
                </h3>
                <div className="space-y-3">
                  {joinRequests.filter(r => r.status === 'pending').length === 0 ? (
                    <p className="text-[10px] text-white/40 italic"><span>No hay solicitudes pendientes</span></p>
                  ) : (
                    joinRequests.filter(r => r.status === 'pending').map(request => (
                      <div key={request.id} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${request.userId}`} alt="avatar" />
                          </div>
                          <span className="text-xs font-bold"><span>{request.userName}</span></span>
                        </div>
                        <button 
                          onClick={() => handleAcceptJoin(request.id, request.userId)}
                          className="bg-[#ff4e00] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-[#ff4e00]/90 transition-colors"
                        >
                          <span>Aceptar</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tips Card */}
          <div className="bg-gradient-to-br from-[#ff4e00]/20 to-transparent border border-[#ff4e00]/20 rounded-3xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff4e00]" />
              <span>Consejo Pro</span>
            </h3>
            <p className="text-xs text-white/60 leading-relaxed italic">
              <span>"Asegúrate de tener buena iluminación y una conexión estable para que tu audiencia disfrute de la cultura Mixe sin interrupciones."</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStream;
