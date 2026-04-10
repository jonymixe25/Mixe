import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where, handleFirestoreError, orderBy, limit, deleteDoc, getDocs } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Radio, Image as ImageIcon, Wand2, Send, Loader2, Heart, Clock, Trash2, Shield, Settings, Lock, Globe, Zap, Monitor, UserPlus, Check, X, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Room, RoomEvent, Track, VideoTrack, AudioTrack } from 'livekit-client';
import { useLiveKitToken } from '../hooks/useLiveKitToken';

const AdminStream: React.FC = () => {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('cultura');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [latency, setLatency] = useState<'normal' | 'low'>('normal');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoModerate, setAutoModerate] = useState(true);
  const [moderationSensitivity, setModerationSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const { token, error: tokenError } = useLiveKitToken(activeStream?.id || '', user?.uid || '');

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
        // Sort in memory to avoid index requirement for now, or just pick the first
        // In a real app, we'd use orderBy('startedAt', 'desc') with a composite index
        const streams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession));
        const latestStream = streams.sort((a, b) => {
          const timeA = a.startedAt?.toMillis?.() || 0;
          const timeB = b.startedAt?.toMillis?.() || 0;
          return timeB - timeA;
        })[0];
        
        setActiveStream(latestStream);
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
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setModerationSensitivity(snapshot.data().moderationSensitivity || 'medium');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const setupCamera = async () => {
      if ((activeStream || isPreviewing) && videoRef.current) {
        try {
          // If we already have a stream and it's active, don't restart it unless facingMode changed
          if (localStream.current && localStream.current.active) {
            // Check if facingMode matches
            const videoTrack = localStream.current.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            // This is a rough check as settings.facingMode might not be supported everywhere
            if (settings.facingMode && settings.facingMode !== facingMode) {
              localStream.current.getTracks().forEach(track => track.stop());
            } else {
              if (videoRef.current.srcObject !== localStream.current) {
                videoRef.current.srcObject = localStream.current;
              }
              return;
            }
          }

          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: facingMode } }, 
            audio: true 
          });
          localStream.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraError(null);
        } catch (err) {
          console.error("Error accessing camera:", err);
          setCameraError(err instanceof Error ? err.message : 'Error al acceder a la cámara');
          setIsPreviewing(false);
        }
      } else {
        // Stop camera if not previewing and no active stream
        if (localStream.current) {
          localStream.current.getTracks().forEach(track => track.stop());
          localStream.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };

    setupCamera();
  }, [activeStream, isPreviewing, facingMode]);

  useEffect(() => {
    const connectToLiveKit = async () => {
      if (activeStream && token && localStream.current && !roomRef.current) {
        setConnectionStatus('connecting');
        const room = new Room();
        roomRef.current = room;
        
        try {
          let liveKitUrl = import.meta.env.VITE_LIVEKIT_URL;
          if (!liveKitUrl || liveKitUrl.trim() === '') {
            throw new Error('Falta VITE_LIVEKIT_URL en los Secretos. Ve a Settings > Secrets y agrégala.');
          }

          // Limpieza profunda de la URL
          liveKitUrl = liveKitUrl.trim();
          
          // Si el usuario puso http o https, lo cambiamos a ws o wss
          if (liveKitUrl.startsWith('http')) {
            liveKitUrl = liveKitUrl.replace(/^http/, 'ws');
          }
          
          // Si no tiene protocolo, lo añadimos
          if (!liveKitUrl.startsWith('ws')) {
            // Si la app corre en HTTPS, usamos wss por defecto
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            liveKitUrl = `${protocol}://${liveKitUrl}`;
          }

          console.log('Conectando a LiveKit con URL procesada:', liveKitUrl);
          await room.connect(liveKitUrl, token);
          
          // Publish tracks from the already running localStream
          const videoTrack = localStream.current.getVideoTracks()[0];
          const audioTrack = localStream.current.getAudioTracks()[0];
          
          if (videoTrack) await room.localParticipant.publishTrack(videoTrack);
          if (audioTrack) await room.localParticipant.publishTrack(audioTrack);
          
          setConnectionStatus('connected');
          console.log('Connected and publishing to LiveKit');
        } catch (err) {
          console.error("Error connecting to LiveKit:", err);
          setConnectionStatus('error');
          setToast({
            message: `Error de streaming: ${err instanceof Error ? err.message : 'No se pudo conectar'}`,
            type: 'error',
            isVisible: true
          });
          roomRef.current = null;
        }
      }
    };

    connectToLiveKit();

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionStatus('idle');
    };
  }, [activeStream, token, localStream.current]);

  // Handle track updates when localStream changes (e.g. camera switch)
  useEffect(() => {
    const updateTracks = async () => {
      if (roomRef.current && roomRef.current.state === 'connected' && localStream.current) {
        try {
          // Unpublish old tracks
          const publications = roomRef.current.localParticipant.getTrackPublications();
          for (const pub of Array.from(publications.values())) {
            if (pub.track) {
              await roomRef.current.localParticipant.unpublishTrack(pub.track as any);
            }
          }

          // Publish new tracks
          const videoTrack = localStream.current.getVideoTracks()[0];
          const audioTrack = localStream.current.getAudioTracks()[0];
          
          if (videoTrack) await roomRef.current.localParticipant.publishTrack(videoTrack);
          if (audioTrack) await roomRef.current.localParticipant.publishTrack(audioTrack);
          
          console.log('Tracks updated in LiveKit room');
        } catch (err) {
          console.error("Error updating tracks:", err);
        }
      }
    };

    updateTracks();
  }, [localStream.current]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartStream = async () => {
    if (!user || !title) return;
    setLoading(true);
    try {
      // First, end any existing live streams for this user to avoid conflicts
      const q = query(
        collection(db, 'streams'),
        where('userId', '==', user.uid),
        where('status', '==', 'live')
      );
      const existingStreams = await getDocs(q);
      for (const streamDoc of existingStreams.docs) {
        await updateDoc(doc(db, 'streams', streamDoc.id), {
          status: 'ended',
          endedAt: serverTimestamp()
        });
      }

      const streamData = {
        userId: user.uid,
        userName: user.displayName,
        title,
        description,
        category,
        privacy,
        latency,
        resolution,
        status: 'live',
        startedAt: serverTimestamp(),
        viewerCount: 0,
        likes: 0,
      };
      await addDoc(collection(db, 'streams'), streamData);
      // Don't set isPreviewing(false) immediately to keep camera running
      // The activeStream listener will trigger the UI switch
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'streams');
    } finally {
      // Keep loading true for a moment to allow the listener to catch up
      setTimeout(() => setLoading(false), 1000);
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
      setIsModalOpen(false);
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

  const handleAcceptRequest = async (requestId: string) => {
    if (!activeStream) return;
    try {
      await updateDoc(doc(db, 'streams', activeStream.id, 'joinRequests', requestId), {
        status: 'accepted'
      });
      setToast({ message: 'Solicitud aceptada', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!activeStream) return;
    try {
      await updateDoc(doc(db, 'streams', activeStream.id, 'joinRequests', requestId), {
        status: 'rejected'
      });
      setToast({ message: 'Solicitud rechazada', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeStream) return;
    
    const msgText = newMessage.trim();
    setNewMessage('');

    // Auto-moderation logic with Gemini
    if (autoModerate) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const sensitivityPrompt = 
          moderationSensitivity === 'high' ? 'Sé extremadamente estricto: bloquea cualquier mensaje que pueda ser remotamente ofensivo, spam, o que use lenguaje informal inapropiado.' :
          moderationSensitivity === 'low' ? 'Sé permisivo: bloquea solo insultos graves o spam evidente.' :
          'Bloquea mensajes ofensivos, spam o lenguaje inapropiado para una comunidad cultural.';

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Actúa como moderador de chat. ${sensitivityPrompt} Responde solo con "SI" (si debe ser bloqueado) o "NO" (si es aceptable): "${msgText}"`,
        });
        if (response.text?.trim().toUpperCase() === 'SI') {
          setToast({ message: 'Mensaje bloqueado por moderación automática.', type: 'error', isVisible: true });
          return;
        }
      } catch (error) {
        console.error('Moderation error:', error);
      }
    }

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

  const deleteMessage = async (messageId: string) => {
    if (!activeStream) return;
    try {
      await deleteDoc(doc(db, 'streams', activeStream.id, 'messages', messageId));
      setToast({ message: 'Mensaje eliminado.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `streams/${activeStream.id}/messages/${messageId}`);
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

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Radio className={`w-5 h-5 ${activeStream ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Transmisión</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Panel de Control</span></h1>
          {tokenError && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-xs mt-4">
              <X className="w-4 h-4" />
              <p>Error de Token: {tokenError}</p>
            </div>
          )}
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Configura y gestiona tu transmisión en vivo para conectar con tu audiencia.</span>
          </p>
        </div>
        
        {activeStream && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Likes', value: activeStream.likes || 0, icon: Heart, color: 'text-red-500' },
              { label: 'Espectadores', value: activeStream.viewerCount, icon: Users, color: 'text-[#ff4e00]' },
              { label: 'Mensajes', value: chatMessages.length, icon: MessageSquare, color: 'text-emerald-500' },
              { label: 'Duración', value: '00:42:15', icon: Clock, color: 'text-blue-500' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-4 rounded-2xl border-white/10 flex flex-col items-center justify-center gap-1"
              >
                <stat.icon className={`w-4 h-4 ${stat.color} opacity-60`} />
                <span className="text-xl font-mono font-black">{stat.value}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        )}

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
              <div className="absolute top-8 left-8 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="glass px-5 py-2.5 rounded-2xl border-white/10 flex items-center gap-3 shadow-xl">
                    <div className={`w-2 h-2 rounded-full ${activeStream ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      <span>{activeStream ? 'REC' : 'VISTA PREVIA'}</span>
                    </span>
                  </div>
                  {activeStream && connectionStatus !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`glass px-5 py-2.5 rounded-2xl border-white/10 flex items-center gap-3 shadow-xl ${
                        connectionStatus === 'connected' ? 'text-emerald-500' : 
                        connectionStatus === 'connecting' ? 'text-blue-500' : 
                        'text-red-500'
                      }`}
                    >
                      <Gauge className={`w-3 h-3 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                        {connectionStatus === 'connected' ? 'SEÑAL ESTABLE' : 
                         connectionStatus === 'connecting' ? 'CONECTANDO...' : 
                         'ERROR DE SEÑAL'}
                      </span>
                    </motion.div>
                  )}
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
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Auto-Mod</span>
                    <button 
                      onClick={() => setAutoModerate(!autoModerate)}
                      className={`w-8 h-4 rounded-full transition-colors relative ${autoModerate ? 'bg-[#ff4e00]' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoModerate ? 'left-4.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between group/msg">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                            {msg.userName}
                          </span>
                        </div>
                        <button 
                          onClick={() => deleteMessage(msg.id)}
                          className="opacity-0 group-hover/msg:opacity-100 p-1 hover:text-red-500 transition-all"
                          title="Eliminar mensaje"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1 flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      Privacidad
                    </label>
                    <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                      <button 
                        onClick={() => setPrivacy('public')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${privacy === 'public' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Público
                      </button>
                      <button 
                        onClick={() => setPrivacy('private')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${privacy === 'private' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Privado
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1 flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      Latencia
                    </label>
                    <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                      <button 
                        onClick={() => setLatency('normal')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${latency === 'normal' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Normal
                      </button>
                      <button 
                        onClick={() => setLatency('low')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${latency === 'low' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Baja
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 px-1 flex items-center gap-2">
                    <Monitor className="w-3 h-3" />
                    Resolución Máxima
                  </label>
                  <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
                    <button 
                      onClick={() => setResolution('720p')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${resolution === '720p' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                    >
                      720p (HD)
                    </button>
                    <button 
                      onClick={() => setResolution('1080p')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${resolution === '1080p' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                    >
                      1080p (Full HD)
                    </button>
                  </div>
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
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all"
                        title="Aceptar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(request.id)}
                        className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        title="Rechazar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
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
