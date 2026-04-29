import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc, where } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Volume2, Play, Pause, Maximize, VolumeX, Settings, Send, Image as ImageIcon, Loader2, Camera, UserPlus, Linkedin, PictureInPicture2, Gauge, Clock, CheckCircle2, Shield, Sparkles, Wand2, Lock, Video, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useAuth } from '../AuthContext';
import { Room, RoomEvent, Track, VideoTrack, AudioTrack } from 'livekit-client';
import { useLiveKitToken } from '../hooks/useLiveKitToken';

import Toast from '../components/Toast';
import Modal from '../components/Modal';

const StreamView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stream, setStream] = useState<StreamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isUploadingChatImage, setIsUploadingChatImage] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [hasVideo, setHasVideo] = useState(false);
  const videoRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  
  const [reactions, setReactions] = useState<{ id: number; x: number }[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [incomingInvitation, setIncomingInvitation] = useState<any>(null);
  const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
  const [moderationSensitivity, setModerationSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [suggestedStreams, setSuggestedStreams] = useState<StreamSession[]>([]);
  const [anonymousId] = useState(() => `anon_${Math.random().toString(36).substring(2, 11)}`);

  // Apply volume to video element
  useEffect(() => {
    if (videoElementRef.current) {
      videoElementRef.current.volume = isMuted ? 0 : volume;
      videoElementRef.current.muted = isMuted;
    }
  }, [volume, isMuted, hasVideo]);

  const toggleMute = () => setIsMuted(!isMuted);

  const acceptInvitation = async () => {
    if (!incomingInvitation || !id) return;
    
    try {
      await updateDoc(doc(db, 'streams', id, 'invitations', incomingInvitation.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });
      
      navigate(`/conference/${incomingInvitation.roomId}`);
    } catch (err) {
      console.error('Error accepting invitation:', err);
    }
  };

  const rejectInvitation = async () => {
    if (!incomingInvitation || !id) return;
    
    try {
      await updateDoc(doc(db, 'streams', id, 'invitations', incomingInvitation.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });
      
      setIsInvitationModalOpen(false);
      setIncomingInvitation(null);
    } catch (err) {
      console.error('Error rejecting invitation:', err);
    }
  };

  const togglePlay = () => {
    if (videoElementRef.current) {
      if (isPlaying) {
        videoElementRef.current.pause();
      } else {
        videoElementRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    }
  };
  const viewerIdentity = user?.uid || anonymousId;
  const { token, url: liveKitUrl, error: tokenError } = useLiveKitToken(id || '', viewerIdentity);
  const roomRef = useRef<Room | null>(null);

  // Connection and token status logging
  useEffect(() => {
    if (tokenError) {
      console.error('LiveKit Token Error:', tokenError);
      setToast({ message: `Error de señal: ${tokenError}`, type: 'error', isVisible: true });
    }
  }, [tokenError]);

  useEffect(() => {
    if (token) {
      console.log('LiveKit Token received for identity:', viewerIdentity);
    }
  }, [token, viewerIdentity]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'streams'),
      where('status', '==', 'live'),
      orderBy('startedAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const streams = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as StreamSession))
        .filter(s => s.id !== id); // Exclude current stream
      setSuggestedStreams(streams);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setModerationSensitivity(snapshot.data().moderationSensitivity || 'medium');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;
    // ... existing stream and chat listeners ...

    const streamRef = doc(db, 'streams', id);
    const unsubscribe = onSnapshot(streamRef, (doc) => {
      if (doc.exists()) {
        setStream({ id: doc.id, ...doc.data() } as StreamSession);
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `streams/${id}`);
    });

    // Chat listener
    const chatQuery = query(
      collection(db, 'streams', id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChat(messages);
    }, (error) => {
      console.error('Chat error:', error);
    });

    // Increment viewer count
    const updateViewerCount = async (val: number) => {
      try {
        await updateDoc(streamRef, {
          viewerCount: increment(val)
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, `streams/${id}`);
        } catch (e) {
          if ((e as any).isQuotaError) throw e;
          console.error('Background update error:', e);
        }
      }
    };

    updateViewerCount(1);

    // Listen for invitations
    let unsubscribeInvitations = () => {};
    if (id && user && viewerIdentity) {
      const q = query(
        collection(db, 'streams', id, 'invitations'),
        where('to', '==', viewerIdentity),
        where('status', '==', 'pending'),
        limit(1)
      );
      
      unsubscribeInvitations = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const invite = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          setIncomingInvitation(invite);
          setIsInvitationModalOpen(true);
        }
      }, (error) => {
        console.error('Invitations listener error:', error);
      });
    }

    let isMounted = true;
    let unsubscribeJoinRequest = () => {};

    if (user) {
      unsubscribeJoinRequest = onSnapshot(doc(db, 'streams', id, 'joinRequests', user.uid), (doc) => {
        if (doc.exists()) {
          setJoinStatus(doc.data().status);
        } else {
          setJoinStatus('none');
        }
      }, (error) => {
        console.error('Join status listener error:', error);
      });
    }

    // LiveKit Setup
    const setupLiveKit = async () => {
      if (!token || !liveKitUrl) return;
      
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: Track, publication: any, participant: any) => {
        if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
          const element = track.attach();
          
          // Ensure video elements have necessary attributes for autoplay
          if (element instanceof HTMLVideoElement) {
            element.playsInline = true;
            element.muted = true; // Often required for autoplay
            element.autoplay = true;
            videoElementRef.current = element;
            if (isMounted) setHasVideo(true);
          }

          if (videoRef.current) {
            // Check if element is already a child to avoid duplicates
            if (!videoRef.current.contains(element)) {
              videoRef.current.appendChild(element);
            }
          }
          if (isMounted) setConnectionStatus('connected');
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        track.detach().forEach((element) => {
          try {
            if (element.parentNode) {
              element.parentNode.removeChild(element);
            }
          } catch (e) {
            console.warn("Error removing track element:", e);
          }
        });
        if (track.kind === Track.Kind.Video) {
          if (isMounted) setHasVideo(false);
          videoElementRef.current = null;
        }
      });

      try {
        await room.connect(liveKitUrl, token);
        if (isMounted) {
          console.log('Connected to LiveKit room', room.name);
          setConnectionStatus('connected');
        }
      } catch (error) {
        if (isMounted) {
          console.error('LiveKit connection error:', error);
          if (error instanceof Error && error.message.includes('Client initiated disconnect')) {
            return;
          }
          setConnectionStatus('failed');
        }
      }
    };

    setupLiveKit();

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeChat();
      unsubscribeJoinRequest();
      updateViewerCount(-1);
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [id, navigate, token, liveKitUrl, user]);

  useEffect(() => {
    if (joinStatus === 'accepted' && roomRef.current) {
      const publishLocalCamera = async () => {
        try {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e) {
            console.warn("Failed to get video, trying audio only", e);
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setToast({ message: 'No se pudo acceder al video, transmitiendo solo audio', type: 'error', isVisible: true });
          }
          
          const videoTrack = stream.getVideoTracks()[0];
          const audioTrack = stream.getAudioTracks()[0];
          
          if (videoTrack) {
            const pub = await roomRef.current!.localParticipant.publishTrack(videoTrack);
            // Attach local video so the guest can see themselves
            const element = pub.track?.attach();
            if (element && element instanceof HTMLVideoElement && videoRef.current) {
              element.playsInline = true;
              element.muted = true;
              element.autoplay = true;
              videoRef.current.appendChild(element);
            }
          }
          if (audioTrack) {
            await roomRef.current!.localParticipant.publishTrack(audioTrack);
          }
          
          setToast({ message: 'Estás transmitiendo en duo', type: 'success', isVisible: true });
        } catch (error) {
          console.error("Error publishing local camera:", error);
          setToast({ message: 'Error al acceder a la cámara', type: 'error', isVisible: true });
        }
      };
      publishLocalCamera();
    }
  }, [joinStatus]);

  const handleRequestJoin = async () => {
    if (!user || !id) return;
    try {
      setJoinStatus('pending');
      await setDoc(doc(db, 'streams', id, 'joinRequests', user.uid), {
        userId: user.uid,
        userName: user.displayName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setToast({ message: 'Solicitud enviada al anfitrión', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error requesting join:', error);
      setJoinStatus('none');
      setToast({ message: 'Error al enviar solicitud', type: 'error', isVisible: true });
    }
  };

  const speak = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !id) return;

    if (!user) {
      setToast({ message: 'Inicia sesión para participar en el chat', type: 'error', isVisible: true });
      return;
    }

    const msgText = message.trim();
    setMessage('');

    // Auto-moderation logic
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

    try {
      await addDoc(collection(db, 'streams', id, 'messages'), {
        userId: user.uid,
        userName: user.displayName,
        text: msgText,
        createdAt: serverTimestamp(),
      });

      // Simulate TTS for certain keywords
      if (msgText.toLowerCase().includes('hola')) {
        speak(`¡Hola ${user.displayName}! Bienvenido a la transmisión.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `streams/${id}/messages`);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    
    if (!user) {
      setToast({ message: 'Inicia sesión para enviar imágenes', type: 'error', isVisible: true });
      return;
    }

    setIsUploadingChatImage(true);
    setChatUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('folder', `chat/${id}`);
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const p = (event.loaded / event.total) * 100;
          setChatUploadProgress(p);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          const url = response.url;
          
          await addDoc(collection(db, 'streams', id, 'messages'), {
            userId: user.uid,
            userName: user.displayName,
            imageUrl: url,
            createdAt: serverTimestamp(),
          });
          
          setIsUploadingChatImage(false);
          setChatUploadProgress(0);
          if (chatImageInputRef.current) chatImageInputRef.current.value = '';
        } else {
          throw new Error('Error en la subida');
        }
      };

      xhr.onerror = () => {
        throw new Error('Error de red');
      };

      xhr.send(formData);
    } catch (error: any) {
      console.error('Error uploading chat image:', error);
      setToast({ message: 'Error al subir la imagen', type: 'error', isVisible: true });
      setIsUploadingChatImage(false);
    }
  };

  const handleLike = async () => {
    if (!id) return;
    if (!user) {
      setToast({
        message: 'Debes iniciar sesión para dar me gusta',
        type: 'error',
        isVisible: true
      });
      return;
    }

    setIsLiked(!isLiked);
    try {
      await updateDoc(doc(db, 'streams', id), {
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      console.error('Error updating likes:', error);
      setIsLiked(isLiked); // Rollback
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setToast({
      message: '¡Enlace copiado al portapapeles!',
      type: 'success',
      isVisible: true
    });
  };

  const shareToLinkedIn = () => {
    const url = window.location.href;
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
  };

  const handleReaction = () => {
    const id = Date.now();
    const x = Math.random() * 100;
    setReactions(prev => [...prev, { id, x }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const togglePiP = async () => {
    try {
      if (videoElementRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoElementRef.current.requestPictureInPicture();
        }
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const toggleFullScreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const generateSummary = async () => {
    if (!stream?.description) return;
    setIsSummarizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Resume de forma muy breve y atractiva esta transmisión sobre cultura Mixe: ${stream.description}`,
      });
      setSummary(response.text || 'No se pudo generar el resumen.');
    } catch (error) {
      console.error('Summary error:', error);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070504] text-white selection:bg-[#ff4e00]/30 -mx-4 md:-mx-8 lg:-mx-12 -mt-8">
      {/* Immersive Background Layers */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-radial from-[#ff4e00]/10 to-transparent blur-[120px] opacity-30 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-radial from-[#3a1510]/40 to-transparent blur-[120px] opacity-50" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row h-screen lg:overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto lg:overflow-hidden">
          {/* Header Bar */}
          <header className="px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent backdrop-blur-md border-b border-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div 
                onClick={() => navigate('/')}
                className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer group"
              >
                <ChevronLeft className="w-5 h-5 text-white/70 group-hover:-translate-x-1 transition-transform" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4e00] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[#ff4e00] rounded-full animate-pulse shadow-[0_0_10px_#ff4e00]" />
                    En Vivo
                  </span>
                  {stream?.privacy === 'private' && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-yellow-500/60 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Privado
                    </span>
                  )}
                </div>
                <h1 className="text-sm font-bold tracking-tight line-clamp-1">{stream?.title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <Users className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[11px] font-mono font-bold">{stream?.viewerCount}</span>
              </div>
              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                title="Compartir"
              >
                <Share2 className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </header>

          {/* Video Player Section */}
          <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group/player shrink-0">
            {/* LiveKit Video Container */}
            <div
              ref={videoRef}
              className="w-full h-full flex items-center justify-center bg-black [&>video]:max-w-full [&>video]:max-h-full [&>video]:w-full [&>video]:h-full [&>video]:object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            />

            {/* Overlays */}
            <AnimatePresence>
              {stream?.status === 'ended' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10">
                    <Video className="w-8 h-8 text-white/20" />
                  </div>
                  <h2 className="text-2xl font-bold uppercase tracking-tighter mb-4 italic">La transmisión ha finalizado</h2>
                  <p className="text-white/40 text-sm mb-10">Gracias por ser parte de esta experiencia cultural.</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="bg-[#ff4e00] text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20"
                  >
                    Volver al Inicio
                  </button>
                </motion.div>
              )}

              {connectionStatus !== 'connected' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl"
                >
                  <div className="relative">
                    <div className="w-24 h-24 border-2 border-[#ff4e00]/20 rounded-full animate-spin border-t-[#ff4e00]" />
                    <Video className="w-8 h-8 text-[#ff4e00] absolute inset-0 m-auto" />
                  </div>
                  <p className="mt-8 text-[11px] font-mono uppercase tracking-[0.4em] text-[#ff4e00] animate-pulse">
                    {connectionStatus === 'connecting' ? 'Sincronizando señal...' : 'Fallo de señal'}
                  </p>
                </motion.div>
              )}

              {connectionStatus === 'connected' && !hasVideo && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md"
                >
                  <Video className="w-12 h-12 text-white/10 animate-pulse mb-6" />
                  <p className="text-[11px] font-mono uppercase tracking-[0.4em] text-white/30 italic">
                    Esperando flujo del anfitrión...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Reactions Overlay */}
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              <AnimatePresence>
                {reactions.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, scale: 0.5, y: '100%', x: `${r.x}%` }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], y: '-20%', x: `${r.x + (Math.random() * 20 - 10)}%` }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.5, ease: "easeOut" }}
                    className="absolute bottom-0"
                  >
                    <Heart className="w-10 h-10 text-[#ff4e00] fill-current drop-shadow-[0_0_20px_#ff4e00]" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent opacity-0 group-hover/player:opacity-100 transition-all duration-300 translate-y-2 group-hover/player:translate-y-0 z-40">
              <div className="flex items-center justify-between max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={toggleMute} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-[#ff4e00]" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300 accent-[#ff4e00] h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setShowStats(!showStats)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors" title="Estadísticas">
                    <Gauge className="w-5 h-5 text-white/60" />
                  </button>
                  <button onClick={togglePiP} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors" title="Picture in Picture">
                    <PictureInPicture2 className="w-5 h-5" />
                  </button>
                  <button onClick={toggleFullScreen} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors" title="Pantalla Completa">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Click to React Area */}
            <div className="absolute inset-0 cursor-pointer" onClick={handleReaction} />
          </main>

          {/* Social Bio Overlay */}
          <div className="p-8 bg-[#0c0807] border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-[#ff4e00] to-orange-400 p-[1px]">
                <div className="w-full h-full rounded-[1.9rem] bg-black flex items-center justify-center overflow-hidden">
                  {stream?.thumbnailUrl ? (
                    <img src={stream.thumbnailUrl} alt={stream.userName} className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream?.userId}`}
                      alt="avatar"
                      className="w-full h-full object-cover opacity-60"
                    />
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-1">{stream?.userName}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#ff4e00] font-black">Anfitrión Mixe</span>
                  <div className="w-1 h-1 bg-white/10 rounded-full" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/30">Cultura y Tradición</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isLiked ? 'bg-[#ff4e00] text-white shadow-lg shadow-[#ff4e00]/20' : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'}`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{stream?.likes || 0}</span>
              </button>
              {user && user.uid !== stream?.userId && joinStatus === 'none' && (
                <button 
                  onClick={handleRequestJoin}
                  className="px-6 py-2.5 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00] hover:text-white transition-all shadow-xl"
                >
                  Unirse en Dúo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Space */}
        <aside className="w-full lg:w-[400px] xl:w-[450px] bg-[#0c0807] border-l border-white/5 flex flex-col h-full shrink-0">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/5 to-transparent">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Chat de la Comunidad</span>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[9px] font-mono uppercase tracking-widest text-green-500/80">Activo</span>
            </div>
          </div>

          {/* Chat Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            {chat.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-20 italic space-y-4">
                <MessageSquare className="w-8 h-8" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-center">Inicia la conversación...</p>
              </div>
            ) : (
              chat.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-4"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-black ${msg.userId === stream?.userId ? 'bg-[#ff4e00] text-white' : 'bg-white/5 text-white/40'}`}>
                    {msg.userName?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${msg.userId === stream?.userId ? 'text-[#ff4e00]' : 'text-white/60'}`}>
                        {msg.userName}
                      </span>
                      {msg.userId === stream?.userId && <Shield className="w-3 h-3 text-[#ff4e00]" />}
                    </div>
                    {msg.text && (
                      <div className="text-sm text-white/80 bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                        {msg.text}
                      </div>
                    )}
                    {msg.imageUrl && (
                      <div className="mt-2 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                        <img src={msg.imageUrl} alt="Chat media" className="w-full h-auto max-h-60 object-cover" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-gradient-to-t from-[#070504] to-transparent">
            {user ? (
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe algo..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-20 text-sm focus:outline-none focus:border-[#ff4e00]/50 transition-all placeholder:text-white/20"
                />
                <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => chatImageInputRef.current?.click()}
                    disabled={isUploadingChatImage}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/5 text-white/30 transition-colors"
                  >
                    {isUploadingChatImage ? <Loader2 className="w-4 h-4 animate-spin text-[#ff4e00]" /> : <ImageIcon className="w-4 h-4" />}
                  </button>
                  <button
                    type="submit"
                    disabled={!message.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#ff4e00] text-white disabled:opacity-30 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <input type="file" ref={chatImageInputRef} onChange={handleChatImageUpload} className="hidden" accept="image/*" />
              </form>
            ) : (
              <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Inicia sesión para participar</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isInvitationModalOpen && incomingInvitation && (
          <Modal isOpen={isInvitationModalOpen} onClose={rejectInvitation} title="Invitación a Dúo">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-[#ff4e00]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#ff4e00]/20">
                <Camera className="w-10 h-10 text-[#ff4e00]" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold tracking-tight">
                  {incomingInvitation.fromName} te invita
                </p>
                <p className="text-sm text-white/40">
                  ¿Quieres unirte a la transmisión en vivo ahora mismo?
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={rejectInvitation} className="flex-1 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all uppercase text-[10px] font-black tracking-widest">
                  Rechazar
                </button>
                <button onClick={acceptInvitation} className="flex-1 px-6 py-3 rounded-2xl bg-[#ff4e00] text-white hover:bg-[#ff4e00]/90 transition-all uppercase text-[10px] font-black tracking-widest shadow-xl shadow-[#ff4e00]/20">
                  Aceptar
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showStats && (
          <Modal isOpen={showStats} onClose={() => setShowStats(false)} title="Telemetría de Señal">
            <div className="space-y-4">
              {[
                { l: 'Banda base', v: stream?.resolution || '720p HD' },
                { l: 'Sincronía', v: stream?.latency || 'Optimizado' },
                { l: 'Audiencia', v: stream?.viewerCount || 0 },
                { l: 'Enlace', v: connectionStatus === 'connected' ? 'En Línea' : 'Estableciendo' }
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                   <span className="text-[10px] font-mono uppercase tracking-widest text-[#ff4e00]">{s.l}</span>
                   <span className="text-sm font-bold">{s.v}</span>
                </div>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => setToast({ ...toast, isVisible: false })} />
    </div>
  );
};

export default StreamView;
