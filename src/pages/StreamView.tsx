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
    const id = Date.now() + Math.random().toString(36).substring(7);
    const x = Math.random() * 100;
    setReactions(prev => [...prev, { id, x } as any]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => (r as any).id !== id));
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
    <div className="min-h-screen bg-[#070504] text-white selection:bg-[#ff4e00]/30 -mx-4 md:-mx-8 lg:-mx-12 -mt-8 overflow-hidden">
      {/* Immersive Background Layers */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-radial from-[#ff4e00]/10 to-transparent blur-[150px] opacity-10" />
        <div className="absolute inset-0 bg-black" />
      </div>

      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Minimalist Header */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/80 backdrop-blur-3xl shrink-0 z-50">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white/50" />
            </motion.button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-1.5 h-1.5 bg-[#ff4e00] rounded-full animate-pulse shadow-[0_0_8px_#ff4e00]" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ff4e00]">EN VIVO</span>
                {stream?.privacy === 'private' && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                    <Lock className="w-2.5 h-2.5 text-yellow-500/70" />
                    <span className="text-[8px] font-bold uppercase text-yellow-500/70">PRIVADO</span>
                  </div>
                )}
              </div>
              <h1 className="text-sm font-bold tracking-tight text-white/90 line-clamp-1">{stream?.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] font-medium text-white/50">
              <Users className="w-3 h-3" />
              <span>{stream?.viewerCount}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleShare}
                className="p-2.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-all"
                title="Compartir"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowStats(!showStats)}
                className={`p-2.5 rounded-full border transition-all ${showStats ? 'bg-[#ff4e00]/20 border-[#ff4e00]/30 text-[#ff4e00]' : 'bg-white/5 border-white/5 text-white/40'}`}
                title="Telemetría"
              >
                <Gauge className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Main Video Stage */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group/player">
            {/* LiveKit Video Container */}
            <div
              ref={videoRef}
              className="w-full h-full flex items-center justify-center bg-black [&>video]:max-w-full [&>video]:max-h-full [&>video]:w-full [&>video]:h-full [&>video]:object-contain"
            />

            {/* Reactions (Hearts) Overlay */}
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              <AnimatePresence>
                {reactions.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, scale: 0.5, y: '100%', x: `${r.x}%` }}
                    animate={{ 
                      opacity: [0, 1, 1, 0], 
                      scale: [0.5, 1.3, 1, 0.7], 
                      y: ['100%', '0%'], 
                      x: [`${r.x}%`, `${r.x + (Math.random() * 40 - 20)}%`] 
                    }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute bottom-0"
                  >
                    <Heart className="w-10 h-10 text-[#ff4e00] fill-current drop-shadow-[0_0_15px_#ff4e00]" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Floating Loading/Error/Ended Overlays */}
            <AnimatePresence>
              {stream?.status === 'ended' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl text-center px-6"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/5">
                    <Video className="w-8 h-8 text-white/20" />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 italic">Transmisión Finalizada</h2>
                  <p className="text-white/40 text-xs mb-10 max-w-xs">Esperamos volver a verte pronto para más cultura Mixe.</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="px-8 py-3.5 bg-[#ff4e00] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-2xl shadow-[#ff4e00]/20"
                  >
                    Volver al Inicio
                  </button>
                </motion.div>
              )}

              {connectionStatus !== 'connected' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90"
                >
                  <div className="w-12 h-12 border-2 border-white/10 rounded-full animate-spin border-t-[#ff4e00]" />
                  <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4e00] animate-pulse">
                    {connectionStatus === 'connecting' ? 'Conectando...' : 'Error de Señal'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Minimal Playback Controls - Appears on Hover */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center opacity-0 group-hover/player:opacity-100 transition-all duration-300 translate-y-4 group-hover/player:translate-y-0">
               <div className="bg-black/80 backdrop-blur-2xl px-6 py-3 rounded-full border border-white/10 flex items-center gap-6 shadow-2xl">
                  <button onClick={togglePlay} className="text-white/80 hover:text-[#ff4e00] transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>

                  <div className="flex items-center gap-3">
                    <button onClick={toggleMute} className="text-white/40 hover:text-white/80 transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-[#ff4e00]" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden relative cursor-pointer group/seek">
                       <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                       />
                       <div className="h-full bg-white/40 group-hover/seek:bg-[#ff4e00] transition-colors" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
                    </div>
                  </div>

                  <div className="h-4 w-px bg-white/10 mx-2" />

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleLike} 
                      className={`flex items-center gap-2 text-[10px] font-black tracking-widest transition-colors ${isLiked ? 'text-[#ff4e00]' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      <span>{stream?.likes || 0}</span>
                    </button>
                    <div className="flex items-center gap-3">
                       <button onClick={togglePiP} className="text-white/30 hover:text-white/60 transition-colors">
                          <PictureInPicture2 className="w-4 h-4" />
                       </button>
                       <button onClick={toggleFullScreen} className="text-white/30 hover:text-white/60 transition-colors">
                          <Maximize className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
               </div>
            </div>

            {/* Click to React Area */}
            <div className="absolute inset-0 cursor-pointer" onClick={handleReaction} />
          </div>

          {/* Interactive Sidebar (Chat & Stream Info) */}
          <aside className="w-full lg:w-[380px] bg-[#0c0a09] border-l border-white/5 flex flex-col h-[40vh] lg:h-full relative z-50">
            {/* Streamer Info Section */}
            <div className="p-5 border-b border-white/5 flex items-center gap-4 bg-white/2">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                {stream?.thumbnailUrl ? (
                  <img src={stream.thumbnailUrl} alt={stream.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/20 font-black">
                    {stream?.userName?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/90">{stream?.userName}</span>
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Anfitrión</span>
              </div>
              {user && user.uid !== stream?.userId && joinStatus === 'none' && (
                <button 
                  onClick={handleRequestJoin}
                  className="ml-auto p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-[#ff4e00]/20 hover:border-[#ff4e00]/30 transition-all group"
                  title="Unirse en Dúo"
                >
                  <UserPlus className="w-4 h-4 text-white/30 group-hover:text-[#ff4e00]" />
                </button>
              )}
            </div>

            {/* Sidebar Tabs */}
            <div className="flex items-center border-b border-white/5 shrink-0 bg-black/20">
               <button className="flex-1 py-3.5 text-[9px] font-black uppercase tracking-[0.2em] border-b-2 border-[#ff4e00] text-white">Chat</button>
               <button className="flex-1 py-3.5 text-[9px] font-black uppercase tracking-[0.2em] border-b-2 border-transparent text-white/20 hover:text-white/40 transition-colors">Vivos</button>
            </div>

            {/* Chat Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
               <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                  {chat.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 pointer-events-none px-10 text-center">
                       <MessageSquare className="w-10 h-10 mb-3" />
                       <p className="text-xs font-medium tracking-tight">Comparte tus pensamientos con el mundo</p>
                    </div>
                  ) : (
                    chat.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex flex-col items-start"
                      >
                         <div className="flex items-center gap-2 mb-1 px-1">
                            <span className={`text-[10px] font-bold ${msg.userId === stream?.userId ? 'text-[#ff4e00]' : 'text-white/40'}`}>
                              {msg.userName}
                            </span>
                         </div>
                         <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl rounded-tl-none text-sm text-white/70 leading-relaxed max-w-[90%]">
                            {msg.text}
                            {msg.imageUrl && (
                              <img src={msg.imageUrl} alt="chat" className="mt-2 rounded-xl w-full h-auto border border-white/10" />
                            )}
                         </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={chatEndRef} />
               </div>

               {/* Modern Chat Input */}
               <div className="p-4 bg-black/40 border-t border-white/5">
                  <form onSubmit={handleSendMessage} className="relative group">
                     <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Mensaje..."
                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-[#ff4e00]/30 placeholder:text-white/10 transition-all pr-24"
                     />
                     <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <button
                           type="button"
                           onClick={() => chatImageInputRef.current?.click()}
                           className="p-2 text-white/20 hover:text-white/50 transition-colors"
                        >
                           <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                           type="submit"
                           disabled={!message.trim()}
                           className="bg-[#ff4e00] text-white p-2 rounded-xl hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100"
                        >
                           <Send className="w-4 h-4" />
                        </button>
                     </div>
                     <input type="file" ref={chatImageInputRef} onChange={handleChatImageUpload} accept="image/*" className="hidden" />
                  </form>
               </div>
            </div>
          </aside>
        </div>
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
