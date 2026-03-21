import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment } from '../firebase';
import { StreamSession } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2 } from 'lucide-react';
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
    </div>
  );

  if (!stream) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-6">
        <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl shadow-[#ff4e00]/5">
          <img
            src={`https://picsum.photos/seed/${stream.id}/1280/720`}
            alt="Stream Preview"
            className="w-full h-full object-cover opacity-80"
            referrerPolicy="no-referrer"
          />
          
          {/* Overlay UI */}
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
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

            <div className="flex items-end justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight drop-shadow-lg">{stream.title}</h1>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ff4e00] p-0.5">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                      alt="avatar"
                      className="w-full h-full rounded-full bg-black"
                    />
                  </div>
                  <span className="font-bold text-sm">{stream.userName}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className={`p-4 rounded-2xl backdrop-blur-md transition-all ${
                    isLiked ? 'bg-red-500 text-white scale-110' : 'bg-black/40 text-white hover:bg-white/10'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                <button className="p-4 rounded-2xl bg-black/40 backdrop-blur-md text-white hover:bg-white/10 transition-colors">
                  <Share2 className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Descripción</h2>
          <p className="text-white/80 leading-relaxed italic">
            {stream.description || 'El streamer no ha proporcionado una descripción para esta transmisión.'}
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="lg:col-span-1 flex flex-col h-[calc(100vh-12rem)]">
        <div className="bg-white/5 border border-white/10 rounded-3xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat en Vivo
            </h3>
            <button onClick={() => speak('Bienvenidos al chat')} className="text-white/20 hover:text-[#ff4e00]">
              <Volume2 className="w-4 h-4" />
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

          <form onSubmit={handleSendMessage} className="p-4 bg-black/20 border-t border-white/10">
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
