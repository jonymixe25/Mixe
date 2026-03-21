import React, { useState, useRef } from 'react';
import { storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  label?: string;
  currentImageUrl?: string | null;
  folder?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUploadComplete, 
  label = "Subir Imagen", 
  currentImageUrl,
  folder = "uploads"
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Firebase
    setUploading(true);
    try {
      const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      onUploadComplete(url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error al subir la imagen. Por favor, intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest text-white/40">{label}</label>
      <div 
        className={`relative aspect-video rounded-2xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center ${
          preview ? 'border-transparent' : 'border-white/10 hover:border-[#ff4e00]/50 bg-white/5'
        }`}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={clearImage}
                className="p-2 bg-red-500/20 backdrop-blur-md rounded-full hover:bg-red-500/40 transition-colors"
              >
                <X className="w-5 h-5 text-red-500" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 text-white/20 hover:text-white/40 transition-colors"
          >
            <Upload className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Seleccionar Archivo</span>
          </button>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-[#ff4e00] animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Subiendo...</span>
          </div>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default ImageUpload;
