import React, { useState, useEffect, useRef } from 'react';
import { useAuth, handleFirestoreError } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where, setDoc, deleteDoc, getDocs } from '../firebase';
import { StreamSession, OperationType } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Radio, Send, Share2, Mic, MicOff, Camera, CameraOff, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../components/Modal';

const AdminStream: React.FC = () => {
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Real-time Chat
  const [chatMessages, setChatMessages] = useState<{ id: string; userName: string; text: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!activeStream) {
      setChatMessages([]);
      return;
    }

    const messagesRef = collection(db, 'streams', activeStream.id, 'messages');
    const q = query(messagesRef, where('createdAt', '!=', null)); // Simple way to get all for now, ideally order by createdAt
    
    // Note: Firestore requires an index for != null and orderBy if combined with other filters, 
    // but here it's simple. Let's just use onSnapshot on the collection.
    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as { id: string; userName: string; text: string; createdAt: any }[];
      
      // Sort manually to avoid needing a complex index immediately
      setChatMessages(msgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    });

    return () => unsubscribe();
  }, [activeStream?.id]);

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

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => track.enabled = !isMicOn);
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCam = () => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      videoTracks.forEach(track => track.enabled = !isCamOn);
      setIsCamOn(!isCamOn);
    }
  };

  useEffect(() => {
    if (activeStream && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
        .then(s => {
          streamRef.current = s;
          if (videoRef.current) videoRef.current.srcObject = s;
          
          // Setup audio visualization
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(s);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateLevel = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;
              setAudioLevel(average);
              requestAnimationFrame(updateLevel);
            };
            updateLevel();
          } catch (e) {
            console.error("Audio visualizer error:", e);
          }
          
          // Listen for signaling requests from viewers
          const signalingRef = collection(db, 'streams', activeStream.id, 'signaling');
          const unsubscribeSignaling = onSnapshot(signalingRef, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                const viewerId = change.doc.id;
                const data = change.doc.data();
                
                // If it's a new viewer request (no offer yet)
                if (!data.offer && !data.answer) {
                  await handleNewViewer(viewerId);
                }
              } else if (change.type === 'modified') {
                const viewerId = change.doc.id;
                const data = change.doc.data();
                
                if (data.answer && peerConnections.current[viewerId]) {
                  const pc = peerConnections.current[viewerId];
                  if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                  }
                }
                
                if (data.viewerCandidate && peerConnections.current[viewerId]) {
                  const pc = peerConnections.current[viewerId];
                  await pc.addIceCandidate(new RTCIceCandidate(data.viewerCandidate));
                }
              }
            });
          });

          return () => unsubscribeSignaling();
        })
        .catch(err => console.error("Error accessing camera:", err));
    }
  }, [activeStream?.id]);

  const handleNewViewer = async (viewerId: string) => {
    if (!activeStream || !streamRef.current) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections.current[viewerId] = pc;

    // Add local tracks to the peer connection
    streamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current!);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        setDoc(doc(db, 'streams', activeStream.id, 'signaling', viewerId), {
          broadcasterCandidate: event.candidate.toJSON()
        }, { merge: true });
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await setDoc(doc(db, 'streams', activeStream.id, 'signaling', viewerId), {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    }, { merge: true });
  };

  const [showShareToast, setShowShareToast] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/stream/${activeStream?.id}`;
    navigator.clipboard.writeText(url);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 3000);
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
        status: 'live',
        startedAt: serverTimestamp(),
        viewerCount: 0,
      };
      await addDoc(collection(db, 'streams'), streamData);
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
      const docRef = doc(db, 'streams', activeStream.id);
      await updateDoc(docRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
      
      // Stop camera
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      streamRef.current = null;

      // Close all peer connections
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};

      // Clear signaling data
      const signalingRef = collection(db, 'streams', activeStream.id, 'signaling');
      const snapshot = await getDocs(signalingRef);
      snapshot.forEach(async (d) => {
        await deleteDoc(doc(db, 'streams', activeStream.id, 'signaling', d.id));
      });
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
    if (!newMessage.trim() || !activeStream || !user) return;
    
    try {
      await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
        userId: user.uid,
        userName: user.displayName || 'Anónimo',
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
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

            {activeStream && (
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                  <button 
                    onClick={toggleMic}
                    className={`p-3 rounded-xl transition-all ${isMicOn ? 'bg-[#ff4e00] text-white' : 'bg-red-500 text-white'}`}
                  >
                    {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={toggleCam}
                    className={`p-3 rounded-xl transition-all ${isCamOn ? 'bg-[#ff4e00] text-white' : 'bg-red-500 text-white'}`}
                  >
                    {isCamOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  </button>
                  
                  {/* Audio Level Indicator */}
                  <div className="flex items-center gap-1 px-3 h-10 bg-white/5 rounded-xl border border-white/5">
                    {[...Array(8)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-1 rounded-full transition-all duration-75"
                        style={{ 
                          height: `${Math.max(10, Math.min(100, (audioLevel / 100) * (i + 1) * 15))}%`,
                          backgroundColor: i < 5 ? '#ff4e00' : i < 7 ? '#fbbf24' : '#ef4444',
                          opacity: isMicOn ? 1 : 0.2
                        }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                  <Settings2 className="w-4 h-4 text-white/40" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">720p HD</span>
                </div>
              </div>
            )}
          </div>

          {activeStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-xl font-bold mb-2">{activeStream.title}</h2>
                <p className="text-white/60 text-sm italic">{activeStream.description || 'Sin descripción'}</p>
              </div>
              
              {/* Real-time Chat */}
              <div className="bg-white/5 border border-white/10 rounded-3xl flex flex-col h-[300px]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
                    Chat en Vivo
                  </h3>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">{activeStream.viewerCount} Conectados</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="text-xs">
                      <span className="font-bold text-[#ff4e00] mr-2">{msg.userName}:</span>
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

              <div className="flex gap-4">
                <button
                  onClick={handleShare}
                  className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  Compartir
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={loading}
                  className="flex-1 bg-red-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/90 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <StopCircle className="w-5 h-5" />
                      Finalizar
                    </>
                  )}
                </button>
              </div>
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

      {/* Share Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#ff4e00] text-white px-6 py-3 rounded-2xl font-bold shadow-xl flex items-center gap-3"
          >
            <Share2 className="w-5 h-5" />
            ¡Enlace copiado al portapapeles!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminStream;
