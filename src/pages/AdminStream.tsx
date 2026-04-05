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
  const [category, setCategory] = useState('cultura');
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
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let unsubscribeSignaling: (() => void) | null = null;

    if ((activeStream || isPreviewing) && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: facingMode } }, 
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
        category,
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
    <div className="max-w-7xl mx-auto space-y-12 relative">
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

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Radio className={`w-5 h-5 ${activeStream ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Transmisión</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Panel de Control</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Configura y gestiona tu transmisión en vivo para conectar con tu audiencia.</span>
          </p>
        </div>
        
        {activeStream && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-6 glass px-8 py-4 rounded-[2rem] border-[#ff4e00]/20 shadow-2xl shadow-[#ff4e00]/10"
          >
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <span className="text-red-500 text-xs font-black uppercase tracking-[0.2em]"><span>En Vivo</span></span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3 text-white/60">
              <Users className="w-4 h-4 text-[#ff4e00]" />
              <span className="text-lg font-mono font-black">{activeStream.viewerCount}</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Preview Area */}
        <div className="xl:col-span-2 space-y-8">
          <div className="aspect-video bg-[#0a0502] rounded-[3rem] overflow-hidden border border-white/10 relative group shadow-2xl shadow-[#ff4e00]/5 ring-1 ring-white/5">
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
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="absolute bottom-8 right-8 w-1/3 aspect-video bg-[#0a0502] rounded-[2rem] overflow-hidden border-2 border-[#ff4e00] shadow-2xl z-10"
                  >
                    <video
                      ref={guestVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 glass px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest border-white/10">
                      <span>Invitado</span>
                    </div>
                  </motion.div>
                )}

                <div className="absolute bottom-8 left-8 flex gap-3">
                  <button 
                    onClick={toggleCamera}
                    className="glass p-4 rounded-2xl border-white/10 hover:bg-white/10 transition-all group shadow-xl"
                    title="Cambiar Cámara"
                  >
                    <Sparkles className="w-6 h-6 text-white/60 group-hover:text-[#ff4e00] transition-colors" />
                  </button>
                  {!activeStream && (
                    <button 
                      onClick={() => setIsPreviewing(false)}
                      className="bg-red-500/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 hover:bg-red-500 transition-all group shadow-xl"
                      title="Apagar Cámara"
                    >
                      <StopCircle className="w-6 h-6 text-white" />
                    </button>
                  )}
                </div>

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center glass text-center p-10">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                      <Video className="w-10 h-10 text-red-500" />
                    </div>
                    <p className="text-red-500 font-display text-2xl font-black uppercase italic mb-2"><span>Error de Cámara</span></p>
                    <p className="text-white/40 text-sm italic max-w-xs"><span>{cameraError}</span></p>
                    <button 
                      onClick={() => {
                        setCameraError(null);
                        setIsPreviewing(true);
                      }}
                      className="mt-8 bg-white/10 hover:bg-white/20 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                    >
                      <span>Reintentar Conexión</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8">
                  <Video className="w-12 h-12" />
                </div>
                <p className="font-display text-2xl font-black uppercase italic mb-8 tracking-tighter"><span>Cámara Desactivada</span></p>
                <button 
                  onClick={() => setIsPreviewing(true)}
                  className="bg-[#ff4e00] text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
                >
                  <span>Activar Cámara</span>
                </button>
              </div>
            )}
            
            {(activeStream || isPreviewing) && (
              <div className="absolute top-8 left-8 flex gap-3">
                <div className="glass px-5 py-2.5 rounded-2xl border-white/10 flex items-center gap-3 shadow-xl">
                  <div className={`w-2 h-2 rounded-full ${activeStream ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    <span>{activeStream ? 'REC' : 'VISTA PREVIA'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {activeStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass rounded-[2.5rem] p-8 space-y-4 border-white/10 shadow-xl">
                <div className="flex items-center gap-3 text-[#ff4e00]">
                  <Radio className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Información del Stream</span>
                </div>
                <h2 className="text-3xl font-display font-black italic tracking-tight leading-tight"><span>{activeStream.title}</span></h2>
                <p className="text-white/40 text-sm italic leading-relaxed"><span>{activeStream.description || 'Sin descripción proporcionada.'}</span></p>
              </div>
              
              {/* Real-time Chat */}
              <div className="glass rounded-[2.5rem] flex flex-col h-[400px] border-white/10 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-[#ff4e00]" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Chat en Vivo</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">En vivo</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                          {msg.userName}
                        </span>
                      </div>
                      {msg.imageUrl ? (
                        <div className="mt-1 rounded-2xl overflow-hidden border border-white/10 max-w-[200px] shadow-lg">
                          <img src={msg.imageUrl} alt="chat" className="w-full h-auto" />
                        </div>
                      ) : (
                        <div className="bg-white/5 px-4 py-2.5 rounded-2xl rounded-tl-none border border-white/5">
                          <p className="text-sm text-white/80 italic leading-relaxed">{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10 flex gap-3 bg-white/5">
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
                    className="p-3.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all text-white/40 relative overflow-hidden border border-white/10"
                  >
                    {isUploadingChatImage ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-[#ff4e00] transition-all duration-300"
                          style={{ width: `${chatUploadProgress}%` }}
                        />
                      </>
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-[#ff4e00] transition-all placeholder:text-white/20"
                  />
                  <button type="submit" className="p-3.5 bg-[#ff4e00] text-white rounded-2xl hover:bg-[#ff4e00]/90 transition-all shadow-lg shadow-[#ff4e00]/20 active:scale-95">
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="glass rounded-[3rem] p-12 text-center space-y-6 border-white/10 shadow-2xl">
              <div className="w-20 h-20 bg-[#ff4e00]/10 rounded-full flex items-center justify-center mx-auto">
                <Radio className="w-10 h-10 text-[#ff4e00]/40" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-display font-black uppercase italic tracking-tight"><span>Listo para transmitir</span></h3>
                <p className="text-white/40 text-sm italic max-w-md mx-auto"><span>Configura los detalles de tu transmisión en el panel lateral para comenzar a emitir en vivo.</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="space-y-8">
          {!activeStream ? (
            <div className="glass rounded-[2.5rem] p-8 space-y-8 border-white/10 shadow-2xl">
            <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40"><span>Título del Stream</span></label>
                    <button
                      onClick={suggestTitle}
                      disabled={suggesting}
                      className="text-[#ff4e00] text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:underline disabled:opacity-50 transition-all"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Sugerir</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all text-sm font-medium placeholder:text-white/20"
                    placeholder="Ej: Gran Concierto Mixe..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1"><span>Categoría</span></label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all text-sm font-medium"
                  >
                    <option value="cultura">Cultura</option>
                    <option value="musica">Música</option>
                    <option value="tradicion">Tradición</option>
                    <option value="noticias">Noticias</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1"><span>Descripción</span></label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all text-sm font-medium min-h-[120px] resize-none leading-relaxed placeholder:text-white/20"
                    placeholder="Cuéntale a tu audiencia de qué trata tu transmisión..."
                  />
                </div>
              </div>

              <button
                onClick={handleStartStream}
                disabled={loading || !title}
                className="w-full bg-[#ff4e00] text-white font-black uppercase tracking-widest py-5 rounded-2xl flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 disabled:opacity-50 active:scale-95"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    <span>Iniciar Transmisión</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="glass rounded-[2.5rem] p-8 space-y-8 border-white/10 shadow-2xl">
              <div className="text-center space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40"><span>Tiempo Transcurrido</span></p>
                <p className="text-5xl font-mono font-black tracking-tighter text-[#ff4e00]"><span>00:42:15</span></p>
              </div>

              <div className="h-px bg-white/10" />

              <button
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
                className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase tracking-widest py-5 rounded-2xl flex items-center justify-center gap-4 hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                ) : (
                  <>
                    <StopCircle className="w-6 h-6" />
                    <span>Finalizar Stream</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="glass rounded-[2.5rem] p-8 border-[#ff4e00]/20 shadow-2xl shadow-[#ff4e00]/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              <Users className="w-4 h-4 text-[#ff4e00]" />
              <span>Solicitudes para Unirse</span>
            </h3>
            <div className="space-y-4">
              {joinRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="py-8 text-center glass rounded-2xl border-dashed border-white/5">
                  <p className="text-[10px] text-white/20 font-black uppercase tracking-widest italic">Sin solicitudes</p>
                </div>
              ) : (
                joinRequests.filter(r => r.status === 'pending').map(request => (
                  <motion.div 
                    key={request.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between glass p-4 rounded-2xl border-white/10 group hover:bg-white/5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 p-0.5 border border-white/10">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${request.userId}`} 
                          className="w-full h-full rounded-[0.5rem] bg-[#0a0502]" 
                          alt="avatar" 
                        />
                      </div>
                      <span className="text-xs font-bold text-white/80"><span>{request.userName}</span></span>
                    </div>
                    <button 
                      onClick={() => handleAcceptJoin(request.id, request.userId)}
                      className="bg-[#ff4e00] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:bg-[#ff4e00]/90 transition-all shadow-lg shadow-[#ff4e00]/20 active:scale-95"
                    >
                      <span>Aceptar</span>
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="glass rounded-[2.5rem] p-8 border-[#ff4e00]/20 shadow-2xl shadow-[#ff4e00]/5 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ff4e00]/10 rounded-full blur-3xl group-hover:bg-[#ff4e00]/20 transition-all duration-700" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-[#ff4e00]" />
              <span>Consejo Pro</span>
            </h3>
            <p className="text-sm text-white/40 leading-relaxed italic">
              <span>"Asegúrate de tener buena iluminación y una conexión estable para que tu audiencia disfrute de la cultura Mixe sin interrupciones."</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStream;
