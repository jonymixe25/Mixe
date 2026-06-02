import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';
import { subscribeToContactsPresence } from '../services/presenceService';
import Toast from './Toast';

const PresenceNotificationManager: React.FC = () => {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<{ [uid: string]: { status: string, name: string } }>({});
  const prevPresenceRef = useRef<{ [uid: string]: { status: string, name: string } }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToContactsPresence(user.uid, (updates) => {
      // Check for changes to show notifications
      Object.entries(updates).forEach(([uid, data]) => {
        const prev = prevPresenceRef.current[uid];
        
        if (prev && prev.status !== data.status) {
          if (data.status === 'online') {
            setToast({
              message: `${data.name} se ha conectado`,
              type: 'success',
              isVisible: true
            });
          } else if (data.status === 'offline') {
            setToast({
              message: `${data.name} se ha desconectado`,
              type: 'success',
              isVisible: true
            });
          }
        }
      });

      prevPresenceRef.current = updates;
      setPresenceMap(updates);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user]);

  return (
    <Toast 
      message={toast.message}
      type={toast.type}
      isVisible={toast.isVisible}
      onClose={() => setToast({ ...toast, isVisible: false })}
    />
  );
};

export default PresenceNotificationManager;
