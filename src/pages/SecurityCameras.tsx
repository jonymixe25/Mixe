import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, handleFirestoreError } from '../firebase';
import { CameraDevice, OperationType } from '../types';
import ReactPlayer from 'react-player/lazy';
import { 
  Shield, 
  Cctv, 
  Wifi, 
  Bluetooth, 
  Link as LinkIcon, 
  Plus, 
  Trash2, 
  Settings, 
  AlertCircle, 
  Signal, 
  Eye,
  Loader2,
  X,
  Lock,
  Globe,
  Camera,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';

const CameraStream: React.FC<{ camera: CameraDevice }> = ({ camera }) => {
  const [hasError, setHasError] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const updateOnlineStatus = async (isOnline: boolean) => {
    // Only update if it actually changed to avoid unnecessary writes
    if (camera.isOnline === isOnline && isOnline) return;
    
    try {
      await updateDoc(doc(db, 'cameras', camera.id), { 
        isOnline
      });
    } catch (error) {
      console.error('Error updating camera status:', error);
      handleFirestoreError(error, OperationType.UPDATE, `cameras/${camera.id}`);
    }
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
    setHasError(false);
  };

  // Determine if it looks like an MJPEG stream (common for IP cams)
  const isMJPEG = camera.url.toLowerCase().includes('mjpeg') || 
                  camera.url.toLowerCase().includes('cgi-bin/v') ||
                  camera.url.toLowerCase().includes('?action=stream');

  // Check for mixed content
  const isMixedContent = window.location.protocol === 'https:' && camera.url.startsWith('http:');

  if (hasError || isMJPEG || isMixedContent) {
    return (
      <div key={key} className={`relative w-full h-full bg-black group/stream ${isFullscreen ? 'fixed inset-0 z-[300]' : ''}`}>
        <img 
          src={camera.url} 
          alt={camera.name}
          className="w-full h-full object-contain"
          onLoad={() => updateOnlineStatus(true)}
          onError={() => {
            setHasError(true);
            updateOnlineStatus(false);
          }}
        />
        <div className="absolute top-4 right-4 pointer-events-auto flex gap-2">
          <button 
            onClick={handleRefresh}
            className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        {(hasError || isMixedContent) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest text-red-500">
              {isMixedContent ? 'Bloqueo de Seguridad (HTTPS)' : 'Error de Conexión'}
            </p>
            <p className="text-xs text-white/60 mt-2 max-w-[200px]">
              {isMixedContent 
                ? 'El navegador bloquea cámaras "http" en sitios "https". Haz clic en el ícono de candado en la barra de direcciones y permite "Contenido no seguro" para ver esta cámara.' 
                : `No se pudo conectar a la transmisión en ${camera.url}`}
            </p>
            <button 
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-[10px] font-bold hover:bg-white/20 transition-colors"
            >
              REINTENTAR CONEXIÓN
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div key={key} className={`relative w-full h-full bg-black group/stream ${isFullscreen ? 'fixed inset-0 z-[300]' : ''}`}>
      <ReactPlayer
        url={camera.url}
        playing={playing}
        muted={muted}
        width="100%"
        height="100%"
        onReady={() => updateOnlineStatus(true)}
        onBuffer={() => console.log('Buffering...')}
        onBufferEnd={() => updateOnlineStatus(true)}
        onError={() => {
          setHasError(true);
          updateOnlineStatus(false);
        }}
        className="react-player"
        playsinline
      />
      
      {/* Custom Controls Overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/stream:opacity-100 transition-opacity flex flex-col justify-between p-4 pointer-events-none">
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-widest drop-shadow-md">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors text-white"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-center items-center pointer-events-auto">
          <button 
            onClick={() => setPlaying(!playing)}
            className="w-12 h-12 bg-brand/80 backdrop-blur-xl rounded-full flex items-center justify-center text-white shadow-xl transform scale-90 hover:scale-100 transition-transform"
          >
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </button>
        </div>

        <div className="flex justify-start pointer-events-auto">
          <button 
            onClick={() => setMuted(!muted)}
            className="p-2 bg-white/10 backdrop-blur-md rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const SecurityCameras: React.FC = () => {
  const { user } = useAuth();
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [newCamera, setNewCamera] = useState({
    name: '',
    url: '',
    type: 'ip' as 'ip' | 'wifi' | 'bluetooth',
    location: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const path = 'cameras';
    const q = query(collection(db, path), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cameraList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CameraDevice[];
      setCameras(cameraList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const path = editingCameraId ? `cameras/${editingCameraId}` : 'cameras';
    try {
      // Validate URL simple check
      if (!newCamera.url.startsWith('http')) {
        throw new Error('La URL debe comenzar con http:// o https://');
      }

      if (editingCameraId) {
        await updateDoc(doc(db, 'cameras', editingCameraId), {
          name: newCamera.name,
          url: newCamera.url,
          type: newCamera.type,
          location: newCamera.location,
        });
      } else {
        await addDoc(collection(db, 'cameras'), {
          userId: user.uid,
          name: newCamera.name,
          url: newCamera.url,
          type: newCamera.type,
          location: newCamera.location,
          isOnline: true,
          createdAt: serverTimestamp()
        });
      }

      setIsAdding(false);
      setEditingCameraId(null);
      setNewCamera({ name: '', url: '', type: 'ip', location: '' });
      setToast({
        message: editingCameraId ? 'Cámara actualizada' : 'Cámara vinculada exitosamente',
        type: 'success',
        isVisible: true
      });
    } catch (error: any) {
      console.error('Error saving camera:', error);
      setToast({
        message: error.message || 'Error al guardar la cámara',
        type: 'error',
        isVisible: true
      });
    }
  };

  const handleEditCamera = (camera: CameraDevice) => {
    setNewCamera({
      name: camera.name,
      url: camera.url,
      type: camera.type,
      location: camera.location || ''
    });
    setEditingCameraId(camera.id);
    setIsAdding(true);
  };

  const handleDeleteCamera = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta cámara?')) return;
    
    const path = `cameras/${id}`;
    try {
      await deleteDoc(doc(db, 'cameras', id));
      setToast({
        message: 'Cámara eliminada',
        type: 'success',
        isVisible: true
      });
    } catch (error) {
      console.error('Error deleting camera:', error);
      handleFirestoreError(error, OperationType.DELETE, path);
      setToast({
        message: 'Error al eliminar la cámara',
        type: 'error',
        isVisible: true
      });
    }
  };

  const handleDeleteAllCameras = async () => {
    if (cameras.length === 0) return;
    if (!window.confirm('¿Estás seguro de eliminar TODAS las cámaras? Esta acción no se puede deshacer.')) return;
    
    try {
      const deletePromises = cameras.map(camera => deleteDoc(doc(db, 'cameras', camera.id)));
      await Promise.all(deletePromises);
      setToast({
        message: 'Todas las cámaras han sido eliminadas',
        type: 'success',
        isVisible: true
      });
    } catch (error) {
      console.error('Error deleting all cameras:', error);
      setToast({
        message: 'Error al eliminar las cámaras',
        type: 'error',
        isVisible: true
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wifi': return <Wifi className="w-4 h-4" />;
      case 'bluetooth': return <Bluetooth className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const groupedCameras = cameras.reduce((acc, camera) => {
    const loc = camera.location || 'Sin Ubicación';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(camera);
    return acc;
  }, {} as Record<string, CameraDevice[]>);

  const stats = {
    total: cameras.length,
    online: cameras.filter(c => c.isOnline).length,
    offline: cameras.filter(c => !c.isOnline).length
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 mt-12 bg-[var(--card-bg)] rounded-[2.5rem] border border-[var(--border-color)]">
        <div className="w-20 h-20 bg-brand/10 rounded-3xl flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-brand" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">Centro de Seguridad</h2>
        <p className="text-black/50 dark:text-white/50 max-w-sm">
          Inicia sesión para gestionar tus cámaras de seguridad y ver transmisiones en vivo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Centro de Seguridad</h1>
            <p className="text-black/40 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Monitoreo en vivo Vida Mixe</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cameras.length > 0 && (
            <button
              onClick={handleDeleteAllCameras}
              className="px-4 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95 text-sm"
              title="Borrar todas las cámaras"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Borrar Todas</span>
            </button>
          )}
          <button
            onClick={() => setIsAdding(true)}
            className="px-6 py-3 bg-brand text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Vincular Nueva Cámara
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {!loading && cameras.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[2rem] flex items-center gap-4">
            <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Total Dispositivos</p>
              <p className="text-xl font-display font-bold">{stats.total}</p>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[2rem] flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
              <Signal className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">En Línea</p>
              <p className="text-xl font-display font-bold text-emerald-500">{stats.online}</p>
            </div>
          </div>
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-6 rounded-[2rem] flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">Sin Conexión</p>
              <p className="text-xl font-display font-bold text-red-500">{stats.offline}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-video rounded-[2rem] bg-black/[0.03] dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : cameras.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-dashed border-[var(--border-color)] rounded-[2.5rem] py-20 px-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl flex items-center justify-center mb-6 text-black/10 dark:text-white/10">
            <Cctv className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold mb-2">No hay cámaras vinculadas</h3>
          <p className="text-black/40 dark:text-white/40 text-sm max-w-xs mx-auto mb-8">
            Vincula tus cámaras WiFi, IP o Bluetooth para monitorear tu hogar o negocio desde cualquier lugar.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="px-8 py-3 bg-brand text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            Configura tu primera cámara
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedCameras).map(([location, locationCameras]) => (
            <div key={location} className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <h2 className="text-lg font-display font-bold">{location}</h2>
                <div className="h-px flex-1 bg-[var(--border-color)] opacity-50" />
                <span className="text-[10px] font-bold text-black/30 dark:text-white/30 uppercase tracking-widest">
                  {locationCameras.length} {locationCameras.length === 1 ? 'Cámara' : 'Cámaras'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {locationCameras.map(camera => (
                  <motion.div
                    layout
                    key={camera.id}
                    className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[2rem] overflow-hidden group hover:shadow-2xl transition-all duration-500"
                  >
                    <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                      <CameraStream camera={camera} />
                      
                      {/* Overlays */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 backdrop-blur-md rounded-full border ${
                          camera.isOnline 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}>
                          <Signal className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">
                            {camera.isOnline ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-4 flex items-center gap-3">
                        <div className="p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                          {getTypeIcon(camera.type)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-sm tracking-tight drop-shadow-lg">{camera.name}</span>
                          <span className="text-white/50 text-[10px] font-mono drop-shadow-md">{camera.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                          camera.isOnline 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/10'
                        }`}>
                          <Eye className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {camera.isOnline ? 'Visualizando' : 'Error'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-black/30 dark:text-white/30 uppercase tracking-widest">
                          {camera.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditCamera(camera)}
                          className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-black/40 dark:text-white/40"
                          title="Editar cámara"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCamera(camera.id)}
                          className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-500/60 hover:text-red-500"
                          title="Eliminar cámara"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Camera Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
                    {editingCameraId ? <Settings className="w-6 h-6" /> : <LinkIcon className="w-6 h-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold">{editingCameraId ? 'Editar Cámara' : 'Vincular Cámara'}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">WiFi • IP • Bluetooth</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingCameraId(null);
                  }}
                  className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-colors text-black/30"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddCamera} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/50 ml-1">Nombre de la Cámara</label>
                    <input
                      type="text"
                      required
                      value={newCamera.name}
                      onChange={e => setNewCamera({...newCamera, name: e.target.value})}
                      placeholder="Ej: Entrada Principal, Cochera..."
                      className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-2xl px-5 py-4 text-sm font-semibold transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/50 ml-1">Tipo de Conexión</label>
                      <select
                        value={newCamera.type}
                        onChange={e => setNewCamera({...newCamera, type: e.target.value as any})}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-2xl px-5 py-4 text-sm font-semibold transition-all appearance-none"
                      >
                        <option value="ip">IP Estática (LAN)</option>
                        <option value="wifi">WiFi Directo</option>
                        <option value="bluetooth">Bluetooth Low Energy</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/50 ml-1">Ubicación</label>
                      <input
                        type="text"
                        value={newCamera.location}
                        onChange={e => setNewCamera({...newCamera, location: e.target.value})}
                        placeholder="Ej: Interior / Exterior"
                        className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-2xl px-5 py-4 text-sm font-semibold transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/50 ml-1">Preconfiguraciones de Modelos</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Links Bits VIG-07', url: 'http://USUARIO:CONTRASEÑA@IP:80/video.mjpg', type: 'ip' },
                        { name: 'Mí VIG-07 (Links Bits)', url: 'http://jonyoax95@gmail.com:Djfenix1.@192.168.100.65/video.mjpg', type: 'ip' },
                        { name: 'Generic V380', url: 'rtsp://admin:password@IP:554/live/ch0', type: 'wifi' },
                        { name: 'TP-Link Tapo', url: 'rtsp://admin:password@IP:554/stream1', type: 'wifi' }
                      ].map(preset => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setNewCamera({
                            ...newCamera,
                            name: preset.name,
                            url: preset.url,
                            type: preset.type as any
                          })}
                          className="px-3 py-1.5 bg-brand/5 border border-brand/10 hover:bg-brand/10 rounded-full text-[9px] font-bold text-brand transition-colors"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/50">Dirección IP o URL de Stream</label>
                      <button
                        type="button"
                        onClick={() => setNewCamera({...newCamera, url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', name: 'Demo Stream (HLS)', type: 'ip'})}
                        className="text-[9px] font-bold text-brand hover:underline"
                      >
                        Cargar Demo
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={newCamera.url}
                        onChange={e => setNewCamera({...newCamera, url: e.target.value})}
                        placeholder="http://192.168.1.100/stream"
                        className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-2xl px-5 py-4 pl-12 text-sm font-mono font-bold transition-all"
                      />
                      <Globe className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-black/20" />
                    </div>
                    <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                      <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Guía de Conexión</span>
                      </div>
                      <ul className="space-y-1 text-[9px] text-black/50 dark:text-white/50 leading-relaxed list-disc ml-3">
                        <li><strong>HTTPS Requerido:</strong> La mayoría de navegadores bloquean cámaras HTTP si el sitio es HTTPS.</li>
                        <li><strong>Credenciales:</strong> Evita usar <code className="bg-black/5 px-1">http://user:pass@ip</code> ya que Chrome lo bloquea.</li>
                        <li><strong>MJPEG:</strong> Usa URLs que devuelvan imágenes (ej. <code className="bg-black/5 px-1">/video.mjpg</code>).</li>
                        <li><strong>WebRTC/HLS:</strong> Recomendado para baja latencia (ej. <code className="bg-black/5 px-1">.m3u8</code>).</li>
                        <li><strong>CORS:</strong> Tu cámara debe permitir peticiones desde este dominio.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] font-bold text-sm hover:bg-black/[0.06] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 rounded-2xl bg-brand text-white font-bold text-sm shadow-lg shadow-brand/20 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {editingCameraId ? 'Guardar Cambios' : 'Vincular Dispositivo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default SecurityCameras;
