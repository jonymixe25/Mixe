import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2, Play, Pause, Maximize, VolumeX, Settings, Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useAuth } from '../AuthContext';

import Toast from '../components/Toast';

const StreamView: React.FC = () => {
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  
  // Video Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // WebRTC Viewer State
  const pc = useRef<RTCPeerConnection | null>(null);
  const signalingId = user?.uid || Math.random().toString(36).substring(7);

  useEffect(() => {
    if (!id || !user) return;
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

    // WebRTC Viewer Setup
    const setupWebRTC = async () => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pc.current = peerConnection;

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        console.log('Received remote tracks:', event.streams);
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionStatus('connected');
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (peerConnection.connectionState === 'failed') {
          setConnectionStatus('failed');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = collection(db, 'streams', id, 'signaling', signalingId, 'viewerCandidates');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      };

      // Create signaling document
      const viewerRef = doc(db, 'streams', id, 'signaling', signalingId);
      await setDoc(viewerRef, {
        status: 'new',
        createdAt: serverTimestamp()
      });

      // Listen for offer
      const unsubscribeOffer = onSnapshot(viewerRef, async (snapshot) => {
        const data = snapshot.data();
        if (data?.offer && peerConnection.signalingState === 'stable') {
          const offer = new RTCSessionDescription(data.offer);
          await peerConnection.setRemoteDescription(offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await updateDoc(viewerRef, {
            answer: {
              type: answer.type,
              sdp: answer.sdp
            },
            status: 'answered'
          });
        }
      });

      // Listen for admin ICE candidates
      const adminCandidatesRef = collection(db, 'streams', id, 'signaling', signalingId, 'adminCandidates');
      const unsubscribeIce = onSnapshot(adminCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      });

      return () => {
        unsubscribeOffer();
        unsubscribeIce();
        peerConnection.close();
      };
    };

    const cleanupWebRTC = setupWebRTC();

    return () => {
      unsubscribe();
      unsubscribeChat();
      updateViewerCount(-1);
      cleanupWebRTC.then(cleanup => cleanup?.());
    };
  }, [id, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

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
    if (!message.trim() || !user || !id) return;

    const msgText = message.trim();
    setMessage('');

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
    if (!file || !user || !id) return;

    setIsUploadingChatImage(true);
    setChatUploadProgress(0);
    try {
      const { storage, ref, uploadBytesResumable, getDownloadURL } = await import('../firebase');
      const storageRef = ref(storage, `chat/${id}/${Date.now()}_${file.name}`);
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
          await addDoc(collection(db, 'streams', id, 'messages'), {
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

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.parentElement?.requestFullscreen();
      }
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
        <Users className="w-10 h-10 text-white/20" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase italic"><span>Inicia sesión para ver</span></h2>
        <p className="text-white/40 italic"><span>Debes estar registrado para unirte a las transmisiones en vivo.</span></p>
      </div>
    </div>
  );

  if (!stream) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-6">
        <div 
          className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl shadow-[#ff4e00]/5 group"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Real-time WebRTC Video Element */}
          <video
            ref={videoRef}
            poster={stream.thumbnailUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            playsInline
          />

          {connectionStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-[#ff4e00]/20 rounded-full animate-spin border-t-[#ff4e00]" />
                <Radio className="w-6 h-6 text-[#ff4e00] absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="mt-4 text-white font-bold uppercase tracking-widest text-xs">
                <span>{connectionStatus === 'connecting' ? 'Conectando con el anfitrión...' : 'Error de conexión'}</span>
              </p>
              {connectionStatus === 'failed' && (
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 bg-[#ff4e00] px-6 py-2 rounded-full text-xs font-bold hover:bg-[#ff4e00]/90 transition-colors"
                >
                  <span>Reintentar</span>
                </button>
              )}
            </div>
          )}
          
          {/* Overlay UI - Top */}
          <div className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span>Live</span>
              </div>
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold">
                <Users className="w-4 h-4" />
                <span>{stream.viewerCount}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-black/40 backdrop-blur-md p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Overlay UI - Bottom Controls */}
          <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col gap-4">
              {/* Progress Bar (Simulated for Live) */}
              <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-full bg-[#ff4e00] animate-pulse" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button onClick={togglePlay} className="text-white hover:text-[#ff4e00] transition-colors">
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                  </button>
                  
                  <div className="flex items-center gap-3 group/volume">
                    <button onClick={toggleMute} className="text-white hover:text-[#ff4e00] transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-0 group-hover/volume:w-24 transition-all accent-[#ff4e00] h-1"
                    />
                  </div>

                  <div className="text-xs font-bold tracking-widest text-white/60">
                    <span>00:42:15 / LIVE</span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button className="text-white hover:text-[#ff4e00] transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                  <button onClick={toggleFullscreen} className="text-white hover:text-[#ff4e00] transition-colors">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stream Info Overlay (Always visible when controls are hidden) */}
          <div className={`absolute bottom-6 left-6 transition-opacity duration-300 ${!showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight drop-shadow-lg"><span>{stream.title}</span></h1>
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest"><span>{stream.userName}</span></p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff4e00] p-0.5">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                alt="avatar"
                className="w-full h-full rounded-2xl bg-black"
              />
            </div>
            <div>
              <h2 className="font-bold text-lg"><span>{stream.userName}</span></h2>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest"><span>Streamer Mixe</span></p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
                isLiked ? 'bg-red-500 text-white scale-105' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="flex items-center gap-1">
                <span>{isLiked ? '¡Me gusta!' : 'Me gusta'}</span>
                <span className="opacity-50 text-xs"><span>({stream.likes || 0})</span></span>
              </span>
            </button>
            <button 
              onClick={handleShare}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4"><span>Descripción</span></h2>
          <p className="text-white/80 leading-relaxed italic">
            <span>{stream.description || 'El streamer no ha proporcionado una descripción para esta transmisión.'}</span>
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="lg:col-span-1 flex flex-col h-[calc(100vh-12rem)]">
        <div className="bg-white/5 border border-white/10 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span>Chat en Vivo</span>
            </h3>
            <button onClick={() => speak('Bienvenidos al chat')} className="text-white/20 hover:text-[#ff4e00]">
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            <div className="text-center py-4">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold"><span>Comienzo del chat</span></p>
            </div>
            <AnimatePresence initial={false}>
              {chat.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  key={msg.id}
                  className="space-y-1"
                >
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                    <span>{msg.userName}</span>
                  </span>
                  {msg.imageUrl ? (
                    <div className="mt-1 rounded-2xl overflow-hidden border border-white/10 max-w-[200px]">
                      <img src={msg.imageUrl} alt="chat" className="w-full h-auto" />
                    </div>
                  ) : (
                    <p className={`text-sm p-3 rounded-2xl rounded-tl-none border ${msg.userId === user?.uid ? 'bg-emerald-500/10 text-emerald-50 border-emerald-500/20' : 'bg-white/5 text-white/80 border-white/5'}`}>
                      <span>{msg.text}</span>
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-white/10">
            <div className="relative flex gap-2">
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
                className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors text-white/40 relative overflow-hidden"
              >
                {isUploadingChatImage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <div 
                      className="absolute bottom-0 left-0 h-0.5 bg-[#ff4e00] transition-all duration-300"
                      style={{ width: `${chatUploadProgress}%` }}
                    />
                  </>
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enviar mensaje..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm focus:border-[#ff4e00] outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#ff4e00] hover:scale-110 transition-transform disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {/* Toast Notification */}
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default StreamView;
