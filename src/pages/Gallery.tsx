import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, orderBy, deleteDoc, doc, handleFirestoreError } from '../firebase';
import { MediaItem, OperationType } from '../types';
import { Image as ImageIcon, Trash2, ExternalLink, Calendar, Folder, Plus, X, Video, Volume2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ImageUpload from '../components/ImageUpload';
import Modal from '../components/Modal';

import Toast from '../components/Toast';

const Gallery: React.FC = () => {
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [uploadFolder, setUploadFolder] = useState('General');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'media'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

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
  }, [user]);

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
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Folder className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Almacenamiento</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Mis Archivos</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Organiza y gestiona tus documentos, fotos y videos en carpetas seguras.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 glass p-1.5 rounded-2xl overflow-x-auto scrollbar-hide w-full sm:w-auto">
            {folders.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                  filter === f 
                    ? 'bg-[#ff4e00] text-white shadow-lg shadow-[#ff4e00]/20' 
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{f === 'all' ? 'Todo' : f}</span>
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto bg-white text-black px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#ff4e00] hover:text-white transition-all duration-500 shadow-xl shadow-white/5 active:scale-95"
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
              <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#ff4e00] transition-colors" />
              <input 
                type="text"
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                placeholder="Ej: Documentos, Fotos, Trabajo..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-[#ff4e00] focus:bg-white/10 transition-all outline-none font-medium"
              />
            </div>
          </div>
          <div className="glass rounded-2xl p-6 border-dashed border-white/10">
            <p className="text-white/60 text-sm italic leading-relaxed text-center">
              <span>Selecciona un archivo (imagen, video, audio o PDF) de tu dispositivo para guardarlo en tu carpeta personal.</span>
            </p>
          </div>
          <ImageUpload 
            onUploadComplete={() => setIsUploadModalOpen(false)}
            folder={uploadFolder || 'General'}
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
                className="group relative glass rounded-[2.5rem] overflow-hidden aspect-square shadow-xl hover:shadow-2xl hover:shadow-[#ff4e00]/5 transition-all duration-500"
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
                    <div className="w-20 h-20 bg-[#ff4e00]/10 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                      <div className="text-[#ff4e00]">
                        {getFileIcon(item.fileType)}
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] px-6 text-center truncate w-full">
                      {item.fileName}
                    </p>
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-[#0a0502]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 p-8 flex flex-col justify-end gap-6">
                  <div className="space-y-2">
                    <p className="text-lg font-display font-bold truncate leading-none"><span>{item.fileName}</span></p>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-white/60">
                        <Folder className="w-3 h-3 text-[#ff4e00]" />
                        <span>{item.folder || 'General'}</span>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-white/60">
                        <Calendar className="w-3 h-3 text-[#ff4e00]" />
                        <span>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Reciente'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 bg-white text-black hover:bg-[#ff4e00] hover:text-white py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </a>
                    <button
                      onClick={() => confirmDelete(item.id)}
                      className="p-3 bg-red-500/10 backdrop-blur-md hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300"
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
