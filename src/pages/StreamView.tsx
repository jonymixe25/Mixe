import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment } from '../firebase';
import { StreamSession } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2, Play, Pause, Maximize, VolumeX, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";

const StreamView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stream, setStream] = useState<StreamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<{ user: string, text: string }[]>([]);
  const [message, setMessage] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  
  // Video Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;

    const streamRef = doc(db, 'streams', id);
    const unsubscribe = onSnapshot(streamRef, (doc) => {
      if (doc.exists()) {
        setStream({ id: doc.id, ...doc.data() } as StreamSession);
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    // Increment viewer count
    updateDoc(streamRef, {
      viewerCount: increment(1)
    });

    return () => {
      unsubscribe();
      // Decrement viewer count on leave
      updateDoc(streamRef, {
        viewerCount: increment(-1)
      });
    };
  }, [id, navigate]);

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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMsg = { user: 'Tú', text: message };
    setChat(prev => [...prev, newMsg]);
    setMessage('');

    // Simulate TTS for certain keywords
    if (message.toLowerCase().includes('hola')) {
      speak('¡Hola! Bienvenido a la transmisión.');
    }
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

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
    </div>
  );

  if (!stream) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-4 lg:space-y-6">
        <div 
          className="aspect-video bg-black rounded-2xl lg:rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl shadow-[#ff4e00]/5 group"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Simulated Video Element */}
          <video
            ref={videoRef}
            src="https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            poster={stream.thumbnailUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted={isMuted}
            playsInline
          />
          
          {/* Overlay UI - Top */}
          <div className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Live
              </div>
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold">
                <Users className="w-4 h-4" />
                {stream.viewerCount}
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
                    00:42:15 / LIVE
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
              <h1 className="text-2xl font-bold tracking-tight drop-shadow-lg">{stream.title}</h1>
              <p className="text-xs font-bold text-white/60 uppercase tracking-widest">{stream.userName}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl p-4 lg:p-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-[#ff4e00] p-0.5">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                alt="avatar"
                className="w-full h-full rounded-xl lg:rounded-2xl bg-black"
              />
            </div>
            <div>
              <h2 className="font-bold text-base lg:text-lg">{stream.userName}</h2>
              <p className="text-[10px] lg:text-xs text-white/40 font-bold uppercase tracking-widest">Streamer Mixe</p>
            </div>
          </div>
          <div className="flex w-full sm:w-auto gap-2 lg:gap-3">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 rounded-xl lg:rounded-2xl font-bold transition-all text-sm lg:text-base ${
                isLiked ? 'bg-red-500 text-white scale-105' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <Heart className={`w-4 h-4 lg:w-5 lg:h-5 ${isLiked ? 'fill-current' : ''}`} />
              {isLiked ? '¡Me gusta!' : 'Me gusta'}
            </button>
            <div className="relative">
              <button 
                onClick={handleShare}
                className="p-2.5 lg:p-3 rounded-xl lg:rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                title="Compartir Stream"
              >
                <Share2 className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
              <AnimatePresence>
                {showShareToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full mb-2 right-0 bg-[#ff4e00] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg"
                  >
                    ¡Enlace copiado!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl p-6 lg:p-8">
          <h2 className="text-[10px] lg:text-sm font-bold uppercase tracking-widest text-white/40 mb-3 lg:mb-4">Descripción</h2>
          <p className="text-sm lg:text-base text-white/80 leading-relaxed italic">
            {stream.description || 'El streamer no ha proporcionado una descripción para esta transmisión.'}
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="lg:col-span-1 flex flex-col h-[400px] lg:h-[calc(100vh-12rem)]">
        <div className="bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl flex-1 flex flex-col overflow-hidden shadow-xl">
          <div className="p-3 lg:p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <h3 className="text-[10px] lg:text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
              <MessageSquare className="w-3 h-3 lg:w-4 lg:h-4" />
              Chat en Vivo
            </h3>
            <button onClick={() => speak('Bienvenidos al chat')} className="text-white/20 hover:text-[#ff4e00]">
              <Volume2 className="w-3 h-3 lg:w-4 lg:h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            <div className="text-center py-4">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Comienzo del chat</p>
            </div>
            {chat.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className="space-y-1"
              >
                <span className="text-[10px] font-bold text-[#ff4e00] uppercase tracking-widest">{msg.user}</span>
                <p className="text-sm text-white/80 bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                  {msg.text}
                </p>
              </motion.div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enviar mensaje..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm focus:border-[#ff4e00] outline-none transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#ff4e00] hover:scale-110 transition-transform"
              >
                <Radio className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StreamView;
