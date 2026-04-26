import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, orderBy, deleteDoc, doc, handleFirestoreError } from '../firebase';
import { MediaItem, OperationType } from '../types';
import { Image as ImageIcon, Trash2, ExternalLink, Calendar, Folder, Plus, X, Video, Volume2, FileText, Users, Download, Play, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ImageUpload from '../components/ImageUpload';
import Modal from '../components/Modal';

import Toast from '../components/Toast';

const Gallery = () => {
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [uploadFolder, setUploadFolder] = useState('AUTO');
  const [isPublic, setIsPublic] = useState(false);
  const [viewMode, setViewMode] = useState<'private' | 'public'>('private');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const baseQuery = collection(db, 'media');
    let q;

    if (viewMode === 'private') {
      q = query(
        baseQuery,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        baseQuery,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaItem[];
      setMedia(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'media');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, viewMode]);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'media', itemToDelete));
      setToast({
        message: 'Archivo eliminado correctamente',
        type: 'success',
        isVisible: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `media/${itemToDelete}`);
    } finally {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const folders = ['all', ...Array.from(new Set(media.map(item => item.folder || 'General')))];

  const filteredMedia = filter === 'all' 
    ? media 
    : media.filter(item => (item.folder || 'General') === filter);

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <ImageIcon className="w-8 h-8" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (fileType.startsWith('video/')) return <Video className="w-8 h-8" />;
    if (fileType.startsWith('audio/')) return <Volume2 className="w-8 h-8" />;
    if (fileType === 'application/pdf') return <FileText className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-brand">
            <Folder className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Almacenamiento</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic">
            <span>{viewMode === 'private' ? 'Mis Archivos' : 'Galería Pública'}</span>
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <button 
              onClick={() => setViewMode('private')}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'private' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              Privado
            </button>
            <button 
              onClick={() => setViewMode('public')}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${viewMode === 'public' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
            >
              Comunidad
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 glass p-1.5 rounded-2xl overflow-x-auto scrollbar-hide w-full sm:w-auto">
            {folders.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                  filter === f 
                    ? 'bg-brand text-white shadow-lg shadow-brand/20' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{f === 'all' ? 'Todo' : f}</span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto bg-white text-black px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand hover:text-white transition-all duration-500 shadow-xl shadow-white/5 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Subir</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Subir Nuevo Archivo"
      >
        <div className="space-y-8 p-2">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Carpeta de destino</label>
            <div className="relative group">
              <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-brand transition-colors" />
              <input 
                type="text"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                placeholder="Ej: Documentos, Fotos, Trabajo..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-brand focus:bg-white/10 transition-all outline-none font-medium"
              />
            </div>
          </div>
          <div className="flex items-center justify-between glass p-4 rounded-2xl border-white/10">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-brand" />
              <span className="text-xs font-bold uppercase italic">Hacer público</span>
            </div>
            <button 
              onClick={() => setIsPublic(!isPublic)}
              className={`w-10 h-5 rounded-full transition-colors relative ${isPublic ? 'bg-brand' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isPublic ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          <div className="glass rounded-2xl p-6 border-dashed border-white/10">
            <p className="text-white/60 text-sm italic leading-relaxed text-center">
              <span>Selecciona un archivo (imagen, video, audio o PDF) de tu dispositivo para guardarlo en tu carpeta personal. Si el nombre de la carpeta es "AUTO", se creará una basada en el nombre del archivo.</span>
            </p>
          </div>
          <ImageUpload 
            onUploadComplete={() => setIsUploadModalOpen(false)}
            folder={uploadFolder || 'General'}
            isPublic={isPublic}
            label="Selecciona un archivo"
          />
        </div>
      </Modal>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="aspect-square glass rounded-[2.5rem] animate-pulse" />
          ))}
        </div>
      ) : filteredMedia.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredMedia.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={item.id}
                onClick={() => setSelectedMedia(item)}
                className="group relative glass rounded-[2.5rem] overflow-hidden aspect-square shadow-xl hover:shadow-2xl hover:shadow-brand/5 transition-all duration-500 cursor-pointer"
              >
                {item.fileType?.startsWith('image/') ? (
                  <img 
                    src={item.url} 
                    alt={item.fileName} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors duration-500">
                    <div className="w-20 h-20 bg-brand/10 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                      <div className="text-brand">
                        {getFileIcon(item.fileType)}
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-6 text-center truncate w-full">
                      {item.fileName}
                    </p>
                    {item.fileType?.startsWith('video/') && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-brand/80 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white fill-current" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-[#0a0502]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 p-8 flex flex-col justify-end gap-6">
                  <div className="space-y-2">
                    <p className="text-lg font-display font-bold truncate leading-none"><span>{item.fileName}</span></p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-white/60">
                        <Folder className="w-3 h-3 text-brand" />
                        <span>{item.folder || 'General'}</span>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-white/60">
                        <Calendar className="w-3 h-3 text-brand" />
                        <span>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Reciente'}</span>
                      </div>
                      {item.isPublic && (
                        <div className="bg-brand/20 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-brand">
                          <Users className="w-3 h-3" />
                          <span>Público</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 bg-white text-black hover:bg-brand hover:text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </a>
                    <button
                      onClick={() => confirmDelete(item.id)}
                      disabled={viewMode === 'public' && item.userId !== user.uid}
                      className={`p-3 backdrop-blur-md rounded-xl transition-all duration-300 ${
                        viewMode === 'public' && item.userId !== user.uid 
                          ? 'bg-white/5 text-white/10 cursor-not-allowed' 
                          : 'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass rounded-[3rem] p-24 text-center border-dashed">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
            <Folder className="w-10 h-10 text-white/10" />
          </div>
          <div className="space-y-4">
            <h3 className="text-2xl font-display font-black uppercase italic"><span>No hay archivos</span></h3>
            <p className="text-white/40 text-sm italic max-w-md mx-auto">
              <span>Sube documentos, fotos o videos para verlos aquí organizados por carpetas.</span>
            </p>
          </div>
        </div>
      )}
      <Modal
        isOpen={!!selectedMedia}
        onClose={() => {
          setSelectedMedia(null);
          setIsExpanded(false);
        }}
        title={selectedMedia?.fileName || 'Detalles del Archivo'}
        size={isExpanded ? 'full' : 'md'}
      >
        <div className="space-y-6">
          <div className={`relative bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 transition-all duration-500 ${isExpanded ? 'aspect-video max-h-[70vh]' : 'aspect-video'}`}>
            {selectedMedia?.fileType?.startsWith('image/') ? (
              <img src={selectedMedia.url} className="w-full h-full object-contain" alt="" referrerPolicy="no-referrer" />
            ) : selectedMedia?.fileType?.startsWith('video/') ? (
              <video src={selectedMedia.url} controls className="w-full h-full" />
            ) : selectedMedia?.fileType?.startsWith('audio/') ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-brand/5 to-transparent">
                <div className="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center mb-8 animate-pulse">
                  <Volume2 className="w-12 h-12 text-brand" />
                </div>
                <audio src={selectedMedia.url} controls className="w-full max-w-md" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <FileText className="w-16 h-16 text-white/20" />
                <p className="text-white/40 text-sm">Vista previa no disponible</p>
              </div>
            )}

            {(selectedMedia?.fileType?.startsWith('video/') || selectedMedia?.fileType?.startsWith('audio/')) && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="absolute top-4 right-4 p-3 bg-black/60 backdrop-blur-md text-white rounded-xl hover:bg-brand transition-all z-10"
                title={isExpanded ? "Contraer" : "Expandir"}
              >
                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            )}
          </div>
          
          {!isExpanded && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-4 rounded-2xl border-white/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Tipo</p>
                  <p className="text-xs font-bold truncate">{selectedMedia?.fileType || 'Desconocido'}</p>
                </div>
                <div className="glass p-4 rounded-2xl border-white/10">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">Tamaño</p>
                  <p className="text-xs font-bold">
                    {selectedMedia?.fileSize ? `${(selectedMedia.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <a 
                  href={selectedMedia?.url} 
                  download={selectedMedia?.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-brand text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand/90 transition-all shadow-xl shadow-brand/20"
                >
                  <Download className="w-5 h-5" />
                  <span>Descargar</span>
                </a>
                <button 
                  onClick={() => {
                    if (selectedMedia) {
                      confirmDelete(selectedMedia.id);
                      setSelectedMedia(null);
                      setIsExpanded(false);
                    }
                  }}
                  className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Archivo"
        onConfirm={handleDelete}
        confirmText="Eliminar"
        confirmVariant="danger"
      >
        <p className="text-white/60 italic"><span>¿Estás seguro de que deseas eliminar este archivo? Esta acción no se puede deshacer.</span></p>
      </Modal>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default Gallery;
