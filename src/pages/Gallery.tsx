import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, orderBy, deleteDoc, doc, handleFirestoreError } from '../firebase';
import { MediaItem, OperationType } from '../types';
import { Image as ImageIcon, Trash2, ExternalLink, Calendar, Folder, Plus, X, Video, Volume2, FileText, Users, Download, Play, Maximize2, Minimize2, ArrowRight } from 'lucide-react';
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
      const itemToDrop = media.find(m => m.id === itemToDelete);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'media', itemToDelete));
      
      // If it's a local v-uploads url, it will expire naturally

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

  const confirmDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const folders = ['all', ...Array.from(new Set(media.map(item => item.folder || 'General')))];

  const filteredMedia = filter === 'all' 
    ? media 
    : media.filter(item => (item.folder || 'General') === filter);

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <ImageIcon className="w-10 h-10" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="w-10 h-10" />;
    if (fileType.startsWith('video/')) return <Video className="w-10 h-10" />;
    if (fileType.startsWith('audio/')) return <Volume2 className="w-10 h-10" />;
    if (fileType === 'application/pdf') return <FileText className="w-10 h-10" />;
    return <FileText className="w-10 h-10" />;
  };

  if (!user) return null;

  return (
    <div className="max-w-[1600px] mx-auto min-h-[calc(100vh-200px)]">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left Sidebar - Filters & Info */}
        <aside className="lg:w-72 shrink-0 space-y-10">
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Workspace</span>
              <h1 className="text-4xl font-display font-bold tracking-tight text-black/90 leading-none">
                {viewMode === 'private' ? 'Mis Archivos' : 'Galería'}
              </h1>
            </div>

            <div className="flex p-1 gap-1 glass rounded-xl border-black/5 bg-black/[0.03]">
              <button 
                onClick={() => setViewMode('private')}
                className={`flex-1 text-[10px] font-semibold uppercase tracking-wider py-3 rounded-xl transition-all ${viewMode === 'private' ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-black/50 hover:text-black hover:bg-black/[0.03]'}`}
              >
                Personal
              </button>
              <button 
                onClick={() => setViewMode('public')}
                className={`flex-1 text-[10px] font-semibold uppercase tracking-wider py-3 rounded-xl transition-all ${viewMode === 'public' ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-black/50 hover:text-black hover:bg-black/[0.03]'}`}
              >
                Público
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[9px] font-semibold uppercase tracking-wider text-black/30 px-2 flex items-center gap-2">
              <Folder className="w-3 h-3" />
              <span>Directorio</span>
            </label>
            <div className="space-y-1">
              {folders.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all group flex items-center justify-between ${
                    filter === f 
                      ? 'bg-brand/10 text-brand' 
                      : 'text-black/50 hover:text-black hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Folder className={`w-3.5 h-3.5 ${filter === f ? 'fill-brand/20' : 'group-hover:text-brand transition-colors'}`} />
                    <span>{f === 'all' ? 'Ver Todo' : f}</span>
                  </div>
                  <span className={`text-[8px] opacity-40 ${filter === f ? 'opacity-100' : ''}`}>
                    {f === 'all' ? media.length : media.filter(m => (m.folder || 'General') === f).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-black/5 space-y-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full bg-brand text-black py-4 rounded-xl font-semibold uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-brand/90 transition-all duration-500 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-brand/20 active:scale-95 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
              <span>Nuevo Archivo</span>
            </button>
            <a
              href="https://vidamixe.mx/gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full glass text-black/60 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-3 hover:text-black hover:bg-black/[0.06] transition-all active:scale-95"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Galería Producción</span>
            </a>
          </div>

          {/* Storage Stat */}
          <div className="glass p-6 rounded-3xl border-black/5 bg-gradient-to-br from-white/5 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-black/50">Almacenamiento</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-brand">Ilimitado</span>
            </div>
            <div className="w-full h-1.5 bg-black/[0.03] rounded-full overflow-hidden mb-3">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((media.length / 50) * 100, 100)}%` }}
                className="h-full bg-brand rounded-full shadow-[0_0_10px_var(--primary-color)]"
              />
            </div>
            <p className="text-[10px] text-black/50 font-bold uppercase italic leading-none">
              {media.length} archivos almacenados
            </p>
          </div>
        </aside>

        {/* Right Content Area - Grid */}
        <main className="flex-1 space-y-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-64 glass rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredMedia.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredMedia.map((item) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={item.id}
                    onClick={() => setSelectedMedia(item)}
                    className="group flex flex-col glass rounded-3xl overflow-hidden shadow-lg shadow-black/[0.03] shadow-black/[0.04] hover:shadow-brand/5 border border-black/5 hover:border-brand/20 transition-all duration-500 cursor-pointer overflow-hidden backdrop-blur-3xl"
                  >
                    {/* Media Preview Container */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-black/[0.03]">
                      {item.fileType?.startsWith('image/') ? (
                        <img 
                          src={item.url} 
                          alt={item.fileName} 
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-8 transition-colors duration-500 group-hover:bg-black/[0.03]">
                          <div className="w-20 h-20 bg-brand/10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110">
                            <div className="text-brand">
                              {getFileIcon(item.fileType)}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Top Badges */}
                      <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                        {item.isPublic && (
                          <div className="bg-brand/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-black/20 shadow-lg shadow-black/[0.03]">
                            <Users className="w-3 h-3 text-black" />
                          </div>
                        )}
                        <div className="bg-black/40 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-black/[0.06] text-[8px] font-semibold uppercase tracking-wider text-black/80">
                          {item.fileType?.split('/')[1] || 'FILE'}
                        </div>
                      </div>

                      {/* Video Play Button Overlay */}
                      {item.fileType?.startsWith('video/') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-14 h-14 bg-brand/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg shadow-black/[0.03] shadow-black/[0.04] opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500">
                            <Play className="w-7 h-7 text-black fill-current ml-1" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex flex-col gap-4 flex-1">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-sm font-bold uppercase tracking-tight truncate leading-tight group-hover:text-brand transition-colors">
                            {item.fileName}
                          </h3>
                          <button
                            onClick={(e) => confirmDelete(item.id, e)}
                            disabled={viewMode === 'public' && item.userId !== user.uid}
                            className={`p-2 transition-all duration-300 rounded-lg ${
                              viewMode === 'public' && item.userId !== user.uid 
                                ? 'hidden' 
                                : 'text-black/30 hover:text-red-500 hover:bg-red-500/10'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-black/40 tracking-tight">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Desconocido'}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-black/[0.06]" />
                          <span>{item.fileSize ? `${(item.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-black/[0.03] border border-black/[0.06] flex items-center justify-center text-[10px] font-bold text-black/50">
                            <Folder className="w-3 h-3" />
                          </div>
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-black/50">{item.folder || 'General'}</span>
                        </div>
                        <div className="flex items-center gap-1 group/btn">
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-black/0 group-hover:text-brand transition-all -translate-x-2 group-hover:translate-x-0 duration-300">Ver Detalles</span>
                          <ArrowRight className="w-4 h-4 text-black/50 group-hover:text-brand transition-all transform group-hover:rotate-[-45deg]" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="glass rounded-3xl p-24 text-center border-dashed border-black/5 bg-black/2">
              <div className="w-32 h-32 bg-brand/5 rounded-full flex items-center justify-center mx-auto mb-10 relative">
                <div className="absolute inset-0 bg-brand/10 blur-3xl rounded-full" />
                <Folder className="w-14 h-14 text-black/10 relative z-10" />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-display font-bold uppercase italic tracking-tight">Estante Vacío</h3>
                <p className="text-black/40 text-sm italic max-w-sm mx-auto leading-relaxed">
                  Esta sección está esperando tus archivos. Sube documentos, fotos o videos para comenzar a organizar tu espacio digital.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-black/[0.03] hover:bg-black/[0.06] text-black/60 hover:text-black border border-black/[0.06] px-8 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all inline-flex items-center gap-3"
                  >
                    <Plus className="w-4 h-4 text-brand" />
                    <span>Subir Primer Archivo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Subir Archivo"
      >
        <div className="space-y-8 p-2">
          <div className="space-y-3">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/50 ml-1">Organizar en carpeta</label>
            <div className="relative group">
              <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 group-focus-within:text-brand transition-colors" />
              <input 
                type="text"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                placeholder="Ej: Documentos, Fotos, Trabajo..."
                className="w-full bg-black/[0.03] border border-black/[0.06] rounded-xl pl-12 pr-4 py-4 text-sm focus:border-brand focus:bg-black/[0.06] transition-all outline-none font-medium"
              />
            </div>
          </div>
          <div className="flex items-center justify-between glass p-5 rounded-xl border-black/[0.06] hover:bg-black/[0.03] transition-colors cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isPublic ? 'bg-brand/10' : 'bg-black/[0.03]'}`}>
                <Users className={`w-5 h-5 ${isPublic ? 'text-brand' : 'text-black/30'}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-tight">Visibilidad Pública</span>
                <span className="text-[9px] text-black/50 font-bold uppercase tracking-widest italic">Compartir con la comunidad</span>
              </div>
            </div>
            <button 
              className={`w-12 h-6 rounded-full transition-colors relative ${isPublic ? 'bg-brand' : 'bg-black/[0.06]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-black rounded-full transition-all ${isPublic ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          
          <ImageUpload 
            onUploadComplete={() => setIsUploadModalOpen(false)}
            folder={uploadFolder || 'General'}
            isPublic={isPublic}
            label="Clic para seleccionar o arrastra aquí"
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedMedia}
        onClose={() => {
          setSelectedMedia(null);
          setIsExpanded(false);
        }}
        title={selectedMedia?.fileName || 'Detalles'}
        size={isExpanded ? 'full' : 'md'}
      >
        {selectedMedia && (
          <div className="space-y-8">
            <div className={`relative bg-black group rounded-3xl overflow-hidden border border-black/[0.06] flex items-center justify-center transition-all duration-700 ease-[0.22, 1, 0.36, 1] ${isExpanded ? 'aspect-video max-h-[85vh]' : 'aspect-square'}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent pointer-events-none" />
              
              {selectedMedia.fileType?.startsWith('image/') ? (
                <img src={selectedMedia.url} className="w-full h-full object-contain relative z-10" alt="" referrerPolicy="no-referrer" />
              ) : selectedMedia.fileType?.startsWith('video/') ? (
                <video src={selectedMedia.url} controls className="w-full h-full relative z-10" autoPlay />
              ) : selectedMedia.fileType?.startsWith('audio/') ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-12 relative z-10">
                  <div className="w-32 h-32 bg-brand/10 rounded-full flex items-center justify-center mb-10 shadow-inner group">
                    <Volume2 className="w-16 h-16 text-brand animate-pulse" />
                  </div>
                  <audio src={selectedMedia.url} controls className="w-full max-w-md shadow-lg shadow-black/[0.03] shadow-black/[0.04]" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6 relative z-10">
                  <div className="w-24 h-24 bg-black/[0.03] rounded-3xl flex items-center justify-center border border-black/[0.06]">
                    <FileText className="w-12 h-12 text-black/30" />
                  </div>
                  <p className="text-black/50 text-sm font-semibold uppercase tracking-wider italic">Vista previa no soportada</p>
                </div>
              )}

              {(selectedMedia.fileType?.startsWith('video/') || selectedMedia.fileType?.startsWith('audio/') || selectedMedia.fileType?.startsWith('image/')) && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="absolute top-6 right-6 p-4 bg-black/40 backdrop-blur-xl text-black/50 hover:text-black rounded-xl border border-black/[0.06] hover:border-brand transition-all z-20 group/exp"
                >
                  {isExpanded ? <Minimize2 className="w-6 h-6 group-hover/exp:scale-95" /> : <Maximize2 className="w-6 h-6 group-hover/exp:scale-110" />}
                </button>
              )}
            </div>
            
            {!isExpanded && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass p-5 rounded-3xl border-black/5 hover:bg-black/[0.03] transition-colors">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black/30 mb-2">Información Técnica</p>
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold truncate flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                         {selectedMedia.fileType || 'Desconocido'}
                       </p>
                       <p className="text-[11px] font-mono text-black/50">
                         {selectedMedia.fileSize ? `${(selectedMedia.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                       </p>
                    </div>
                  </div>
                  <div className="glass p-5 rounded-3xl border-black/5 hover:bg-black/[0.03] transition-colors">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black/30 mb-2">Metadata</p>
                    <div className="space-y-2">
                       <p className="text-[11px] font-bold flex items-center gap-2">
                         <Calendar className="w-3 h-3 text-brand" />
                         {selectedMedia.createdAt?.toDate ? selectedMedia.createdAt.toDate().toLocaleDateString() : 'Reciente'}
                       </p>
                       <p className="text-[11px] font-bold flex items-center gap-2">
                         <Folder className="w-3 h-3 text-brand" />
                         {selectedMedia.folder || 'General'}
                       </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <a 
                    href={selectedMedia.url} 
                    download={selectedMedia.fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-black text-white py-5 rounded-3xl font-semibold uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-3 hover:bg-brand hover:text-black transition-all duration-500 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-black/5 group"
                  >
                    <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                    <span>Descargar</span>
                  </a>
                  <button 
                    onClick={() => {
                      confirmDelete(selectedMedia.id);
                      setSelectedMedia(null);
                      setIsExpanded(false);
                    }}
                    className="p-5 bg-red-500/10 text-red-500 rounded-3xl hover:bg-red-500 hover:text-black border border-red-500/10 hover:border-red-500 transition-all duration-500"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Eliminación"
        onConfirm={handleDelete}
        confirmText="Eliminar permanentemente"
        confirmVariant="danger"
      >
        <div className="space-y-4 pt-2">
          <div className="w-16 h-16 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-black/60 text-center italic text-sm leading-relaxed">
            ¿Estás completamente seguro de que deseas eliminar este archivo? Esta acción es <span className="text-red-500 font-bold underline">irreversible</span> y el archivo se perderá para siempre.
          </p>
        </div>
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
