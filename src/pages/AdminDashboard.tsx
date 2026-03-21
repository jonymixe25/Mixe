import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, getDocs, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp } from '../firebase';
import { StreamSession, UserProfile, OperationType } from '../types';
import { Shield, Users, Video, Trash2, UserCog, AlertTriangle, Newspaper, Plus, Save, ExternalLink, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import ImageUpload from '../components/ImageUpload';
import { handleFirestoreError } from '../AuthContext';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'streams' | 'users' | 'news'>('streams');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary';
  } | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // News form state
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImage, setNewsImage] = useState('');
  const [savingNews, setSavingNews] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showConfirm = (config: typeof modalConfig) => {
    setModalConfig(config);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // Listen to all streams
    const streamsQuery = query(collection(db, 'streams'), orderBy('startedAt', 'desc'));
    const unsubscribeStreams = onSnapshot(streamsQuery, (snapshot) => {
      setStreams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession)));
    });

    // Fetch all users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    // Fetch all news
    const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeStreams();
      unsubscribeUsers();
      unsubscribeNews();
    };
  }, [user]);

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newsTitle || !newsContent) return;
    setSavingNews(true);
    try {
      await addDoc(collection(db, 'news'), {
        title: newsTitle,
        content: newsContent,
        imageUrl: newsImage,
        authorId: user.uid,
        authorName: user.displayName,
        createdAt: serverTimestamp(),
      });
      setNewsTitle('');
      setNewsContent('');
      setNewsImage('');
      setToast({ message: 'Noticia publicada con éxito', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'news');
      setToast({ message: 'Error al publicar la noticia', type: 'error' });
    } finally {
      setSavingNews(false);
    }
  };

  const handleDeleteNews = (newsId: string) => {
    showConfirm({
      title: '¿Eliminar noticia?',
      message: 'Esta acción no se puede deshacer. La noticia será eliminada permanentemente.',
      confirmText: 'Eliminar',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'news', newsId));
          setToast({ message: 'Noticia eliminada', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `news/${newsId}`);
        }
      }
    });
  };

  const handleDeleteStream = (streamId: string) => {
    showConfirm({
      title: '¿Eliminar transmisión?',
      message: '¿Estás seguro de que deseas eliminar el registro de esta transmisión?',
      confirmText: 'Eliminar',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'streams', streamId));
          setToast({ message: 'Transmisión eliminada', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `streams/${streamId}`);
        }
      }
    });
  };

  const toggleUserRole = (targetUser: UserProfile) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    showConfirm({
      title: 'Cambiar rol de usuario',
      message: `¿Estás seguro de cambiar el rol de ${targetUser.displayName} a ${newRole}?`,
      confirmText: 'Cambiar Rol',
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'users', targetUser.uid), {
            role: newRole
          });
          setToast({ message: `Rol actualizado a ${newRole}`, type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
        }
      }
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h1 className="text-2xl font-bold uppercase italic">Acceso Denegado</h1>
        <p className="text-white/40 italic">No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 right-8 z-[110] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalConfig?.title || ''}
        onConfirm={modalConfig?.onConfirm}
        confirmText={modalConfig?.confirmText}
        confirmVariant={modalConfig?.confirmVariant}
      >
        <p className="text-white/60 italic">{modalConfig?.message}</p>
      </Modal>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#ff4e00]/10 rounded-xl lg:rounded-2xl flex items-center justify-center">
            <Shield className="w-5 h-5 lg:w-6 lg:h-6 text-[#ff4e00]" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight uppercase italic">Panel de Control</h1>
        </div>
        
        <div className="flex w-full sm:w-auto bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('streams')}
            className={`flex-1 sm:flex-none px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === 'streams' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            Streams
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-none px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === 'users' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 sm:flex-none px-4 lg:px-6 py-2 rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === 'news' ? 'bg-[#ff4e00] text-white shadow-lg' : 'text-white/40 hover:text-white'
            }`}
          >
            Noticias
          </button>
        </div>
      </div>

      {/* Stats Summary - Moved to Top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Usuarios</p>
            <p className="text-3xl font-bold tracking-tighter">{users.length}</p>
          </div>
          <Users className="w-8 h-8 text-white/10 group-hover:text-[#ff4e00]/20 transition-colors" />
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Streams</p>
            <p className="text-3xl font-bold tracking-tighter">{streams.length}</p>
          </div>
          <Video className="w-8 h-8 text-white/10 group-hover:text-[#ff4e00]/20 transition-colors" />
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 transition-colors"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Streams Activos</p>
            <p className="text-3xl font-bold tracking-tighter text-red-500">
              {streams.filter(s => s.status === 'live').length}
            </p>
          </div>
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
        </motion.div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
        </div>
      ) : (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden"
        >
          {activeTab === 'streams' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Stream</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Streamer</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Estado</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Espectadores</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {streams.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Video className="w-5 h-5 text-white/20 group-hover:text-[#ff4e00]/40 transition-colors" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{s.title}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">{s.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.userId}`} className="w-6 h-6 rounded-full bg-white/10" alt="avatar" />
                          <span className="text-sm">{s.userName}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          s.status === 'live' ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white/40'
                        }`}>
                          {s.status === 'live' ? 'En Vivo' : 'Finalizado'}
                        </span>
                      </td>
                      <td className="p-6 text-sm font-mono">{s.viewerCount}</td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteStream(s.id)}
                            className="p-2 text-white/20 hover:text-red-500 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Usuario</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Email</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Rol</th>
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-white/40">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.uid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-8 h-8 rounded-xl bg-white/10" alt="avatar" />
                          <span className="font-bold text-sm">{u.displayName}</span>
                        </div>
                      </td>
                      <td className="p-6 text-sm text-white/60">{u.email}</td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-[#ff4e00]/20 text-[#ff4e00]' : 'bg-white/10 text-white/40'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-6">
                        <button
                          onClick={() => toggleUserRole(u)}
                          className="p-2 text-white/20 hover:text-[#ff4e00] transition-colors"
                          title="Cambiar Rol"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              <form onSubmit={handleCreateNews} className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#ff4e00]" />
                  Publicar Nueva Noticia
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Título de la noticia"
                      value={newsTitle}
                      onChange={(e) => setNewsTitle(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none"
                      required
                    />
                    <textarea
                      placeholder="Contenido de la noticia..."
                      value={newsContent}
                      onChange={(e) => setNewsContent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none min-h-[150px] resize-none"
                      required
                    />
                  </div>
                  <ImageUpload 
                    onUploadComplete={(url) => setNewsImage(url)}
                    label="Imagen de la Noticia"
                    currentImageUrl={newsImage}
                    folder="news"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingNews}
                  className="bg-[#ff4e00] text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#ff4e00]/90 transition-colors disabled:opacity-50"
                >
                  {savingNews ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Publicar Noticia
                </button>
              </form>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Noticias Publicadas</h3>
                <div className="grid grid-cols-1 gap-4">
                  {news.map(n => (
                    <div key={n.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden">
                          <img src={n.imageUrl || `https://picsum.photos/seed/${n.id}/100/100`} alt="news" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{n.title}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Por {n.authorName}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        className="p-2 text-white/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AdminDashboard;
