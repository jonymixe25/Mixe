import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, orderBy, deleteDoc, doc, handleFirestoreError } from '../firebase';
import { MediaItem, OperationType } from '../types';
import { Image as ImageIcon, Trash2, ExternalLink, Calendar, Folder, Plus, X } from 'lucide-react';
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
        message: 'Imagen eliminada correctamente',
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

  const folders = ['all', ...Array.from(new Set(media.map(item => item.folder)))];

  const filteredMedia = filter === 'all' 
    ? media 
    : media.filter(item => item.folder === filter);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-[#ff4e00]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase italic">Galería de Medios</h1>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Tus imágenes subidas</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
            {folders.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  filter === f 
                    ? 'bg-[#ff4e00] text-white' 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {f === 'all' ? 'Todo' : f}
              </button>
            ))}
          </div>
          
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-[#ff4e00] text-white px-6 py-2 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#ff4e00]/90 transition-colors shadow-lg shadow-[#ff4e00]/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Subir Imagen
          </button>
        </div>
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Subir Nueva Imagen"
      >
        <div className="space-y-6">
          <p className="text-white/60 text-sm italic">Selecciona una imagen de tu dispositivo para guardarla en tu galería personal.</p>
          <ImageUpload 
            onUploadComplete={() => setIsUploadModalOpen(false)}
            folder="gallery"
            label="Selecciona una imagen"
          />
        </div>
      </Modal>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
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
                className="group relative bg-white/5 border border-white/10 rounded-3xl overflow-hidden aspect-square shadow-xl"
              >
                <img 
                  src={item.url} 
                  alt={item.fileName} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-end gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold truncate">{item.fileName}</p>
                    <div className="flex items-center gap-4 text-[10px] text-white/60 font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {item.folder}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Reciente'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 bg-white/10 backdrop-blur-md hover:bg-white/20 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver Original
                    </a>
                    <button
                      onClick={() => confirmDelete(item.id)}
                      className="p-2 bg-red-500/20 backdrop-blur-md hover:bg-red-500/40 text-red-500 rounded-xl transition-colors"
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
        <div className="bg-white/5 border border-white/10 rounded-3xl p-20 text-center space-y-4">
          <ImageIcon className="w-16 h-16 text-white/10 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold uppercase italic">No hay imágenes</h3>
            <p className="text-white/40 text-sm italic">Las imágenes que subas en el perfil, noticias o transmisiones aparecerán aquí.</p>
          </div>
        </div>
      )}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Eliminar Imagen"
        onConfirm={handleDelete}
        confirmText="Eliminar"
        confirmVariant="danger"
      >
        <p className="text-white/60 italic">¿Estás seguro de que deseas eliminar esta imagen de tu galería? Esta acción no se puede deshacer.</p>
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
