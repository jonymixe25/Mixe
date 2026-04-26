import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Room, RoomEvent, Track, VideoTrack, AudioTrack } from 'livekit-client';
import { useLiveKitToken } from '../hooks/useLiveKitToken';
import { Video, Mic, MicOff, VideoOff, PhoneOff, Users, Loader2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';

export default function PrivateConference() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  
  const { token, url: liveKitUrl, error: tokenError } = useLiveKitToken(roomId || '', user?.uid || `user_${Math.random().toString(36).substring(2, 7)}`);

  useEffect(() => {
    if (tokenError) {
      setToast({ message: `Error de conexión: ${tokenError}`, type: 'error', isVisible: true });
      setConnectionStatus('error');
    }
  }, [tokenError]);

  useEffect(() => {
    if (!token || !liveKitUrl || !roomId || roomRef.current) return;

    const connectToRoom = async () => {
      try {
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Video) {
            const element = track.attach();
            if (remoteVideoRef.current) {
              remoteVideoRef.current.innerHTML = '';
              remoteVideoRef.current.appendChild(element);
            }
          } else if (track.kind === Track.Kind.Audio) {
            track.attach();
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
          track.detach().forEach(el => el.remove());
        });

        await room.connect(liveKitUrl, token);
        setConnectionStatus('connected');

        // Publish local tracks
        await room.localParticipant.enableCameraAndMicrophone();
        
        // Render local track
        const localVideoPublication = Array.from(room.localParticipant.videoTrackPublications.values())[0];
        const localVideoTrack = localVideoPublication?.videoTrack as VideoTrack;
        if (localVideoTrack && localVideoRef.current) {
          const element = localVideoTrack.attach();
          localVideoRef.current.innerHTML = '';
          localVideoRef.current.appendChild(element);
        }

      } catch (err) {
        console.error('Failed to connect to private room:', err);
        setConnectionStatus('error');
        setToast({ message: 'No se pudo establecer la conexión privada.', type: 'error', isVisible: true });
      }
    };

    connectToRoom();

    return () => {
      roomRef.current?.disconnect();
    };
  }, [token, liveKitUrl, roomId]);

  const toggleMic = async () => {
    if (!roomRef.current) return;
    const enabled = !isMicEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    setIsMicEnabled(enabled);
  };

  const toggleCam = async () => {
    if (!roomRef.current) return;
    const enabled = !isCamEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(enabled);
    setIsCamEnabled(enabled);
  };

  const handleLeave = () => {
    roomRef.current?.disconnect();
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#ff4e00]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ff4e00]/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#ff4e00]/10 border border-[#ff4e00]/20 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#ff4e00]" />
          </div>
          <div>
            <h1 className="text-lg font-display font-black uppercase tracking-tighter text-white italic">Conferencia Privada</h1>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Conexión Encriptada de Punto a Punto
            </p>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl">
          <Users className="w-4 h-4 text-white/40" />
          <span className="text-xs font-mono text-white/60 tracking-wider">Sala: {roomId?.substring(0, 8)}...</span>
        </div>
      </header>

      {/* Video Grid */}
      <main className="flex-1 p-6 flex flex-col md:flex-row gap-6 z-10">
        <div className="flex-1 relative bg-[#111114] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group">
          <div ref={remoteVideoRef} className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 opacity-40">
              <Loader2 className="w-10 h-10 animate-spin text-[#ff4e00]" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Esperando al otro participante...</p>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white">Invitado</span>
          </div>
        </div>

        <div className="w-full md:w-[320px] aspect-video md:aspect-[3/4] relative bg-[#111114] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-xl">
          <div ref={localVideoRef} className="w-full h-full flex items-center justify-center" />
          {!isCamEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]">
              <VideoOff className="w-10 h-10 text-white/10" />
            </div>
          )}
          <div className="absolute bottom-6 left-6 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ff4e00] rounded-full" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white">Tú</span>
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className="p-8 flex items-center justify-center gap-6 z-10">
        <button
          onClick={toggleMic}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${
            isMicEnabled 
            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
            : 'bg-red-500 border-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
          }`}
        >
          {isMicEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
        </button>

        <button
          onClick={handleLeave}
          className="w-20 h-14 bg-red-500 hover:bg-red-600 text-white rounded-2xl flex items-center justify-center transition-all shadow-[0_0_30px_rgba(239,68,68,0.4)] group active:scale-95"
        >
          <PhoneOff className="w-7 h-7 group-hover:rotate-[135deg] transition-transform duration-300" />
        </button>

        <button
          onClick={toggleCam}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border ${
            isCamEnabled 
            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' 
            : 'bg-red-500 border-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
          }`}
        >
          {isCamEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </button>
      </footer>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
