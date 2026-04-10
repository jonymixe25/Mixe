import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, updateDoc, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { User, Mail, Shield, Calendar, Edit3, Save, X, Camera, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import ImageUpload from '../components/ImageUpload';
import Toast from '../components/Toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [city, setCity] = useState(user?.city || '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood || '');
  const [streetAndNumber, setStreetAndNumber] = useState(user?.streetAndNumber || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || '');
  const [socialLinks, setSocialLinks] = useState(user?.socialLinks || []);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  if (!user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        displayNameLowercase: displayName.toLowerCase(),
        bio,
        city,
        neighborhood,
        streetAndNumber,
        dateOfBirth,
        socialLinks,
      });
      setToast({ message: 'Perfil actualizado con éxito.', type: 'success', isVisible: true });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setToast({ message: 'Error al actualizar el perfil.', type: 'error', isVisible: true });
    } finally {
      setLoading(false);
    }
  };

  const addSocialLink = () => {
    setSocialLinks([...socialLinks, { platform: '', url: '' }]);
  };

  const updateSocialLink = (index: number, field: 'platform' | 'url', value: string) => {
    const newLinks = [...socialLinks];
    newLinks[index][field] = value;
    setSocialLinks(newLinks);
  };

  const removeSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const handlePhotoUpdate = async (url: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: url });
      setToast({ message: 'Foto de perfil actualizada.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 relative">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <User className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Perfil de Usuario</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Mi Espacio</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Personaliza tu identidad y gestiona tu información en la plataforma.</span>
          </p>
        </div>
        
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3 shadow-xl ${
            isEditing 
              ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
              : 'glass text-[#ff4e00] border-white/10 hover:bg-[#ff4e00] hover:text-white'
          }`}
        >
          {isEditing ? (
            <>
              <X className="w-4 h-4" />
              <span>Cancelar Edición</span>
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4" />
              <span>Editar Perfil</span>
            </>
          )}
        </button>
      </div>

      <div className="glass rounded-[3rem] overflow-hidden shadow-2xl border-white/10 relative">
        {/* Header/Cover Placeholder */}
        <div className="h-48 bg-gradient-to-br from-[#ff4e00]/30 via-[#ff4e00]/10 to-transparent relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#ff4e00]/20 rounded-full blur-3xl" />
        </div>
        
        <div className="px-10 lg:px-16 pb-16">
          <div className="relative -mt-24 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="relative group">
              <div className="w-44 h-44 rounded-[3rem] bg-[#0a0502] p-1.5 shadow-2xl ring-1 ring-white/10">
                <div className="w-full h-full rounded-[2.7rem] overflow-hidden border-2 border-white/10 relative group-hover:border-[#ff4e00]/50 transition-colors duration-500">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt="profile" 
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                    <Camera className="w-8 h-8 text-white animate-bounce" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/60">Actualizar Foto</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 scale-125">
                <ImageUpload 
                  onUploadComplete={handlePhotoUpdate}
                  currentImageUrl=""
                  label=""
                  folder="profiles"
                />
              </div>
            </div>

            {!isEditing && (
              <div className="flex flex-col gap-2 md:mb-4">
                <h2 className="text-4xl lg:text-5xl font-display font-black tracking-tighter uppercase italic leading-none">
                  {user.displayName}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[#ff4e00] rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Miembro Activo</span>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div 
                key="editing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Nombre de Usuario</label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all placeholder:text-white/20"
                      placeholder="Tu nombre público..."
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Biografía</label>
                    <div className="react-quill-container">
                      <ReactQuill 
                        theme="snow" 
                        value={bio} 
                        onChange={setBio}
                        className="bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:border-[#ff4e00] outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Redes Sociales</label>
                    <div className="space-y-2">
                      {socialLinks.map((link, index) => (
                        <div key={index} className="flex gap-2">
                          <input 
                            type="text" 
                            value={link.platform} 
                            onChange={(e) => updateSocialLink(index, 'platform', e.target.value)} 
                            placeholder="Plataforma (ej. Twitter)"
                            className="w-1/3 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm"
                          />
                          <input 
                            type="text" 
                            value={link.url} 
                            onChange={(e) => updateSocialLink(index, 'url', e.target.value)} 
                            placeholder="URL"
                            className="w-2/3 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm"
                          />
                          <button onClick={() => removeSocialLink(index)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                      <button onClick={addSocialLink} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4e00] mt-2">
                        <Plus className="w-4 h-4" /> Añadir Red Social
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Ciudad</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Colonia</label>
                    <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Calle y número</label>
                    <input type="text" value={streetAndNumber} onChange={(e) => setStreetAndNumber(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Fecha de nacimiento</label>
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all" />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full lg:w-auto bg-[#ff4e00] text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all duration-500 shadow-2xl shadow-[#ff4e00]/20 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-6 h-6" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div className="space-y-4 max-w-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4e00]">Biografía</h3>
                  <div 
                    className="text-xl text-white/60 italic leading-relaxed font-medium"
                    dangerouslySetInnerHTML={{ __html: bio || 'Este usuario aún no ha escrito su biografía. ¡Anímate a compartir algo sobre ti!' }}
                  />
                </div>

                {socialLinks.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4e00]">Redes Sociales</h3>
                    <div className="flex flex-wrap gap-4">
                      {socialLinks.map((link, index) => (
                        <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/5 rounded-xl text-sm font-medium hover:bg-[#ff4e00]/20 transition-colors">
                          {link.platform}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/10">
                  {[
                    { icon: Mail, label: 'Correo Electrónico', value: user.email, color: 'text-blue-500' },
                    { icon: Shield, label: 'Rol en la Plataforma', value: user.role, color: 'text-[#ff4e00]', capitalize: true },
                    { icon: Calendar, label: 'Miembro Desde', value: user.createdAt ? format(user.createdAt.toDate(), "d 'de' MMMM, yyyy", { locale: es }) : 'Reciente', color: 'text-purple-500' },
                    { icon: User, label: 'Ciudad', value: user.city || 'No especificada', color: 'text-green-500' },
                    { icon: User, label: 'Colonia', value: user.neighborhood || 'No especificada', color: 'text-yellow-500' },
                    { icon: User, label: 'Calle y número', value: user.streetAndNumber || 'No especificada', color: 'text-orange-500' },
                    { icon: Calendar, label: 'Fecha de nacimiento', value: user.dateOfBirth || 'No especificada', color: 'text-pink-500' }
                  ].map((item, i) => (
                    <div key={item.label} className="space-y-4 group">
                      <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#ff4e00]/30 transition-all duration-500`}>
                        <item.icon className={`w-6 h-6 ${item.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{item.label}</p>
                        <p className={`text-lg font-display font-bold ${item.capitalize ? 'capitalize' : ''}`}>{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default Profile;
