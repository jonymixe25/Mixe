import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2, Play, Pause, Maximize, VolumeX, Settings, Send, Image as ImageIcon, Loader2, Camera, UserPlus, Linkedin, PictureInPicture2, Gauge, Clock, CheckCircle2, Shield } from 'lucide-react';
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
          videoRef.current?.appendChild(element);
          setConnectionStatus('connected');
        }
      });

      try {
        await room.connect(process.env.LIVEKIT_URL || '', token);
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
      <div className="lg:col-span-3 space-y-8">
        <div 
          className="aspect-video bg-[#0a0502] rounded-[3rem] overflow-hidden border border-white/10 relative shadow-2xl shadow-[#ff4e00]/5 group ring-1 ring-white/5"
        >
          {/* LiveKit Video Container */}
          <div
            ref={videoRef}
            className="w-full h-full object-cover"
          />

          {connectionStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0502]/80 backdrop-blur-md z-20">
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
          
          {/* Overlay UI - Top */}
          <div className="absolute top-0 left-0 right-0 p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-red-600/90 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border border-red-500/20">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <span>Live</span>
              </div>
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-xl">
                <Users className="w-4 h-4 text-[#ff4e00]" />
                <span className="font-mono">{stream.viewerCount}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-black/40 backdrop-blur-md p-3 rounded-2xl hover:bg-red-500 transition-all border border-white/10 shadow-xl group active:scale-90"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 border border-white/10 rounded-[2.5rem] p-8 gap-8 shadow-xl">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-[#ff4e00] p-0.5 shadow-2xl shadow-[#ff4e00]/20">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                alt="avatar"
                className="w-full h-full rounded-[1.4rem] bg-[#0a0502]"
              />
            </div>
            <div className="space-y-1">
              <h2 className="font-display font-black text-2xl uppercase italic tracking-tight"><span>{stream.userName}</span></h2>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#ff4e00]" />
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]"><span>Streamer Mixe • Verificado</span></p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all duration-500 shadow-xl ${
                isLiked 
                  ? 'bg-red-500 text-white scale-105 shadow-red-500/20' 
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="flex items-center gap-2">
                <span>{isLiked ? '¡Me gusta!' : 'Me gusta'}</span>
                <span className="opacity-40 text-xs font-mono"><span>({stream.likes || 0})</span></span>
              </span>
            </button>
            <div className="flex gap-3">
              <button 
                onClick={handleShare}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-xl active:scale-90"
                title="Copiar enlace"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button 
                onClick={shareToLinkedIn}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-[#0077b5] hover:border-[#0077b5] hover:text-white transition-all shadow-xl active:scale-90"
                title="Compartir en LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden group">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#ff4e00]/5 rounded-full blur-[100px] group-hover:bg-[#ff4e00]/10 transition-all duration-1000" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6 flex items-center gap-3">
            <Radio className="w-4 h-4 text-[#ff4e00]" />
            <span>Descripción de la Transmisión</span>
          </h2>
          <p className="text-white/70 text-lg leading-relaxed italic font-medium max-w-4xl">
            <span>{stream.description || 'El streamer no ha proporcionado una descripción para esta transmisión.'}</span>
          </p>
        </div>
      </div>
  );
};

export default StreamView;
