import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp, updateDoc, doc, increment, storage, ref, uploadBytesResumable, getDownloadURL } from '../firebase';
import { ShortVideo } from '../types';
import { useAuth } from '../AuthContext';
import { Heart, MessageCircle, Share2, Plus, X, Upload, Loader2, Play, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';

const ShortItem = ({ 
  short, 
  isActive, 
  onLike, 
  onShare 
}: { 
  short: ShortVideo; 
  isActive: boolean;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    let playPromise: Promise<void> | undefined;

    if (isActive && videoRef.current && short.videoUrl) {
      playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Video play error:', error);
          }
        });
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, short.videoUrl]);

  const togglePlay = () => {
    if (videoRef.current && short.videoUrl) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            if (error.name !== 'AbortError') {
              console.error('Video play error:', error.message || error);
            }
          });
        }
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(currentProgress);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    onLike(short.id);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="relative w-full h-full snap-start bg-black flex items-center justify-center overflow-hidden group">
      {short.videoUrl && short.videoUrl.startsWith('http') ? (
        <video
          ref={videoRef}
          src={short.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          muted={isMuted}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            console.error('Video load error for URL:', short.videoUrl);
            setIsPlaying(false);
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white/50">
          <p>Video no disponible</p>
        </div>
      )}
      
      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Play className="w-8 h-8 text-white fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Mute Button */}
      <button 
        onClick={toggleMute}
        className="absolute top-6 right-6 z-30 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Gradient Overlay for Text Readability */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />

      {/* Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 pb-20 md:pb-6 flex items-end justify-between z-20">
        {/* Left: Info */}
        <div className="flex-1 pr-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-white/10">
              <img 
                src={short.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${short.userId}`} 
                alt={short.userName}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-bold text-white text-sm md:text-base drop-shadow-md">@{short.userName}</span>
          </div>
          <p className="text-white/90 text-sm md:text-base line-clamp-3 drop-shadow-md mb-4">
            {short.description}
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col items-center gap-6 pb-4">
          <button onClick={handleLike} className="flex flex-col items-center gap-1 group/btn">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-active/btn:scale-90 transition-transform">
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </div>
            <span className="text-white text-xs font-bold drop-shadow-md">{short.likes + (isLiked ? 1 : 0)}</span>
          </button>

          <button className="flex flex-col items-center gap-1 group/btn">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-active/btn:scale-90 transition-transform">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-bold drop-shadow-md">{short.comments}</span>
          </button>

          <button onClick={() => onShare(short.id)} className="flex flex-col items-center gap-1 group/btn">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-active/btn:scale-90 transition-transform">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-bold drop-shadow-md">{short.shares}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div 
          className="h-full bg-[#ff4e00] transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const Shorts = () => {
  const { user } = useAuth();
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    const fetchShorts = async () => {
      try {
        const q = query(collection(db, 'shorts'), orderBy('createdAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        const fetchedShorts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShortVideo));
        setShorts(fetchedShorts);
      } catch (error) {
        console.error('Error fetching shorts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShorts();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeIndex]);

  const handleLike = async (id: string) => {
    if (!user) {
      setToast({ message: 'Inicia sesión para dar me gusta', type: 'error', isVisible: true });
      return;
    }
    try {
      await updateDoc(doc(db, 'shorts', id), {
        likes: increment(1)
      });
    } catch (error) {
      console.error('Error liking short:', error);
    }
  };

  const handleShare = async (id: string) => {
    const url = `${window.location.origin}/shorts?id=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ message: 'Enlace copiado al portapapeles', type: 'success', isVisible: true });
      await updateDoc(doc(db, 'shorts', id), {
        shares: increment(1)
      });
    } catch (error) {
      console.error('Error sharing short:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadFile || !uploadDescription.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const storageRef = ref(storage, `v-uploads/shorts/${user.uid}/${Date.now()}_${uploadFile.name}`);
      const uploadTask = uploadBytesResumable(storageRef, uploadFile);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading video:', error);
          let message = 'Error al subir el video';
          if (error.code === 'storage/retry-limit-exceeded') {
            message = 'Error de conexión: Se superó el límite de reintentos. Verifica tu conexión.';
          }
          setToast({ message, type: 'error', isVisible: true });
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const newShort = {
            userId: user.uid,
            userName: user.displayName || 'Usuario',
            userPhoto: user.photoURL || '',
            videoUrl: downloadURL,
            description: uploadDescription.trim(),
            likes: 0,
            comments: 0,
            shares: 0,
            createdAt: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, 'shorts'), newShort);
          
          // Add to local state
          setShorts(prev => [{ id: docRef.id, ...newShort, createdAt: new Date() } as ShortVideo, ...prev]);
          
          setIsUploadModalOpen(false);
          setUploadFile(null);
          setUploadDescription('');
          setUploadProgress(0);
          setToast({ message: 'Video publicado exitosamente', type: 'success', isVisible: true });
          setIsUploading(false);
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      setToast({ message: 'Error al iniciar la subida', type: 'error', isVisible: true });
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#ff4e00] animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center pt-20 md:pt-24 pb-0">
      {/* Container for Shorts */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-md h-full md:h-[calc(100vh-8rem)] md:rounded-3xl overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-gray-900 shadow-2xl border-x md:border border-white/10"
      >
        {shorts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/50 space-y-4">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
              <Play className="w-10 h-10" />
            </div>
            <p>No hay videos disponibles</p>
          </div>
        ) : (
          shorts.map((short, index) => (
            <ShortItem 
              key={short.id} 
              short={short} 
              isActive={index === activeIndex} 
              onLike={handleLike}
              onShare={handleShare}
            />
          ))
        )}
      </div>

      {/* Floating Action Button for Upload */}
      {user && (
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="absolute bottom-6 right-6 md:bottom-10 md:right-10 w-14 h-14 bg-[#ff4e00] rounded-full flex items-center justify-center shadow-lg shadow-[#ff4e00]/30 hover:scale-110 active:scale-95 transition-all z-50"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white bg-white/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#ff4e00]/20 rounded-xl flex items-center justify-center text-[#ff4e00]">
                  <Upload className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-white">Publicar Video</h2>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                    Archivo de Video (MP4)
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video bg-black/50 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ff4e00]/50 transition-all group"
                  >
                    {uploadFile ? (
                      <div className="text-center p-4">
                        <Play className="w-8 h-8 text-[#ff4e00] mx-auto mb-2" />
                        <p className="text-white text-sm font-medium truncate max-w-[200px]">{uploadFile.name}</p>
                        <p className="text-white/40 text-[10px] mt-1">{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white/20 group-hover:text-[#ff4e00] transition-colors mb-2" />
                        <p className="text-white/40 text-xs">Haz clic para seleccionar un video</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    accept="video/mp4,video/x-m4v,video/*"
                    className="hidden"
                  />
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
                      <span>Subiendo...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#ff4e00] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-white/40 mb-2">
                    Descripción
                  </label>
                  <textarea
                    required
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Describe tu video..."
                    rows={3}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#ff4e00] transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUploading || !uploadFile || !uploadDescription.trim()}
                  className="w-full bg-[#ff4e00] text-white font-bold py-4 rounded-xl hover:bg-[#ff4e00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Subiendo {Math.round(uploadProgress)}%</span>
                    </>
                  ) : (
                    <span>Publicar Video</span>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default Shorts;
