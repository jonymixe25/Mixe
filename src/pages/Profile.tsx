import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, updateDoc, handleFirestoreError } from '../firebase';
import { User, Mail, Shield, Save, Camera, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import ImageUpload from '../components/ImageUpload';
import { OperationType } from '../types';

import Toast from '../components/Toast';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
        photoURL,
      });
      setToast({ message: 'Perfil actualizado correctamente.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      setToast({ message: 'Error al actualizar el perfil.', type: 'error', isVisible: true });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
          <User className="w-6 h-6 text-[#ff4e00]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase italic">Mi Perfil</h1>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-[200px]">
            <ImageUpload 
              onUploadComplete={(url) => setPhotoURL(url)}
              label="Foto de Perfil"
              currentImageUrl={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
              folder="profiles"
            />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{user.displayName}</h2>
            <p className="text-white/40 text-sm">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Nombre Público</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:border-[#ff4e00] focus:ring-1 focus:ring-[#ff4e00] outline-none transition-all"
                placeholder="Tu nombre"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Biografía</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 focus:border-[#ff4e00] focus:ring-1 focus:ring-[#ff4e00] outline-none transition-all min-h-[120px] resize-none"
              placeholder="Cuéntanos sobre ti..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-white/20" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Email</p>
                <p className="text-sm truncate">{user.email}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
              <Shield className="w-5 h-5 text-white/20" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Rol</p>
                <p className="text-sm capitalize">{user.role}</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#ff4e00] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#ff4e00]/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </form>
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
