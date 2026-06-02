import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { 
  Folder, Upload, Download, FileText, Trash2, Search, X, 
  Image as ImageIcon, Video, Music, Copy, Check, Loader2, 
  File, HelpCircle, HardDrive, Filter, Eye, AlertCircle, Calendar,
  ArrowRight, ShieldCheck, Share2, ZoomIn, FileCheck
} from 'lucide-react';
import Toast from '../components/Toast';

const FileStorage: React.FC = () => {
  const { user } = useAuth();
  
  // File management state
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'audio' | 'documents' | 'others'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Utility action state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Immersive Lightbox preview state
  const [previewImage, setPreviewImage] = useState<any | null>(null);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchFiles();
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchFiles = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { ref, listAll, getDownloadURL, getMetadata, storage } = await import('../firebase');
      const folderPath = `users/${user.uid}/files/`;
      const storageRef = ref(storage, folderPath);
      
      const res = await listAll(storageRef);
      const fileData = await Promise.all(res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        let size = 0;
        let timeCreated = new Date();
        let contentType = '';
        
        try {
          const meta = await getMetadata(itemRef);
          size = meta.size || 0;
          timeCreated = meta.timeCreated ? new Date(meta.timeCreated) : new Date();
          contentType = meta.contentType || '';
        } catch (e) {
          console.warn('Could not load metadata for file:', itemRef.name, e);
        }

        // Parse visual display name (removing unique prefixes if possible)
        let displayName = itemRef.name;
        const matches = itemRef.name.match(/^\d+_[a-z0-9]+_(.+)$/);
        if (matches && matches[1]) {
          displayName = matches[1];
        }

        return {
          rawName: itemRef.name,
          name: displayName,
          url,
          size,
          timeCreated,
          contentType
        };
      }));

      // Sort by creation date newest first
      fileData.sort((a, b) => b.timeCreated.getTime() - a.timeCreated.getTime());
      
      setFiles(fileData);
    } catch (error) {
      console.error('Error fetching files:', error);
      showToast('Error al cargar la lista de archivos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileCategory = (name: string, contentType: string = ''): 'images' | 'videos' | 'audio' | 'documents' | 'others' => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const type = contentType.toLowerCase();
    
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
      return 'images';
    }
    if (type.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
      return 'videos';
    }
    if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
      return 'audio';
    }
    if (
      type.startsWith('text/') ||
      type.includes('pdf') ||
      type.includes('word') ||
      type.includes('excel') ||
      type.includes('powerpoint') ||
      ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md', 'json'].includes(ext)
    ) {
      return 'documents';
    }
    return 'others';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'images': return <ImageIcon className="w-5 h-5 text-amber-500" />;
      case 'videos': return <Video className="w-5 h-5 text-indigo-500" />;
      case 'audio': return <Music className="w-5 h-5 text-emerald-500" />;
      case 'documents': return <FileText className="w-5 h-5 text-blue-500" />;
      default: return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryColorClass = (category: string) => {
    switch (category) {
      case 'images': return 'bg-amber-500/10 border-amber-500/20 text-amber-600';
      case 'videos': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600';
      case 'audio': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600';
      case 'documents': return 'bg-blue-500/10 border-blue-500/20 text-blue-600';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-600';
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadSingleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadSingleFile(e.target.files[0]);
    }
  };

  const uploadSingleFile = async (file: File) => {
    if (!user) return;
    
    // Strict max file size block (50MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast('El archivo excede el límite de 50MB', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const { ref, uploadBytesResumable, getDownloadURL, storage } = await import('../firebase');
      
      const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(7);
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filename = `${uniqueId}_${cleanName}`;
      const storageRef = ref(storage, `users/${user.uid}/files/${filename}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading file:', error);
          showToast('Error al subir el archivo: ' + error.message, 'error');
          setUploading(false);
        },
        async () => {
          await fetchFiles();
          showToast('Archivo subido con éxito', 'success');
          setUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      );
    } catch (error: any) {
      console.error('Error uploading file:', error);
      showToast('Error al inicializar la subida', 'error');
      setUploading(false);
    }
  };

  const handleCopyLink = async (rawName: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(rawName);
      showToast('Enlace copiado al portapapeles', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  const handleDeleteClick = (file: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFileToDelete(file);
  };

  const executeDelete = async () => {
    if (!fileToDelete || !user) return;
    setDeleting(true);
    try {
      const { ref, deleteObject, storage } = await import('../firebase');
      const storageRef = ref(storage, `users/${user.uid}/files/${fileToDelete.rawName}`);
      
      await deleteObject(storageRef);
      await fetchFiles();
      showToast('Archivo eliminado', 'success');
    } catch (error: any) {
      console.error('Error deleting file:', error);
      showToast('No se pudo eliminar el archivo', 'error');
    } finally {
      setDeleting(false);
      setFileToDelete(null);
      setPreviewImage(null); // Also close preview if open
    }
  };

  // State calculations
  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (activeTab === 'all') return true;
    return getFileCategory(file.rawName, file.contentType) === activeTab;
  });

  const storageUsageStats = files.reduce((acc, file) => {
    const cat = getFileCategory(file.rawName, file.contentType);
    acc.totalSize += file.size;
    acc.count += 1;
    acc[cat] = (acc[cat] || 0) + file.size;
    return acc;
  }, { totalSize: 0, count: 0, images: 0, videos: 0, audio: 0, documents: 0, others: 0 } as any);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-4 border border-amber-500/20">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-black font-sans">Acceso Restringido</h3>
        <p className="text-black/60 max-w-sm mb-6 bg-white/[0.2] p-3 rounded-lg border border-black/[0.04]">
          Debes iniciar sesión con tu cuenta para acceder a tu almacenamiento de archivos personal.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Toast alert system */}
      <Toast message={toastMessage} type={toastType} isVisible={toastVisible} onClose={() => setToastVisible(false)} />

      {/* Styled Minimalist Header Hero Banner */}
      <div className="mb-12 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1e1b18] via-[#2a1a15] to-[#120f0e] p-8 md:p-12 text-white shadow-xl shadow-black/10 border border-white/[0.04]">
        {/* Subtle glowing accent background orb */}
        <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 w-96 h-96 rounded-full bg-brand/10 blur-[100px] pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 -translate-x-12 w-64 h-64 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/20 border border-brand/30 text-brand text-xs font-bold tracking-wider uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Espacio Cifrado & Personal
            </span>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2 leading-[1.1]">
              Mi Almacén de Archivos
            </h1>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed font-medium">
              Almacena, visualiza y comparte tus contenidos en la nube de forma rápida y segura. Disfruta de un centro integrado con previsualización interactiva de imágenes.
            </p>
          </div>
          
          <div className="flex md:flex-col items-start gap-4 md:gap-2.5 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 shrink-0 self-start md:self-auto min-w-[200px]">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
              <HardDrive className="w-4 h-4 text-brand" /> ESPACIO TOTAL
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              {formatBytes(storageUsageStats.totalSize)}
            </div>
            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block animate-pulse" /> Activo y Sincronizado
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Stats & Instant Drag Uploader */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Enhanced Dropzone Panel */}
          <div 
            onDragEnter={handleDrag} 
            onDragOver={handleDrag} 
            onDragLeave={handleDrag} 
            onDrop={handleDrop}
            className={`relative rounded-[2rem] p-8 border-2 border-dashed transition-all duration-500 text-center bg-white/[0.6] backdrop-blur-md shadow-lg flex flex-col items-center justify-center ${
              dragActive 
                ? 'border-brand bg-brand/[0.03] scale-[1.01] shadow-brand/5' 
                : 'border-black/[0.1] hover:border-black/[0.2] hover:bg-white/[0.8]'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              onChange={handleFileInputChange} 
              className="hidden" 
              id="file-upload-input"
            />
            
            {/* Ambient Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 rounded-[2rem] pointer-events-none" />

            <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-brand/10 to-brand/[0.04] text-brand flex items-center justify-center mb-5 border border-brand/10 group-hover:scale-105 transition-transform">
              {uploading ? (
                <div className="relative">
                  <Loader2 className="w-10 h-10 animate-spin text-brand" />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono text-brand">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
              ) : (
                <Upload className="w-10 h-10" />
              )}
            </div>

            <h3 className="text-lg font-extrabold text-black mb-1 relative z-10">
              {uploading ? 'Subiendo contenido...' : 'Haz tu subida al instante'}
            </h3>
            <p className="text-xs text-black/50 mb-6 max-w-[240px] mx-auto leading-relaxed relative z-10">
              Arrastra y suelta tu archivo aquí o usa el buscador de tu ordenador. Límite de 50MB.
            </p>

            {uploading ? (
              <div className="w-full space-y-3 relative z-10 bg-black/5 p-4 rounded-2xl border border-black/[0.03]">
                <div className="flex justify-between text-xs font-mono font-bold text-black/70 px-1">
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-brand" /> Transfiriendo</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-black/10 h-2.5 rounded-full overflow-hidden p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.1 }}
                    className="h-full bg-gradient-to-r from-brand to-amber-500 rounded-full"
                  />
                </div>
              </div>
            ) : (
              <label 
                htmlFor="file-upload-input"
                className="w-full py-3.5 px-5 bg-brand hover:bg-brand/90 text-white rounded-2xl font-bold text-sm shadow-md shadow-brand/15 hover:shadow-brand/25 transition-all cursor-pointer flex items-center justify-center gap-2 border border-brand/10 active:scale-[0.98] select-none relative z-10"
              >
                <Folder className="w-4 h-4" />
                Examinar Archivos
                <ArrowRight className="w-4 h-4 ml-1" />
              </label>
            )}
          </div>

          {/* Premium Storage Bento Widget */}
          <div className="p-6 rounded-[2rem] border border-black/[0.06] bg-white/[0.6] backdrop-blur-md shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand/10 text-brand">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-black">Almacenamiento ocupado</h4>
                  <p className="text-xs font-mono font-bold text-black/40">{storageUsageStats.count} archivos activos</p>
                </div>
              </div>
              <div className="text-xs font-black px-2.5 py-1 rounded-full bg-black/5 border border-black/[0.04]">
                ESTADO
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs text-black/50 font-extrabold uppercase tracking-wider">Espacio acumulado</span>
                <span className="text-2xl font-black font-mono text-black">
                  {formatBytes(storageUsageStats.totalSize)}
                </span>
              </div>

              {/* Enhanced Visual Progress Bar segmented */}
              <div className="w-full bg-black/[0.07] h-3.5 rounded-full overflow-hidden flex p-0.5 border border-black/[0.02]">
                {storageUsageStats.totalSize > 0 ? (
                  <>
                    <div 
                      style={{ width: `${(storageUsageStats.images / storageUsageStats.totalSize) * 100}%` }} 
                      className="bg-amber-500 h-full rounded-l-full transition-all duration-500 hover:opacity-80"
                      title={`Fotos: ${formatBytes(storageUsageStats.images)}`}
                    />
                    <div 
                      style={{ width: `${(storageUsageStats.videos / storageUsageStats.totalSize) * 100}%` }} 
                      className="bg-indigo-500 h-full transition-all duration-500 hover:opacity-80"
                      title={`Videos: ${formatBytes(storageUsageStats.videos)}`}
                    />
                    <div 
                      style={{ width: `${(storageUsageStats.audio / storageUsageStats.totalSize) * 100}%` }} 
                      className="bg-emerald-500 h-full transition-all duration-500 hover:opacity-80"
                      title={`Audios: ${formatBytes(storageUsageStats.audio)}`}
                    />
                    <div 
                      style={{ width: `${(storageUsageStats.documents / storageUsageStats.totalSize) * 100}%` }} 
                      className="bg-blue-500 h-full rounded-r-full transition-all duration-500 hover:opacity-80"
                      title={`Docs: ${formatBytes(storageUsageStats.documents)}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-black/5 rounded-full h-full" />
                )}
              </div>

              {/* Categoric Legend items as micro-cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-amber-500/[0.05] border border-amber-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-md bg-amber-500 block shrink-0" />
                    <span className="text-xs font-bold text-black/70 truncate">Fotos</span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-amber-700">{formatBytes(storageUsageStats.images)}</span>
                </div>
                
                <div className="p-2.5 rounded-xl bg-indigo-500/[0.05] border border-indigo-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-md bg-indigo-500 block shrink-0" />
                    <span className="text-xs font-bold text-black/70 truncate">Videos</span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-indigo-700">{formatBytes(storageUsageStats.videos)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 block shrink-0" />
                    <span className="text-xs font-bold text-black/70 truncate">Audios</span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-emerald-700">{formatBytes(storageUsageStats.audio)}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-blue-500/[0.05] border border-blue-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-md bg-blue-500 block shrink-0" />
                    <span className="text-xs font-bold text-black/70 truncate">Docs</span>
                  </div>
                  <span className="text-[11px] font-mono font-black text-blue-700">{formatBytes(storageUsageStats.documents)}</span>
                </div>
              </div>
            </div>

            {/* Explanatory Secure Shield */}
            <div className="flex items-start gap-2.5 pt-3 border-t border-black/[0.05] text-[11px] text-black/55 leading-relaxed font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>Todos tus archivos se almacenan de manera totalmente privada. Sólo tú puedes ver o eliminar estos elementos en tu espacio de usuario.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Search Filters & Advanced File Lists */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Controls Surface */}
          <div className="p-4 rounded-[1.75rem] border border-black/[0.06] bg-white/[0.6] backdrop-blur-md shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Advanced Search box container */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-black/40 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Buscar archivos por nombre o tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/[0.03] hover:bg-black/[0.05] focus:bg-white text-sm py-2.5 pl-11 pr-5 rounded-2xl border border-black/[0.04] focus:border-brand/30 outline-none transition-all placeholder-black/35 font-semibold text-black shadow-inner"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-black/30 hover:text-black hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Aesthetic View Mode Selector Buttons */}
            <div className="flex items-center gap-1.5 select-none bg-black/5 p-1 rounded-2xl border border-black/[0.03] self-end sm:self-auto shrink-0">
              <button 
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-2 py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-white text-black shadow-sm' 
                    : 'text-black/55 hover:text-black hover:bg-white/40'
                }`}
                title="Vista Cuadrícula"
              >
                <Filter className="w-3.5 h-3.5" /> Grid
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'list' 
                    ? 'bg-white text-black shadow-sm' 
                    : 'text-black/55 hover:text-black hover:bg-white/40'
                }`}
                title="Vista Lista"
              >
                <Folder className="w-3.5 h-3.5" /> Lista
              </button>
            </div>
          </div>

          {/* Luxury Filtering slider */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 select-none scrollbar-thin scrollbar-thumb-black/10">
            {(['all', 'images', 'videos', 'audio', 'documents', 'others'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const count = tab === 'all' 
                ? files.length 
                : files.filter(f => getFileCategory(f.rawName, f.contentType) === tab).length;

              // Give custom translations
              let displayName = 'Sin categorizar';
              if (tab === 'all') displayName = 'Todos';
              else if (tab === 'images') displayName = 'Imágenes';
              else if (tab === 'videos') displayName = 'Videos';
              else if (tab === 'audio') displayName = 'Audios';
              else if (tab === 'documents') displayName = 'Documentos';
              else if (tab === 'others') displayName = 'Otros';

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-4 rounded-full text-xs font-extrabold transition-all border shrink-0 flex items-center gap-2 ${
                    isActive 
                      ? 'bg-brand text-white border-brand shadow-md shadow-brand/10' 
                      : 'bg-white border-black/[0.06] text-black/60 hover:bg-black/[0.03] hover:text-black'
                  }`}
                >
                  <span className="capitalize">{displayName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${isActive ? 'bg-white/20 text-white' : 'bg-black/[0.05] text-black/50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Core File Exploration Engine */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 bg-white/[0.3] backdrop-blur-md border border-black/[0.06] rounded-[2rem] shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin text-brand mb-4" />
              <p className="text-black/50 text-sm font-bold tracking-tight">Sincronizando con tu almacenamiento...</p>
              <p className="text-black/30 text-xs mt-1">Espera un instante mientras cargamos tus metadatos rápidos.</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            /* Immersive Empty state */
            <div className="text-center py-20 px-8 bg-white/[0.4] backdrop-blur-md rounded-[2.5rem] border border-black/[0.05] flex flex-col items-center justify-center shadow-lg">
              <div className="w-20 h-20 rounded-full bg-black/[0.03] border border-black/[0.05] flex items-center justify-center mb-5 text-black/30 shadow-inner">
                <Search className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-extrabold text-black mb-1.5">No encontramos ningún archivo</h3>
              <p className="text-black/50 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
                {searchQuery 
                  ? 'No hay registros que coincidan con tu término de búsqueda. Intenta modificar la palabra clave.' 
                  : 'Aún no has guardado ningún elemento de esta categoría. ¡Sube un archivo usando el panel de la izquierda para comenzar!'}
              </p>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="py-2.5 px-5 rounded-xl bg-black text-white hover:bg-brand font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  Limpiar Búsqueda
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            
            /* Enhanced File Grid layout */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredFiles.map((file) => {
                  const category = getFileCategory(file.rawName, file.contentType);
                  const isImage = category === 'images';
                  const isCopied = copiedId === file.rawName;
                  
                  return (
                    <motion.div
                      key={file.rawName}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="group bg-white hover:bg-white/[0.9] border border-black/[0.06] hover:border-black/[0.12] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
                    >
                      {/* Premium Interactive Asset Frame */}
                      <div className="relative aspect-[4/3] bg-black/[0.03] border-b border-black/[0.04] flex items-center justify-center overflow-hidden">
                        {isImage ? (
                          <>
                            <img 
                              src={file.url} 
                              alt={file.name} 
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                            />
                            {/* Visual Layer overlays on hover */}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <button
                                onClick={() => setPreviewImage(file)}
                                className="p-3.5 rounded-full bg-white text-black font-bold flex items-center justify-center hover:scale-115 active:scale-95 transition-all shadow-xl shadow-black/10 gap-1.5"
                                title="Ver en pantalla completa"
                              >
                                <Eye className="w-5 h-5 text-brand" />
                                <span className="text-xs uppercase font-extrabold tracking-widest text-black">Ver</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className={`p-5 rounded-2xl border ${getCategoryColorClass(category)} transform group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                            {getCategoryIcon(category)}
                          </div>
                        )}

                        {/* Hover Overlay Buttons shortcut corner */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-350 transform translate-y-[-4px] group-hover:translate-y-0 z-10">
                          <button
                            onClick={() => handleCopyLink(file.rawName, file.url)}
                            className="p-2 rounded-xl bg-white/90 backdrop-blur-md border border-black/[0.06] text-black/60 hover:text-brand shadow-sm hover:scale-105 active:scale-95 transition-all"
                            title="Copiar enlace"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={file.url}
                            download={file.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl bg-white/90 backdrop-blur-md border border-black/[0.06] text-black/60 hover:text-brand shadow-sm hover:scale-105 active:scale-95 transition-all"
                            title="Descargar archivo"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Content Card Info pane */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <h4 
                              className="text-sm font-extrabold text-black break-all line-clamp-1 group-hover:text-brand cursor-pointer transition-colors" 
                              title={file.name}
                              onClick={() => isImage ? setPreviewImage(file) : null}
                            >
                              {file.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-mono text-black/40 font-bold">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span className="truncate flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-black/35" />
                              {file.timeCreated.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Footer element toggles */}
                        <div className="pt-3 mt-3.5 border-t border-black/[0.05] flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border font-sans select-none ${getCategoryColorClass(category)}`}>
                            {category === 'others' ? 'archivo' : category === 'audio' ? 'Audio' : category === 'images' ? 'Imagen' : category}
                          </span>
                          
                          <button
                            onClick={(e) => handleDeleteClick(file, e)}
                            className="p-2 text-black/30 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                            title="Eliminar archivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            
            /* Professional List rows layout table */
            <div className="rounded-[2rem] border border-black/[0.06] bg-white overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/[0.02] text-[11px] font-black uppercase tracking-wider text-black/40 border-b border-black/[0.06]">
                      <th className="py-4 px-5">Nombre del archivo</th>
                      <th className="py-4 px-5 hidden md:table-cell">Subido el</th>
                      <th className="py-4 px-5 hidden sm:table-cell">Tamaño</th>
                      <th className="py-4 px-5 text-right font-sans">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => {
                      const category = getFileCategory(file.rawName, file.contentType);
                      const isCopied = copiedId === file.rawName;
                      
                      return (
                        <tr 
                          key={file.rawName}
                          className="hover:bg-black/[0.015] border-b border-black/[0.04] group transition-colors"
                        >
                          {/* Main Row Info */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3.5">
                              <div className={`p-2.5 rounded-xl border shrink-0 ${getCategoryColorClass(category)} shadow-sm`}>
                                {getCategoryIcon(category)}
                              </div>
                              <div className="min-w-0">
                                <span 
                                  className="block text-sm font-extrabold text-black group-hover:text-brand cursor-pointer transition-colors truncate max-w-[180px] sm:max-w-xs md:max-w-md" 
                                  title={file.name}
                                  onClick={() => category === 'images' ? setPreviewImage(file) : null}
                                >
                                  {file.name}
                                </span>
                                <span className={`text-[9px] font-black font-sans uppercase tracking-widest md:hidden inline-block ${getCategoryColorClass(category)}`}>
                                  {category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Upload Date columns */}
                          <td className="py-3.5 px-5 hidden md:table-cell text-xs font-bold text-black/50 font-mono">
                            {file.timeCreated.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>

                          {/* File Byte display */}
                          <td className="py-3.5 px-5 hidden sm:table-cell text-xs font-bold text-black/50 font-mono">
                            {formatBytes(file.size)}
                          </td>

                          {/* Actions Panel rows */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {category === 'images' && (
                                <button
                                  onClick={() => setPreviewImage(file)}
                                  className="p-2 text-black/40 hover:text-brand bg-black/[0.03] hover:bg-brand/5 rounded-xl transition-all"
                                  title="Expandir vista preciosa"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleCopyLink(file.rawName, file.url)}
                                className="p-2 text-black/40 hover:text-brand bg-black/[0.03] hover:bg-brand/5 rounded-xl transition-all"
                                title="Copiar enlace"
                              >
                                {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                              <a
                                href={file.url}
                                download={file.name}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-black/40 hover:text-brand bg-black/[0.03] hover:bg-brand/5 rounded-xl transition-all"
                                title="Descargar"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={(e) => handleDeleteClick(file, e)}
                                className="p-2 text-black/30 hover:text-red-500 bg-black/[0.03] hover:bg-red-50 rounded-xl transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Immersive Lightroom / Preview Modal Dialog overlay */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#181615] rounded-[2.5rem] overflow-hidden max-w-5xl w-full relative z-10 shadow-2xl border border-white/5 flex flex-col md:flex-row h-auto max-h-[90vh]"
            >
              {/* Asset Frame viewport left of modal */}
              <div className="flex-1 bg-black/30 relative flex items-center justify-center p-4 min-h-[300px] md:min-h-0 max-h-[50vh] md:max-h-none overflow-hidden group">
                <img 
                  src={previewImage.url} 
                  alt={previewImage.name} 
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl select-none"
                />
                
                {/* Visual watermark subtle */}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md py-1.5 px-3 rounded-lg border border-white/10 text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-brand" /> Zoom interactivo listo
                </div>
              </div>

              {/* Specification layout right side bar inside lightroom */}
              <div className="w-full md:w-[360px] bg-[#1d1b1a] p-6 lg:p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/5 text-white">
                <div className="space-y-6">
                  {/* Title details */}
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-[#ff4e00] font-black flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Previsualización Galería
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-1 break-all leading-snug">
                      {previewImage.name}
                    </h3>
                  </div>

                  {/* Metadata spec List */}
                  <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10 text-xs text-gray-300 font-medium font-sans">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Formato:</span>
                      <span className="font-mono text-white">{previewImage.contentType || 'image/*'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Resolución:</span>
                      <span className="text-white">Fidelity Auto</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Peso:</span>
                      <span className="font-mono text-white">{formatBytes(previewImage.size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Registro:</span>
                      <span className="text-white">{previewImage.timeCreated.toLocaleDateString('es-MX', { dateStyle: 'long' })}</span>
                    </div>
                  </div>

                  {/* Copy Link controls built in preview */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Enlace del Recurso</label>
                    <div className="flex items-center gap-2 bg-black/40 rounded-xl p-2 border border-white/5 text-xs font-mono">
                      <input 
                        type="text" 
                        value={previewImage.url} 
                        readOnly 
                        className="bg-transparent border-none outline-none flex-1 overflow-x-hidden text-gray-400 select-all" 
                      />
                      <button
                        onClick={() => handleCopyLink(previewImage.rawName, previewImage.url)}
                        className="p-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 transition-all select-none"
                      >
                        {copiedId === previewImage.rawName ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Micro Actions bar below preview list */}
                <div className="pt-6 mt-6 border-t border-white/5 flex flex-col gap-2.5">
                  <a
                    href={previewImage.url}
                    download={previewImage.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-white text-black text-center font-bold text-sm lg:text-sm rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Descargar Imagen
                  </a>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyLink(previewImage.rawName, previewImage.url)}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-white/10"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Compartir
                    </button>
                    <button
                      onClick={() => handleDeleteClick(previewImage)}
                      className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </div>
              </div>

              {/* Absolutes corner action controls bar inside Lightroom preview modal override */}
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 rounded-full border border-white/10 text-white hover:bg-black/90 active:scale-95 transition-all outline-none"
                title="Cerrar vista"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Delete Dialog overlay */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blurring effect */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFileToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Dialog container frame */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full relative z-10 shadow-2xl border border-black/[0.06]"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm shadow-red-200">
                <Trash2 className="w-6 h-6 animate-bounce" />
              </div>

              <h3 className="text-xl font-bold text-black mb-1.5 font-sans">¿Eliminar este archivo?</h3>
              <p className="text-sm text-black/60 mb-5 leading-relaxed leading-relaxed font-semibold font-sans">
                Estás a punto de eliminar <span className="font-bold text-black break-all">"{fileToDelete.name}"</span> permanentemente de tu almacenamiento en la nube. Esta acción no se puede deshacer.
              </p>

              <div className="flex gap-3 justify-end font-sans">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setFileToDelete(null)}
                  className="py-2.5 px-4 bg-black/[0.05] hover:bg-black/[0.1] text-black font-bold text-sm rounded-xl transition-colors active:scale-95 disabled:opacity-50 select-none"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={executeDelete}
                  className="py-2.5 px-4 bg-red-500 hover:bg-red-650 text-white font-bold text-sm rounded-xl shadow-md shadow-red-500/15 transition-colors active:scale-95 disabled:opacity-50 inline-flex items-center gap-2 select-none"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : 'Eliminar permanentemente'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileStorage;
