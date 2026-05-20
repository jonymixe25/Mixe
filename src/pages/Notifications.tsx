import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  MessageSquare, 
  Phone, 
  Users, 
  Settings, 
  Trash2, 
  CheckCheck, 
  Clock, 
  ChevronRight, 
  Loader2, 
  Sparkles,
  Heart,
  MessageCircle,
  Video
} from 'lucide-react';
import { 
  listenToNotifications, 
  markAsRead, 
  markAllAllAsRead, 
  deleteNotification, 
  AppNotification 
} from '../services/notificationService';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToNotifications(
      user.uid,
      (newList) => {
        setNotifications(newList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time notifications:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleMarkAsRead = async (nid: string) => {
    if (!nid) return;
    await markAsRead(nid);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await markAllAllAsRead(user.uid);
  };

  const handleDelete = async (e: React.MouseEvent, nid: string) => {
    e.stopPropagation();
    if (!nid) return;
    await deleteNotification(nid);
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (notif.id) {
      await handleMarkAsRead(notif.id);
    }
    
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.type === 'message') {
      navigate(`/chat/${notif.senderId}`);
    } else if (notif.type === 'call') {
      navigate(`/chat/${notif.senderId}`);
    } else if (notif.type === 'friend') {
      navigate('/friends');
    }
  };

  // Helper to match Type styling & Icon
  const getTypeConfig = (type: AppNotification['type']) => {
    switch (type) {
      case 'message':
        return {
          icon: MessageSquare,
          colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
          label: 'Mensaje'
        };
      case 'call':
        return {
          icon: Phone,
          colorClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
          label: 'Llamada'
        };
      case 'friend':
        return {
          icon: Users,
          colorClass: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
          label: 'Socio Ayuuk'
        };
      case 'like':
        return {
          icon: Heart,
          colorClass: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
          label: 'Me gusta'
        };
      case 'comment':
        return {
          icon: MessageCircle,
          colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
          label: 'Comentario'
        };
      case 'system':
      default:
        return {
          icon: Sparkles,
          colorClass: 'text-[var(--primary-color,#ff4e00)] bg-[var(--primary-color,#ff4e00)]/10 border-[var(--primary-color,#ff4e00)]/20',
          label: 'Sistema'
        };
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative animate-fade-in pb-12">
      {/* Upper Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-brand">
            <Bell className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">Notificaciones</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-black/90">
            <span>Centro de Avisos</span>
          </h1>
          <p className="text-black/50 text-sm font-medium italic max-w-sm">
            <span>Sigue el ritmo de tus chats, llamadas y actividades en tiempo real.</span>
          </p>
        </div>

        {notifications.length > 0 && unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-6 py-3.5 bg-black/[0.03] hover:bg-black/[0.06] border border-black/[0.08] text-black/80 rounded-xl text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.03] active:scale-[0.97] transition-all"
          >
            <CheckCheck className="w-4 h-4 text-brand" />
            <span>Marcar todo leído</span>
          </button>
        )}
      </div>

      {/* Main Container */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4 glass rounded-3xl border-black/[0.06]">
          <Loader2 className="w-10 h-10 text-brand animate-spin" />
          <p className="text-black/50 text-xs font-bold uppercase tracking-widest">Cargando avisos...</p>
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {notifications.map((notif) => {
              const config = getTypeConfig(notif.type);
              const IconComponent = config.icon;
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`glass border-black/[0.06] rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row items-start gap-4 hover:border-brand/45 transition-all duration-300 shadow-md hover:shadow-lg cursor-pointer relative overflow-hidden group ${
                    !notif.read ? 'bg-brand/[0.015] border-brand/20' : 'opacity-80'
                  }`}
                >
                  {/* Status Indicator Bar */}
                  {!notif.read && (
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-brand" />
                  )}

                  {/* Icon Panel */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${config.colorClass} shadow-sm transition-transform duration-500 group-hover:scale-110`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="sm:hidden flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border ${config.colorClass}`}>
                          {config.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-black/30 text-[9px]">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details Body */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="hidden sm:flex items-center justify-between">
                      <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg border ${config.colorClass}`}>
                        {config.label}
                      </span>
                      <div className="flex items-center gap-1.5 text-black/30 text-[9px] font-bold uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {formatDistanceToNow(notif.createdAt, { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>

                    <h3 className={`font-display font-extrabold text-lg leading-tight transition-colors ${
                      !notif.read ? 'text-black font-black' : 'text-black/70'
                    }`}>
                      {notif.title}
                    </h3>
                    
                    <p className="text-black/60 text-sm leading-relaxed">{notif.description}</p>
                    
                    {/* Sender profile preview if sender exists and is not system */}
                    {notif.senderId !== 'system' && (
                      <div className="flex items-center gap-2 pt-2">
                        <img 
                          src={notif.senderPhoto} 
                          className="w-5 h-5 rounded-full object-cover bg-white border border-black/[0.06]" 
                          alt="avatar" 
                        />
                        <span className="text-[10px] text-black/40 font-bold uppercase tracking-wider">Por {notif.senderName}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end sm:flex-col sm:justify-start">
                    <button
                      onClick={(e) => handleDelete(e, notif.id || '')}
                      className="p-3 text-black/35 hover:text-red-500 rounded-xl hover:bg-red-500/10 transition-colors"
                      title="Eliminar notificación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.id || '');
                        }}
                        className="px-3 py-1.5 bg-brand/10 border border-brand/15 text-brand rounded-xl text-[9px] font-semibold uppercase tracking-wider hover:bg-brand hover:text-black transition-all"
                        title="Marcar como leída"
                      >
                        Leída
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="py-24 text-center glass rounded-3xl border-dashed border-black/[0.06] shadow-lg shadow-black/[0.03]">
          <div className="w-20 h-20 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-6">
            <Bell className="w-10 h-10 text-black/10" />
          </div>
          <p className="text-black/50 font-display text-xl italic mb-3"><span>No tienes ningún aviso nuevo.</span></p>
          <p className="text-black/30 text-xs italic">Te notificaremos cuando algo ocurra.</p>
        </div>
      )}
    </div>
  );
}
