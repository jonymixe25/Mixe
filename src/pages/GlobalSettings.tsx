import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, getDoc, updateDoc, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { Settings as SettingsIcon, Save, AlertTriangle } from 'lucide-react';
import Toast from '../components/Toast';

const GlobalSettings: React.FC = () => {
  const { user } = useAuth();
  const [appName, setAppName] = useState('');
  const [themeColor, setThemeColor] = useState('#ff4e00');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setAppName(data.appName || '');
          setThemeColor(data.themeColor || '#ff4e00');
          setContactEmail(data.contactEmail || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        appName,
        themeColor,
        contactEmail
      });
      setToast({ message: 'Configuración guardada.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
      setToast({ message: 'Error al guardar.', type: 'error', isVisible: true });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertTriangle className="w-16 h-16 text-yellow-500" />
        <h1 className="text-2xl font-bold uppercase italic">Acceso Denegado</h1>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-[#ff4e00]">
          <SettingsIcon className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Configuración Global</span>
        </div>
        <h1 className="text-5xl font-display font-black tracking-tighter uppercase italic">Ajustes de la App</h1>
      </div>

      {loading ? (
        <div className="py-20 text-center">Cargando...</div>
      ) : (
        <div className="glass p-10 rounded-[3rem] space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Nombre de la App</label>
            <input 
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] outline-none"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Color del Tema</label>
            <input 
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl p-1 cursor-pointer"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Email de Contacto</label>
            <input 
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#ff4e00] text-white py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all disabled:opacity-50"
          >
            {saving ? 'Guardando...' : <><Save className="w-5 h-5" /> Guardar Cambios</>}
          </button>
        </div>
      )}
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default GlobalSettings;
