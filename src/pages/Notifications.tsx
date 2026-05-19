import React, { useEffect, useState } from 'react';
import { Bell, Shield, Video, Newspaper } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db, collection, query, onSnapshot, orderBy } from '../firebase';

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'stream' | 'news' | 'security' | 'friend';
  read: boolean;
  createdAt: any; // Firestore timestamp
}

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    const notifsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notifsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
    });

    return () => unsubscribe();
  }, [user]);

  const getIcon = (type: string) => {
    switch(type) {
        case 'stream': return Video;
        case 'news': return Newspaper;
        case 'security': return Shield;
        default: return Bell;
    }
  }

  return (
    <div className="space-y-12 p-8">
      <header className="flex items-end justify-between px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-brand">
            <Bell className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">Novedades</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black/90">Notificaciones</h1>
        </div>
      </header>

      <section className="space-y-6">
        {notifications.map((n) => {
          const Icon = getIcon(n.type);
          return (
            <div key={n.id} className={`glass p-6 rounded-3xl flex items-start gap-5 glass-hover ${n.read ? 'opacity-60' : ''}`}>
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-brand" />
              </div>
              <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-lg">{n.title}</h3>
                  <p className="text-black/60">{n.description}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
export default Notifications;
