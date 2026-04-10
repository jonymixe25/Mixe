import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2, Play, Pause, Maximize, VolumeX, Settings, Send, Image as ImageIcon, Loader2, Camera, UserPlus, Linkedin, PictureInPicture2, Gauge, Clock, CheckCircle2, Shield, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useAuth } from '../AuthContext';
import { Room, RoomEvent, Track, VideoTrack, AudioTrack } from 'livekit-client';
import { useLiveKitToken } from '../hooks/useLiveKitToken';

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
  const [joinStatus, setJoinStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const videoRef = useRef<HTMLDivElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  
  const [reactions, setReactions] = useState<{ id: number; x: number }[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const { token, error: tokenError } = useLiveKitToken(id || '', user?.uid || '');
  const roomRef = useRef<Room | null>(null);

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

    // LiveKit Setup
    const setupLiveKit = async () => {
      if (!token) return;
      
      const room = new Room();
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
          }

          if (videoRef.current) {
            // Check if element is already a child to avoid duplicates
            if (!videoRef.current.contains(element)) {
              videoRef.current.appendChild(element);
            }
          }
          setConnectionStatus('connected');
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        track.detach().forEach((element) => element.remove());
      });

      try {
        const liveKitUrl = import.meta.env.VITE_LIVEKIT_URL;
        if (!liveKitUrl) {
          throw new Error('VITE_LIVEKIT_URL is not configured');
        }
        await room.connect(liveKitUrl, token);
        console.log('Connected to LiveKit room', room.name);
      } catch (error) {
        console.error('LiveKit connection error:', error);
        setConnectionStatus('failed');
      }
    };

    setupLiveKit();

    return () => {
      unsubscribe();
      unsubscribeChat();
      updateViewerCount(-1);
      roomRef.current?.disconnect();
    };
  }, [id, navigate, token]);

  useEffect(() => {
    // LiveKit setup logic
  }, [id, navigate, token]);

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

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Immersive Stream Container */}
      <div className="relative w-full aspect-video bg-[#0a0502] rounded-[3rem] overflow-hidden shadow-2xl shadow-black/50 group ring-1 ring-white/5">
        {/* Floating Reactions Container */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          <AnimatePresence>
            {reactions.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: '100%', x: `${r.x}%` }}
                animate={{ opacity: 1, y: '-20%', x: `${r.x + (Math.random() * 20 - 10)}%` }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute bottom-0"
              >
                <Heart className="w-8 h-8 text-[#ff4e00] fill-current drop-shadow-[0_0_10px_rgba(255,78,0,0.5)]" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* LiveKit Video Container */}
        <div
          ref={videoRef}
          className="w-full h-full object-cover"
        />

        {/* Connection Status Overlay */}
        {connectionStatus !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0502]/80 backdrop-blur-md z-50">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-[#ff4e00]/10 rounded-full animate-spin border-t-[#ff4e00] shadow-[0_0_20px_rgba(255,78,0,0.2)]" />
              <Radio className="w-8 h-8 text-[#ff4e00] absolute inset-0 m-auto animate-pulse" />
            </div>
            <p className="mt-6 text-white font-black uppercase tracking-[0.3em] text-[10px]">
              <span>{connectionStatus === 'connecting' ? 'Conectando con el anfitrión...' : 'Error de conexión'}</span>
            </p>
            {connectionStatus === 'failed' && (
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 bg-[#ff4e00] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
              >
                <span>Reintentar</span>
              </button>
            )}
          </div>
        )}

        {/* Top Overlay Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 md:p-8 flex items-start justify-between z-30 bg-gradient-to-b from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                <span>Live</span>
              </div>
              <div className="glass px-3 py-1 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-white/10">
                <Users className="w-3 h-3 text-[#ff4e00]" />
                <span>{stream.viewerCount}</span>
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-tighter uppercase italic text-white drop-shadow-lg">
              {stream.title}
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="glass p-3 rounded-2xl hover:bg-red-500 transition-all border-white/10 shadow-xl group active:scale-90"
          >
            <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Chat Overlay (Desktop) */}
        <div className="absolute top-8 right-8 bottom-8 w-80 z-40 hidden lg:flex flex-col glass border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Chat en Vivo</span>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {chat.map((msg) => (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id} 
                className="flex flex-col gap-1"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${msg.userId === stream?.userId ? 'text-[#ff4e00]' : 'text-emerald-400'}`}>
                    {msg.userName}
                  </span>
                  {msg.userId === stream?.userId && (
                    <Shield className="w-3 h-3 text-[#ff4e00]" />
                  )}
                  <span className="text-[8px] text-white/20 uppercase tracking-widest">
                    {msg.createdAt?.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/5">
                  {msg.text && <p className="text-xs text-white/80 leading-relaxed italic">{msg.text}</p>}
                  {msg.imageUrl && (
                    <img 
                      src={msg.imageUrl} 
                      alt="chat" 
                      className="mt-2 rounded-xl w-full object-cover border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-white/5 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe algo..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-xs focus:border-[#ff4e00] outline-none transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReaction}
                  className="p-2 text-white/30 hover:text-red-500 transition-colors"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => chatImageInputRef.current?.click()}
                  className="p-2 text-white/30 hover:text-[#ff4e00] transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  className="p-2 text-[#ff4e00] hover:scale-110 transition-transform"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <input
              type="file"
              ref={chatImageInputRef}
              onChange={handleChatImageUpload}
              className="hidden"
              accept="image/*"
            />
          </form>
        </div>

        {/* Bottom Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-30 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#ff4e00] p-0.5 shadow-xl">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                    alt="avatar"
                    className="w-full h-full rounded-[0.9rem] bg-[#0a0502]"
                  />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-display font-bold uppercase italic tracking-tight">{stream.userName}</p>
                  <p className="text-[8px] font-black uppercase tracking-widest text-[#ff4e00]">Streamer Verificado</p>
                </div>
              </div>
              
              <div className="h-8 w-px bg-white/10 hidden sm:block" />
              
              <div className="flex items-center gap-2">
                <button className="p-2 text-white/60 hover:text-white transition-colors">
                  <Volume2 className="w-5 h-5" />
                </button>
                <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                  <div className="w-2/3 h-full bg-[#ff4e00]" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-500 ${
                  isLiked 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                    : 'glass text-white/60 hover:bg-white/10 border-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>{stream.likes || 0}</span>
              </button>
              <button 
                onClick={handleShare}
                className="glass p-3 rounded-2xl border-white/10 text-white/60 hover:text-white transition-all active:scale-90"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button 
                onClick={togglePiP}
                className="glass p-3 rounded-2xl border-white/10 text-white/60 hover:text-white transition-all active:scale-90"
                title="Picture in Picture"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>
              <button className="glass p-3 rounded-2xl border-white/10 text-white/60 hover:text-white transition-all active:scale-90">
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Info & Chat Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass p-8 rounded-[2.5rem] border-white/10 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 text-[#ff4e00]">
                <Radio className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Descripción</span>
              </div>
              <button 
                onClick={generateSummary}
                disabled={isSummarizing || !stream?.description}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-[#ff4e00] transition-colors disabled:opacity-50"
              >
                {isSummarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>Resumen IA</span>
              </button>
            </div>
            
            <AnimatePresence>
              {summary && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 p-4 bg-[#ff4e00]/5 border border-[#ff4e00]/20 rounded-2xl italic text-sm text-white/80"
                >
                  <p>{summary}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-white/70 text-lg leading-relaxed italic font-medium">
              {stream.description || 'Sin descripción disponible.'}
            </p>
          </div>
        </div>

        {/* Mobile Chat (visible only on small screens) */}
        <div className="lg:hidden glass border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl flex flex-col h-[400px]">
          <div className="p-6 border-b border-white/10 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
            <span className="text-[10px] font-black uppercase tracking-widest">Chat en Vivo</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chat.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <p className="text-[10px] font-black text-[#ff4e00] uppercase tracking-wider">{msg.userName}</p>
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                  <p className="text-xs text-white/80 italic">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe algo..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-xs outline-none"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ff4e00]">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>

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
