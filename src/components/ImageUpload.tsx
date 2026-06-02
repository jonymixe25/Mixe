import React, { useState, useRef, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp } from '../firebase';
import { Upload, X, Loader2, Image as ImageIcon, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import Toast from './Toast';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onUploading?: (uploading: boolean) => void;
  label?: string;
  currentImageUrl?: string | null;
  folder?: string;
  accept?: string;
  isPublic?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUploadComplete, 
  onUploading,
  label = "Subir Archivo", 
  currentImageUrl,
  folder = "uploads",
  accept = "image/*,video/*,audio/*,application/pdf",
  isPublic = false
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (onUploading) onUploading(uploading);
  }, [uploading, onUploading]);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync preview with currentImageUrl from parent
  useEffect(() => {
    setPreview(currentImageUrl || null);
    if (!currentImageUrl) {
      setSelectedFile(null);
    }
  }, [currentImageUrl]);

  const handleFile = async (file: File) => {
    setSelectedFile({ name: file.name, type: file.type });
    const sizeInMB = file.size / (1024 * 1024);

    // Local preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Upload to Firebase Storage
    setUploading(true);
    setProgress(0);
    
    try {
      const { ref, uploadBytesResumable, getDownloadURL, storage } = await import('../firebase');
      const sanitizedFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const targetFolder = folder === 'AUTO' ? sanitizedFileName : folder;
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `${targetFolder}/${filename}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          console.error('Error uploading file:', error);
          setToast({
            message: 'Error al subir el archivo: ' + (error.message || 'Error desconocido'),
            type: 'error',
            isVisible: true
          });
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Save metadata to Firestore if user is logged in
          if (user) {
            try {
              const { db, addDoc, collection, serverTimestamp } = await import('../firebase');
              await addDoc(collection(db, 'media'), {
                userId: user.uid,
                url,
                folder: targetFolder,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                isPublic,
                createdAt: serverTimestamp()
              });
            } catch (err) {
              console.error('Error saving media metadata:', err);
            }
          }

          onUploadComplete(url);
          setToast({
            message: `Archivo guardado (${sizeInMB.toFixed(1)} MB)`,
            type: 'success',
            isVisible: true
          });
          setUploading(false);
        }
      );
    } catch (error: any) {
      console.error('Error starting upload:', error);
      setToast({
        message: 'Error al iniciar la subida',
        type: 'error',
        isVisible: true
      });
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreview(null);
    setSelectedFile(null);
    onUploadComplete('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <FileText className="w-8 h-8" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="w-8 h-8" />;
    if (fileType.startsWith('video/')) return <Loader2 className="w-8 h-8 animate-pulse" />;
    if (fileType.startsWith('audio/')) return <CheckCircle className="w-8 h-8" />;
    if (fileType === 'application/pdf') return <FileText className="w-8 h-8" />;
    return <FileText className="w-8 h-8" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-black/50">{label}</label>
        {uploading && (
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest animate-pulse">
            Subiendo: {Math.round(progress)}%
          </span>
        )}
      </div>

      <div 
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative aspect-video rounded-3xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center group cursor-pointer ${
          preview || selectedFile ? 'border-transparent' : 'border-black/[0.06] hover:border-brand/50 bg-black/[0.03]'
        } ${uploading ? 'border-brand/50 bg-brand/5' : ''} ${isDragging ? 'border-brand bg-brand/10 scale-[0.98]' : ''}`}
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className={`w-full h-full object-cover transition-opacity ${uploading ? 'opacity-40' : 'opacity-100'}`} />
            {!uploading && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <div className="p-3 bg-black/[0.06] backdrop-blur-md rounded-xl hover:bg-black/20 transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <button 
                  type="button"
                  onClick={clearImage}
                  className="p-3 bg-red-500/20 backdrop-blur-md rounded-xl hover:bg-red-500/40 transition-colors"
                >
                  <X className="w-5 h-5 text-red-500" />
                </button>
              </div>
            )}
          </>
        ) : selectedFile ? (
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="w-16 h-16 bg-black/[0.03] rounded-xl flex items-center justify-center text-brand">
              {getFileIcon(selectedFile.type)}
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest block truncate max-w-[200px]">{selectedFile.name}</span>
              <span className="text-[10px] opacity-50 uppercase tracking-widest block">{selectedFile.type}</span>
            </div>
            {!uploading && (
              <div className="text-[10px] font-bold text-brand uppercase tracking-widest hover:underline mt-2">
                Click para cambiar archivo
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-black/30 hover:text-black/50 transition-all group-hover:scale-110">
            <div className="w-16 h-16 bg-black/[0.03] rounded-xl flex items-center justify-center">
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-center px-6">
              <span className="text-xs font-bold uppercase tracking-widest block">
                {isDragging ? '¡Suelta para subir!' : 'Seleccionar o Arrastrar'}
              </span>
              <span className="text-[10px] opacity-50 uppercase tracking-widest mt-1 block">Soporta más de 80MB</span>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-black/10 stroke-current"
                  strokeWidth="8"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                ></circle>
                <motion.circle
                  className="text-brand stroke-current"
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * progress) / 100 }}
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                ></motion.circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {Math.round(progress)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {uploading && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="h-1.5 w-full bg-black/[0.03] rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default ImageUpload;
