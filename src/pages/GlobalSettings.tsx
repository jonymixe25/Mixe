import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, getDoc, updateDoc, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { Settings as SettingsIcon, Save, AlertTriangle, Languages, ShieldAlert, UserPlus, ShieldCheck, Facebook, Twitter, Instagram, Globe, Image as ImageIcon, Upload, Loader2, X } from 'lucide-react';
import Toast from '../components/Toast';

const GlobalSettings = () => {
  const { user } = useAuth();
  const [appName, setAppName] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [footerText, setFooterText] = useState('');
  const [themeColor, setThemeColor] = useState('#ff4e00');
  const [contactEmail, setContactEmail] = useState('');
  const [enableMixe, setEnableMixe] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [moderationSensitivity, setModerationSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
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
          setAppName(data.appName || 'Voz Mixe');
          setHeroTitle(data.heroTitle || 'La Voz Mixe');
          setHeroSubtitle(data.heroSubtitle || '"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.');
          setHeroImageUrl(data.heroImageUrl || '');
          setFooterText(data.footerText || 'La región de los jamás conquistados.');
          setThemeColor(data.themeColor || '#ff4e00');
          setContactEmail(data.contactEmail || 'contacto@vozmixe.mx');
          setEnableMixe(data.enableMixe || false);
          setMaintenanceMode(data.maintenanceMode || false);
          setRegistrationEnabled(data.registrationEnabled ?? true);
          setModerationSensitivity(data.moderationSensitivity || 'medium');
          setFacebookUrl(data.socialLinks?.facebook || '');
          setTwitterUrl(data.socialLinks?.twitter || '');
          setInstagramUrl(data.socialLinks?.instagram || '');
        } else {
          // Defaults if document doesn't exist
          setAppName('Voz Mixe');
          setHeroTitle('La Voz Mixe');
          setHeroSubtitle('"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.');
          setFooterText('La región de los jamás conquistados.');
          setContactEmail('contacto@vozmixe.mx');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const resetDefaults = () => {
    if (window.confirm('¿Estás seguro de que deseas restablecer todos los ajustes a los valores predeterminados?')) {
      setAppName('Voz Mixe');
      setHeroTitle('La Voz Mixe');
      setHeroSubtitle('"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.');
      setHeroImageUrl('');
      setFooterText('La región de los jamás conquistados.');
      setThemeColor('#ff4e00');
      setContactEmail('contacto@vozmixe.mx');
      setEnableMixe(false);
      setMaintenanceMode(false);
      setRegistrationEnabled(true);
      setModerationSensitivity('medium');
      setFacebookUrl('');
      setTwitterUrl('');
      setInstagramUrl('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'global'), {
        appName,
        heroTitle,
        heroSubtitle,
        heroImageUrl,
        footerText,
        themeColor,
        contactEmail,
        enableMixe,
        maintenanceMode,
        registrationEnabled,
        moderationSensitivity,
        socialLinks: {
          facebook: facebookUrl,
          twitter: twitterUrl,
          instagram: instagramUrl
        }
      });
      setToast({ message: 'Configuración guardada.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
      setToast({ message: 'Error al guardar.', type: 'error', isVisible: true });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'site-assets');

    try {
      setSaving(true);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error al subir imagen');
      
      const data = await response.json();
      setHeroImageUrl(data.url);
      setToast({ message: 'Imagen cargada temporalmente. No olvides guardar.', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error uploading image:', error);
      setToast({ message: 'Error al subir la imagen.', type: 'error', isVisible: true });
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
        <div className="flex items-center gap-3 text-brand">
          <SettingsIcon className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Configuración Global</span>
        </div>
        <h1 className="text-5xl font-display font-black tracking-tighter uppercase italic">Ajustes de la App</h1>
        <div className="flex justify-end">
          <button 
            onClick={resetDefaults}
            className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors"
          >
            Restablecer Predeterminados
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">Cargando...</div>
      ) : (
        <div className="space-y-8">
          {/* General Section */}
          <div className="glass p-10 rounded-[3rem] space-y-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-brand mb-4">General</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Nombre de la App</label>
                <input 
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-brand outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Color del Tema</label>
                <input 
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Título de Bienvenida (Hero)</label>
                <input 
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-brand outline-none transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Subtítulo de Bienvenida (Hero)</label>
                <textarea 
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-brand outline-none transition-all min-h-[100px] resize-none"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Imagen de Fondo (Hero)</label>
                <div className="glass p-6 rounded-3xl border-white/10 flex flex-col md:flex-row items-center gap-6">
                  {heroImageUrl ? (
                    <div className="relative group w-full md:w-48 h-32 rounded-2xl overflow-hidden shrink-0">
                      <img 
                        src={heroImageUrl} 
                        alt="Hero Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback if local image fails to load
                          console.error("Image load error:", heroImageUrl);
                        }}
                      />
                      <button 
                        onClick={() => setHeroImageUrl('')}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-8 h-8 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full md:w-48 h-32 rounded-2xl bg-white/5 flex flex-col items-center justify-center border-2 border-dashed border-white/10 shrink-0">
                       <ImageIcon className="w-8 h-8 text-white/20 mb-2" />
                       <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Sin Imagen</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest leading-relaxed">
                      Recomendado: 1920x1080px. Máximo 10MB.
                      Esta imagen aparecerá en el fondo de la pantalla de inicio.
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                      <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {heroImageUrl ? 'Reemplazar Imagen' : 'Subir Imagen'}
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </label>
                      {heroImageUrl && (
                        <button 
                          onClick={() => setHeroImageUrl('')}
                          className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-all"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Texto del Footer</label>
                <input 
                  type="text"
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-brand outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Email de Contacto</label>
              <input 
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between glass p-6 rounded-2xl border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#ff4e00]/10 rounded-xl flex items-center justify-center">
                    <Languages className="w-5 h-5 text-[#ff4e00]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase italic">Idioma Mixe</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Etiquetas en Mixe</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEnableMixe(!enableMixe)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${enableMixe ? 'bg-[#ff4e00]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableMixe ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between glass p-6 rounded-2xl border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase italic">Mantenimiento</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Bloquear acceso público</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${maintenanceMode ? 'bg-red-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${maintenanceMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Security & AI Section */}
          <div className="glass p-10 rounded-[3rem] space-y-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#ff4e00] mb-4">Seguridad e IA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between glass p-6 rounded-2xl border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase italic">Registros</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Permitir nuevos usuarios</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRegistrationEnabled(!registrationEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${registrationEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${registrationEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  Sensibilidad de Moderación IA
                </label>
                <select
                  value={moderationSensitivity}
                  onChange={(e) => setModerationSensitivity(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] outline-none transition-all"
                >
                  <option value="low">Baja (Permisiva)</option>
                  <option value="medium">Media (Equilibrada)</option>
                  <option value="high">Alta (Estricta)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Social Media Section */}
          <div className="glass p-10 rounded-[3rem] space-y-8">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#ff4e00] mb-4">Redes Sociales</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-600/20">
                  <Facebook className="w-6 h-6 text-blue-600" />
                </div>
                <input 
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-400/10 rounded-2xl flex items-center justify-center border border-sky-400/20">
                  <Twitter className="w-6 h-6 text-sky-400" />
                </div>
                <input 
                  type="url"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="https://twitter.com/..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-sky-400 transition-all"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-pink-600/10 rounded-2xl flex items-center justify-center border border-pink-600/20">
                  <Instagram className="w-6 h-6 text-pink-600" />
                </div>
                <input 
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm outline-none focus:border-pink-600 transition-all"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#ff4e00] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all disabled:opacity-50 shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
          >
            {saving ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Save className="w-6 h-6" /> Guardar Toda la Configuración</>
            )}
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
