import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, getDocs, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp, handleFirestoreError } from '../firebase';
import { StreamSession, UserProfile, OperationType } from '../types';
import { Shield, Users, Video, Trash2, UserCog, AlertTriangle, Newspaper, Plus, Save, ExternalLink, CheckCircle2, Radio, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';

import ImageUpload from '../components/ImageUpload';

import Toast from '../components/Toast';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'streams' | 'users' | 'news'>('streams');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary';
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const showConfirm = (config: any) => {
    setModalConfig(config);
    setIsModalOpen(true);
  };

  // News form state
  const [newsTitle, setNewsTitle] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsImage, setNewsImage] = useState('');
  const [savingNews, setSavingNews] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // Listen to all streams
    const streamsQuery = query(collection(db, 'streams'), orderBy('startedAt', 'desc'));
    const unsubscribeStreams = onSnapshot(streamsQuery, (snapshot) => {
      setStreams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'streams');
    });

    // Fetch all users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    // Fetch all news
    const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'news');
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

    showConfirm({
      title: '¿Publicar noticia?',
      message: '¿Estás seguro de que deseas publicar esta noticia? Será visible para todos los usuarios.',
      confirmText: 'Publicar',
      confirmVariant: 'primary',
      onConfirm: async () => {
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
          setToast({ message: 'Noticia publicada con éxito', type: 'success', isVisible: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'news');
        } finally {
          setSavingNews(false);
        }
      }
    });
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
          setToast({ message: 'Noticia eliminada', type: 'success', isVisible: true });
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
          setToast({ message: 'Transmisión eliminada', type: 'success', isVisible: true });
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
          setToast({ message: `Rol actualizado a ${newRole}`, type: 'success', isVisible: true });
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
    <div className="max-w-7xl mx-auto space-y-12 relative">
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

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Administración</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Panel de Control</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Gestiona usuarios, transmisiones y el contenido de noticias de la plataforma.</span>
          </p>
        </div>
        
        <div className="flex glass p-1.5 rounded-2xl border-white/10 shadow-xl">
          {(['streams', 'users', 'news'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab 
                  ? 'bg-[#ff4e00] text-white shadow-lg shadow-[#ff4e00]/20' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab === 'streams' ? 'Streams' : tab === 'users' ? 'Usuarios' : 'Noticias'}
            </button>
          ))}
          <a href="/settings" className="px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all duration-300 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Ajustes
          </a>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Total Usuarios', value: users.length, icon: Users, color: 'text-blue-500' },
          { label: 'Total Streams', value: streams.length, icon: Video, color: 'text-purple-500' },
          { label: 'Streams Activos', value: streams.filter(s => s.status === 'live').length, icon: Radio, color: 'text-red-500', live: true }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className="glass rounded-[2.5rem] p-8 flex items-center justify-between group hover:bg-white/5 transition-all duration-500 shadow-xl"
          >
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{stat.label}</p>
              <p className={`text-5xl font-display font-black tracking-tighter ${stat.live ? 'text-red-500' : 'text-white'}`}>
                {stat.value}
              </p>
            </div>
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner ${stat.live ? 'animate-pulse' : ''}`}>
              <stat.icon className={`w-8 h-8 ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
            </div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="py-32 flex flex-col items-center justify-center gap-6 glass rounded-[3rem]">
          <div className="w-16 h-16 border-4 border-[#ff4e00]/20 border-t-[#ff4e00] rounded-full animate-spin" />
          <p className="text-white/40 font-display text-xl italic"><span>Cargando datos del panel...</span></p>
        </div>
      ) : (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass rounded-[3rem] overflow-hidden shadow-2xl"
        >
          {activeTab === 'streams' ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Stream</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Streamer</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Estado</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Espectadores</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {streams.map((s) => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-8">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-[#ff4e00]/10 border border-[#ff4e00]/20 flex items-center justify-center shadow-inner">
                            <Video className="w-7 h-7 text-[#ff4e00]" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-display font-bold text-lg leading-none">{s.title}</p>
                            <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{s.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 p-0.5 border border-white/10">
                            <img 
                              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.userId}`} 
                              className="w-full h-full rounded-[0.5rem] bg-[#0a0502]" 
                              alt="avatar" 
                            />
                          </div>
                          <span className="text-sm font-bold text-white/60">{s.userName}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          s.status === 'live' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-white/20'
                        }`}>
                          {s.status === 'live' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                          <span>{s.status === 'live' ? 'En Vivo' : 'Finalizado'}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2 text-sm font-mono font-bold text-white/40">
                          <Users className="w-4 h-4 text-[#ff4e00]" />
                          <span>{s.viewerCount}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <button
                          onClick={() => handleDeleteStream(s.id)}
                          className="p-3 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Usuario</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Email</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Rol</th>
                    <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-white/5 transition-colors group">
                      <td className="p-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 p-0.5 border border-white/10">
                            <img 
                              src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                              className="w-full h-full rounded-[0.7rem] bg-[#0a0502]" 
                              alt="avatar" 
                            />
                          </div>
                          <span className="font-display font-bold text-lg leading-none">{u.displayName}</span>
                        </div>
                      </td>
                      <td className="p-8 text-sm font-medium text-white/40">{u.email}</td>
                      <td className="p-8">
                        <div className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          u.role === 'admin' ? 'bg-[#ff4e00]/10 text-[#ff4e00]' : 'bg-white/5 text-white/20'
                        }`}>
                          {u.role}
                        </div>
                      </td>
                      <td className="p-8">
                        <button
                          onClick={() => toggleUserRole(u)}
                          className="p-3 bg-white/5 hover:bg-[#ff4e00] text-white/40 hover:text-white rounded-xl transition-all duration-300"
                          title="Cambiar Rol"
                        >
                          <UserCog className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 lg:p-16 space-y-16">
              <form onSubmit={handleCreateNews} className="space-y-10 glass p-10 rounded-[3rem] border-white/10 shadow-inner">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-[#ff4e00]" />
                  </div>
                  <h3 className="text-2xl font-display font-black uppercase italic">
                    Publicar Nueva Noticia
                  </h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Título de la noticia</label>
                      <input
                        type="text"
                        placeholder="Ej: Gran Festival Mixe 2026"
                        value={newsTitle}
                        onChange={(e) => setNewsTitle(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 transition-all outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Contenido</label>
                      <textarea
                        placeholder="Escribe aquí el cuerpo de la noticia..."
                        value={newsContent}
                        onChange={(e) => setNewsContent(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 transition-all outline-none min-h-[250px] resize-none leading-relaxed"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Imagen de portada</label>
                      <div className="glass rounded-[2rem] p-6 border-dashed border-white/10">
                        <ImageUpload 
                          onUploadComplete={(url) => setNewsImage(url)}
                          label="Selecciona una imagen de impacto"
                          folder="news"
                          currentImageUrl={newsImage}
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={savingNews}
                        className="w-full bg-[#ff4e00] text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all duration-500 shadow-2xl shadow-[#ff4e00]/20 disabled:opacity-50 active:scale-95"
                      >
                        {savingNews ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                        <span>Publicar Noticia</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-white/20" />
                  </div>
                  <h3 className="text-2xl font-display font-black uppercase italic">Noticias Publicadas</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {news.map(n => (
                    <div key={n.id} className="flex items-center justify-between p-6 glass rounded-[2.5rem] border-white/10 group hover:bg-white/5 transition-all duration-500 shadow-xl">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-white/10 overflow-hidden shadow-inner">
                          <img 
                            src={n.imageUrl || `https://picsum.photos/seed/${n.id}/200/200`} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                            alt="news" 
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="font-display font-bold text-lg leading-tight line-clamp-1 group-hover:text-[#ff4e00] transition-colors">{n.title}</p>
                          <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Por {n.authorName}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNews(n.id)}
                        className="p-4 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <div className="col-span-full py-20 text-center glass rounded-[3rem] border-dashed">
                      <p className="text-white/40 font-display text-xl italic"><span>No hay noticias publicadas aún.</span></p>
                    </div>
                  )}
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
