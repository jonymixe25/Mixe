import React, { useState, useEffect } from 'react';
import { db, doc, getDoc } from '../firebase';
import { useAuth } from '../AuthContext';
import { ShieldAlert, Radio } from 'lucide-react';
import { motion } from 'motion/react';

const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setMaintenanceMode(settingsDoc.data().maintenanceMode || false);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
      } finally {
        setLoading(false);
      }
    };
    checkMaintenance();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
      </div>
    );
  }

  // Admins can always bypass maintenance mode
  if (maintenanceMode && user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0502] text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-12 rounded-[3rem] max-w-2xl w-full text-center space-y-8 border-red-500/20 shadow-2xl shadow-red-500/5"
        >
          <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl font-display font-black tracking-tighter uppercase italic leading-none">
              Modo <span className="text-red-500">Mantenimiento</span>
            </h1>
            <p className="text-white/40 text-lg italic leading-relaxed">
              Estamos realizando mejoras en la plataforma para ofrecerte una mejor experiencia. Volveremos muy pronto.
            </p>
          </div>
          <div className="pt-8 border-t border-white/5 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Voz Mixe • La región de los jamás conquistados</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
