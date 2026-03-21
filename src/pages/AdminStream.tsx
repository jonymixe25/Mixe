import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where } from '../firebase';
import { StreamSession } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Radio, Image as ImageIcon, Wand2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { generateMixeThumbnail } from '../services/imageService';
import Modal from '../components/Modal';

const AdminStream: React.FC = () => {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Simulated Chat
  const [chatMessages, setChatMessages] = useState<{ id: string; user: string; text: string }[]>([
    { id: '1', user: 'Maria G.', text: '¡Qué bonita música!' },
    { id: '2', user: 'Juan P.', text: 'Saludos desde la Sierra Norte' },
    { id: '3', user: 'Elena R.', text: 'Increíble transmisión' },
  ]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!user) return;

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
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (activeStream && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Error accessing camera:", err));
    }
  }, [activeStream]);

  const handleStartStream = async () => {
    if (!user || !title) return;
    setLoading(true);
    try {
      const streamData = {
        userId: user.uid,
        userName: user.displayName,
        title,
        description,
        thumbnailUrl: thumbnailUrl || `https://picsum.photos/seed/${Date.now()}/1280/720`,
        status: 'live',
        startedAt: serverTimestamp(),
        viewerCount: 0,
      };
      await addDoc(collection(db, 'streams'), streamData);
    } catch (error) {
      console.error('Error starting stream:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setGeneratingImg(true);
    const url = await generateMixeThumbnail();
    if (url) {
      setThumbnailUrl(url);
    }
    setGeneratingImg(false);
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
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    } catch (error) {
      console.error('Error ending stream:', error);
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages(prev => [...prev, { id: Date.now().toString(), user: 'Admin', text: newMessage }]);
    setNewMessage('');
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
        <p className="text-white/60 italic">¿Estás seguro de que deseas terminar la transmisión en vivo? Esta acción no se puede deshacer.</p>
      </Modal>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
            <Radio className={`w-6 h-6 ${activeStream ? 'text-red-500 animate-pulse' : 'text-[#ff4e00]'}`} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase italic">Panel de Transmisión</h1>
        </div>
        {activeStream && (
          <div className="flex items-center gap-4 bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-500 text-sm font-bold uppercase tracking-widest">En Vivo</span>
            <div className="h-4 w-px bg-red-500/20" />
            <div className="flex items-center gap-2 text-red-500/60 text-xs font-bold">
              <Users className="w-3 h-3" />
              {activeStream.viewerCount}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Preview Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 relative group shadow-2xl shadow-[#ff4e00]/5">
            {activeStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                <Video className="w-16 h-16 mb-4" />
                <p className="font-medium italic">La cámara está apagada</p>
              </div>
            )}
            
            <div className="absolute top-6 left-6 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">REC</span>
              </div>
            </div>
          </div>

          {activeStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-xl font-bold mb-2">{activeStream.title}</h2>
                <p className="text-white/60 text-sm italic">{activeStream.description || 'Sin descripción'}</p>
              </div>
              
              {/* Simulated Chat */}
              <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col h-[300px]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
                    Chat en Vivo
                  </h3>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">3 Conectados</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="text-xs">
                      <span className="font-bold text-[#ff4e00] mr-2">{msg.user}:</span>
                      <span className="text-white/80 italic">{msg.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 flex gap-2">
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
                <h3 className="text-lg font-bold uppercase italic tracking-tight">Listo para transmitir</h3>
                <p className="text-sm text-white/40 italic">Configura los detalles a la derecha para comenzar tu transmisión en vivo.</p>
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
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">Miniatura del Stream</label>
                    <button
                      onClick={handleGenerateThumbnail}
                      disabled={generatingImg}
                      className="text-[#ff4e00] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Wand2 className="w-3 h-3" />
                      {generatingImg ? 'Generando...' : 'Generar con IA'}
                    </button>
                  </div>
                  <div className="aspect-video bg-white/5 border border-white/10 rounded-2xl overflow-hidden relative group">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Sin miniatura</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-white/40">Título del Stream</label>
                    <button
                      onClick={suggestTitle}
                      disabled={suggesting}
                      className="text-[#ff4e00] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Sparkles className="w-3 h-3" />
                      Sugerir
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
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Descripción</label>
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
                    Iniciar Transmisión
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <div className="text-center space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Tiempo Transcurrido</p>
                <p className="text-3xl font-mono font-bold tracking-tighter">00:42:15</p>
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
                    Finalizar Stream
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tips Card */}
          <div className="bg-gradient-to-br from-[#ff4e00]/20 to-transparent border border-[#ff4e00]/20 rounded-3xl p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ff4e00]" />
              Consejo Pro
            </h3>
            <p className="text-xs text-white/60 leading-relaxed italic">
              "Asegúrate de tener buena iluminación y una conexión estable para que tu audiencia disfrute de la cultura Mixe sin interrupciones."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStream;
