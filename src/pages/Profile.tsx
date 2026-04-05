import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, updateDoc, handleFirestoreError } from '../firebase';
import { OperationType } from '../types';
import { User, Mail, Shield, Calendar, Edit3, Save, X, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ImageUpload from '../components/ImageUpload';
import Toast from '../components/Toast';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
          <User className="w-6 h-6 text-[#ff4e00]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase italic"><span>Mi Perfil</span></h1>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
        {/* Header/Cover Placeholder */}
        <div className="h-32 bg-gradient-to-r from-[#ff4e00]/20 to-[#ff4e00]/5 relative" />
        
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6 flex items-end justify-between">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] bg-[#0a0502] p-1 shadow-2xl">
                <div className="w-full h-full rounded-[2.2rem] overflow-hidden border-2 border-white/10 relative">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt="profile" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2">
                <ImageUpload 
                  onUploadComplete={handlePhotoUpdate}
                  currentImageUrl=""
                  label=""
                  folder="profiles"
                />
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="mb-4 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/10"
            >
              {isEditing ? <X className="w-5 h-5 text-red-500" /> : <Edit3 className="w-5 h-5 text-[#ff4e00]" />}
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-2"><span>Nombre de Usuario</span></label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-2"><span>Biografía</span></label>
                    <textarea 
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] outline-none transition-all min-h-[120px] resize-none"
                      placeholder="Cuéntanos algo sobre ti..."
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-[#ff4e00] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#ff4e00]/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight"><span>{user.displayName}</span></h2>
                    <p className="text-white/60 italic mt-2 leading-relaxed">
                      <span>{user.bio || 'Sin biografía.'}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Mail className="w-5 h-5 text-[#ff4e00]/60" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40"><span>Correo</span></p>
                        <p className="text-sm font-medium"><span>{user.email}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Shield className="w-5 h-5 text-[#ff4e00]/60" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40"><span>Rol</span></p>
                        <p className="text-sm font-medium capitalize"><span>{user.role}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                      <Calendar className="w-5 h-5 text-[#ff4e00]/60" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40"><span>Miembro desde</span></p>
                        <p className="text-sm font-medium">
                          <span>{user.createdAt ? format(user.createdAt.toDate(), "d 'de' MMMM, yyyy", { locale: es }) : 'Reciente'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
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
