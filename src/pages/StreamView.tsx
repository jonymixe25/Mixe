import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, increment, handleFirestoreError, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Users, Heart, MessageSquare, Share2, X, Radio, Volume2, Play, Pause, Maximize, VolumeX, Settings, Send, Image as ImageIcon, Loader2, Camera, UserPlus, Linkedin, PictureInPicture2, Gauge, Clock, CheckCircle2, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality } from "@google/genai";
import { useAuth } from '../AuthContext';

import Toast from '../components/Toast';

const StreamView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stream, setStream] = useState<StreamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [isUploadingChatImage, setIsUploadingChatImage] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [joinStatus, setJoinStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
  const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
  const [guestFacingMode, setGuestFacingMode] = useState<'user' | 'environment'>('user');
  const guestVideoRef = useRef<HTMLVideoElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  
  // Video Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isCameraPreviewActive, setIsCameraPreviewActive] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const videoRef = useRef<HTMLVideoElement>(null);
  const localPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // WebRTC Viewer State
  const pc = useRef<RTCPeerConnection | null>(null);
  const guestPc = useRef<RTCPeerConnection | null>(null);
  const signalingUnsubscribes = useRef<(() => void)[]>([]);
  const signalingId = user?.uid || Math.random().toString(36).substring(7);

  useEffect(() => {
    if (!id || !user) return;
    // ... existing stream and chat listeners ...

    const streamRef = doc(db, 'streams', id);
    const unsubscribe = onSnapshot(streamRef, (doc) => {
      if (doc.exists()) {
        setStream({ id: doc.id, ...doc.data() } as StreamSession);
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `streams/${id}`);
    });

    // Chat listener
    const chatQuery = query(
      collection(db, 'streams', id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChat(messages);
    }, (error) => {
      console.error('Chat error:', error);
    });

    // Increment viewer count
    const updateViewerCount = async (val: number) => {
      try {
        await updateDoc(streamRef, {
          viewerCount: increment(val)
        });
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.UPDATE, `streams/${id}`);
        } catch (e) {
          if ((e as any).isQuotaError) throw e;
          console.error('Background update error:', e);
        }
      }
    };

    updateViewerCount(1);

    // Join Request Listener
    const requestRef = doc(db, 'streams', id, 'joinRequests', user.uid);
    const unsubscribeRequest = onSnapshot(requestRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setJoinStatus(data.status);
        if (data.status === 'accepted' && !guestStream) {
          setupGuestSender();
        }
      } else {
        setJoinStatus('none');
      }
    });

    // WebRTC Viewer Setup
    const setupWebRTC = async () => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pc.current = peerConnection;

      // Handle incoming tracks
      peerConnection.ontrack = (event) => {
        console.log('Received remote tracks:', event.streams);
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionStatus('connected');
        }
      };

      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (peerConnection.connectionState === 'failed') {
          setConnectionStatus('failed');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = collection(db, 'streams', id, 'signaling', signalingId, 'viewerCandidates');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      };

      // Create signaling document
      const viewerRef = doc(db, 'streams', id, 'signaling', signalingId);
      await setDoc(viewerRef, {
        status: 'new',
        createdAt: serverTimestamp()
      });

      // Listen for offer
      const unsubOffer = onSnapshot(viewerRef, async (snapshot) => {
        const data = snapshot.data();
        if (data?.offer && peerConnection.signalingState === 'stable') {
          const offer = new RTCSessionDescription(data.offer);
          await peerConnection.setRemoteDescription(offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          await updateDoc(viewerRef, {
            answer: {
              type: answer.type,
              sdp: answer.sdp
            },
            status: 'answered'
          });
        }
      }, (error) => {
        console.error('Offer signaling error:', error);
      });

      // Listen for admin ICE candidates
      const adminCandidatesRef = collection(db, 'streams', id, 'signaling', signalingId, 'adminCandidates');
      const unsubIce = onSnapshot(adminCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      }, (error) => {
        console.error('ICE signaling error:', error);
      });

      return () => {
        unsubOffer();
        unsubIce();
        peerConnection.close();
      };
    };

    const cleanupWebRTC = setupWebRTC();

    return () => {
      unsubscribe();
      unsubscribeChat();
      unsubscribeRequest();
      updateViewerCount(-1);
      
      cleanupWebRTC.then(cleanup => cleanup?.());
      signalingUnsubscribes.current.forEach(unsub => unsub());
      signalingUnsubscribes.current = [];

      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
      if (guestPc.current) {
        guestPc.current.close();
        guestPc.current = null;
      }
      if (guestStream) {
        guestStream.getTracks().forEach(track => track.stop());
      }
      if (localPreviewStream) {
        localPreviewStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [id, navigate]);

  const setupGuestSender = async () => {
    if (!id || !user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: guestFacingMode }, 
        audio: true 
      });
      setGuestStream(stream);
      if (guestVideoRef.current) {
        guestVideoRef.current.srcObject = stream;
      }

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      guestPc.current = peerConnection;

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesRef = collection(db, 'streams', id, 'guestSignaling', user.uid, 'guestCandidates');
          addDoc(candidatesRef, event.candidate.toJSON());
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const guestSignalingRef = doc(db, 'streams', id, 'guestSignaling', user.uid);
      await setDoc(guestSignalingRef, {
        offer: { type: offer.type, sdp: offer.sdp },
        createdAt: serverTimestamp()
      });

      const unsubAnswer = onSnapshot(guestSignalingRef, async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && peerConnection.signalingState !== 'stable') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      }, (error) => {
        console.error('Guest answer signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubAnswer);

      const adminCandidatesRef = collection(db, 'streams', id, 'guestSignaling', user.uid, 'adminCandidates');
      const unsubIce = onSnapshot(adminCandidatesRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            peerConnection.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      }, (error) => {
        console.error('Guest ICE signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubIce);

    } catch (error) {
      console.error('Error setting up guest sender:', error);
    }
  };

  const handleJoinRequest = async () => {
    if (!id || !user) return;
    try {
      await setDoc(doc(db, 'streams', id, 'joinRequests', user.uid), {
        userId: user.uid,
        userName: user.displayName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setToast({
        message: 'Solicitud enviada al anfitrión',
        type: 'success',
        isVisible: true
      });
    } catch (error) {
      console.error('Error sending join request:', error);
    }
  };

  const toggleGuestCamera = async () => {
    const newMode = guestFacingMode === 'user' ? 'environment' : 'user';
    setGuestFacingMode(newMode);
    if (guestStream) {
      guestStream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newMode }, 
        audio: true 
      });
      setGuestStream(newStream);
      if (guestVideoRef.current) {
        guestVideoRef.current.srcObject = newStream;
      }
      // In a real app, you'd need to replace the track in the RTCPeerConnection
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const speak = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !id) return;

    const msgText = message.trim();
    setMessage('');

    try {
      await addDoc(collection(db, 'streams', id, 'messages'), {
        userId: user.uid,
        userName: user.displayName,
        text: msgText,
        createdAt: serverTimestamp(),
      });

      // Simulate TTS for certain keywords
      if (msgText.toLowerCase().includes('hola')) {
        speak(`¡Hola ${user.displayName}! Bienvenido a la transmisión.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `streams/${id}/messages`);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;

    setIsUploadingChatImage(true);
    setChatUploadProgress(0);
    try {
      const { storage, ref, uploadBytesResumable, getDownloadURL } = await import('../firebase');
      const storageRef = ref(storage, `chat/${id}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setChatUploadProgress(p);
        },
        (error) => {
          console.error('Error uploading chat image:', error);
          setIsUploadingChatImage(false);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'streams', id, 'messages'), {
            userId: user.uid,
            userName: user.displayName,
            imageUrl: url,
            createdAt: serverTimestamp(),
          });
          setIsUploadingChatImage(false);
          setChatUploadProgress(0);
          if (chatImageInputRef.current) chatImageInputRef.current.value = '';
        }
      );
    } catch (error) {
      console.error('Error starting chat image upload:', error);
      setIsUploadingChatImage(false);
    }
  };

  const handleLike = async () => {
    if (!id) return;
    if (!user) {
      setToast({
        message: 'Debes iniciar sesión para dar me gusta',
        type: 'error',
        isVisible: true
      });
      return;
    }

    setIsLiked(!isLiked);
    try {
      await updateDoc(doc(db, 'streams', id), {
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      console.error('Error updating likes:', error);
      setIsLiked(isLiked); // Rollback
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setToast({
      message: '¡Enlace copiado al portapapeles!',
      type: 'success',
      isVisible: true
    });
  };

  const shareToLinkedIn = () => {
    const url = window.location.href;
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank');
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.parentElement?.requestFullscreen();
      }
    }
  };

  const togglePiP = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const toggleCameraPreview = async () => {
    if (isCameraPreviewActive) {
      if (localPreviewStream) {
        localPreviewStream.getTracks().forEach(track => track.stop());
      }
      setLocalPreviewStream(null);
      setIsCameraPreviewActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setLocalPreviewStream(stream);
        setIsCameraPreviewActive(true);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setToast({ message: 'No se pudo acceder a la cámara', type: 'error', isVisible: true });
      }
    }
  };

  useEffect(() => {
    if (isCameraPreviewActive && localPreviewVideoRef.current && localPreviewStream) {
      localPreviewVideoRef.current.srcObject = localPreviewStream;
    }
  }, [isCameraPreviewActive, localPreviewStream]);

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return 'LIVE';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
    </div>
  );

  if (!user) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
        <Users className="w-10 h-10 text-white/20" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase italic"><span>Inicia sesión para ver</span></h2>
        <p className="text-white/40 italic"><span>Debes estar registrado para unirte a las transmisiones en vivo.</span></p>
      </div>
    </div>
  );

  if (!stream) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Video Player Section */}
      <div className="lg:col-span-3 space-y-8">
        <div 
          className="aspect-video bg-[#0a0502] rounded-[3rem] overflow-hidden border border-white/10 relative shadow-2xl shadow-[#ff4e00]/5 group ring-1 ring-white/5"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Real-time WebRTC Video Element */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted={isMuted}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />

          {isCameraPreviewActive && localPreviewStream && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-24 right-8 w-1/5 aspect-video bg-[#0a0502] rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xl z-30 ring-4 ring-emerald-500/10"
            >
              <video
                ref={localPreviewVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20">
                <span>Mi Cámara</span>
              </div>
            </motion.div>
          )}

          {guestStream && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute bottom-24 right-8 w-1/4 aspect-video bg-[#0a0502] rounded-2xl overflow-hidden border-2 border-[#ff4e00] shadow-2xl z-30 ring-4 ring-[#ff4e00]/10"
            >
              <video
                ref={guestVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${guestFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border border-[#ff4e00]/20">
                <span>Tú</span>
              </div>
              <button 
                onClick={toggleGuestCamera}
                className="absolute bottom-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-xl hover:bg-[#ff4e00] transition-all border border-white/10 active:scale-90"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {connectionStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0502]/80 backdrop-blur-md z-20">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-[#ff4e00]/10 rounded-full animate-spin border-t-[#ff4e00] shadow-[0_0_20px_rgba(255,78,0,0.2)]" />
                <Radio className="w-8 h-8 text-[#ff4e00] absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="mt-6 text-white font-black uppercase tracking-[0.3em] text-[10px]">
                <span>{connectionStatus === 'connecting' ? 'Conectando con el anfitrión...' : 'Error de conexión'}</span>
              </p>
              {connectionStatus === 'failed' && (
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 bg-[#ff4e00] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
                >
                  <span>Reintentar</span>
                </button>
              )}
            </div>
          )}
          
          {/* Overlay UI - Top */}
          <div className={`absolute top-0 left-0 right-0 p-8 flex items-center justify-between transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex items-center gap-4">
              <div className="bg-red-600/90 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl border border-red-500/20">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <span>Live</span>
              </div>
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-xl">
                <Users className="w-4 h-4 text-[#ff4e00]" />
                <span className="font-mono">{stream.viewerCount}</span>
              </div>
              {joinStatus === 'none' && user.uid !== stream.userId && (
                <button 
                  onClick={handleJoinRequest}
                  className="bg-[#ff4e00] px-6 py-2 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Unirse</span>
                </button>
              )}
              {joinStatus === 'pending' && (
                <div className="bg-white/5 backdrop-blur-md px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest italic text-white/40 border border-white/10">
                  <span>Solicitud pendiente...</span>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-black/40 backdrop-blur-md p-3 rounded-2xl hover:bg-red-500 transition-all border border-white/10 shadow-xl group active:scale-90"
            >
              <X className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* Overlay UI - Bottom Controls */}
          <div className={`absolute bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-[#0a0502] via-[#0a0502]/40 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex flex-col gap-6">
              {/* Seek Bar / Progress Bar */}
              {duration !== Infinity && duration > 0 && (
                <div className="relative group/seekbar h-8 flex items-center px-2">
                  <div className="absolute inset-x-2 h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-[#ff4e00] rounded-full relative shadow-[0_0_15px_rgba(255,78,0,0.5)]"
                      style={{ width: `${(currentTime / (duration || 100)) * 100}%` }}
                      layoutId="progress-bar"
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-2xl scale-0 group-hover/seekbar:scale-100 transition-transform duration-300 ring-4 ring-[#ff4e00]/20" />
                    </motion.div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 md:gap-8">
                  <button 
                    onClick={togglePlay} 
                    className="p-3 text-white hover:text-[#ff4e00] hover:scale-110 transition-all duration-300 active:scale-90"
                    title={isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    {isPlaying ? <Pause className="w-6 h-6 md:w-8 md:h-8 fill-current" /> : <Play className="w-6 h-6 md:w-8 md:h-8 fill-current" />}
                  </button>
                  
                  <div className="flex items-center gap-2 md:gap-4 group/volume">
                    <button 
                      onClick={toggleMute} 
                      className="p-3 text-white hover:text-[#ff4e00] transition-all duration-300 active:scale-90"
                      title={isMuted ? 'Activar sonido' : 'Silenciar'}
                    >
                      {isMuted || volume === 0 ? <VolumeX className="w-6 h-6 md:w-7 md:h-7" /> : <Volume2 className="w-6 h-6 md:w-7 md:h-7" />}
                    </button>
                    <div className="w-0 group-hover/volume:w-24 md:group-hover/volume:w-32 overflow-hidden transition-all duration-500 flex items-center">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-full accent-[#ff4e00] h-1.5 cursor-pointer shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-3 text-[10px] md:text-xs font-black tracking-[0.2em] text-white/80 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl">
                    {duration === Infinity ? (
                      <div className="flex items-center gap-3 text-red-500">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        <span>LIVE</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 opacity-40" />
                        <span className="font-mono">{formatTime(currentTime)}</span>
                        <span className="opacity-20">/</span>
                        <span className="font-mono opacity-40">{formatTime(duration)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-5">
                  <button 
                    onClick={toggleCameraPreview}
                    className={`p-3 rounded-2xl transition-all duration-500 shadow-xl border ${isCameraPreviewActive ? 'bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20' : 'text-white/60 hover:text-white hover:bg-white/10 border-white/10'}`}
                    title="Mostrar mi cámara"
                  >
                    <Camera className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <div className="relative">
                    <button 
                      onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                      className={`p-3 rounded-2xl transition-all duration-500 flex items-center gap-2 text-[10px] md:text-xs font-black tracking-widest border shadow-xl ${showSpeedMenu ? 'bg-[#ff4e00] text-white border-[#ff4e00]/20' : 'text-white/60 hover:text-white hover:bg-white/10 border-white/10'}`}
                      title="Velocidad de reproducción"
                    >
                      <Gauge className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="hidden xs:inline">{playbackRate}x</span>
                    </button>
                    
                    <AnimatePresence>
                      {showSpeedMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-6 bg-[#0a0502]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-3 min-w-[160px] z-50 shadow-2xl ring-1 ring-white/5"
                        >
                          <div className="px-4 py-3 border-b border-white/5 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Velocidad</span>
                          </div>
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                            <button
                              key={rate}
                              onClick={() => handlePlaybackRateChange(rate)}
                              className={`w-full text-left px-5 py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between group ${playbackRate === rate ? 'bg-[#ff4e00] text-white shadow-lg shadow-[#ff4e00]/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
                            >
                              <span>{rate}x</span>
                              {playbackRate === rate && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={togglePiP}
                    className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-500 border border-white/10 shadow-xl active:scale-90"
                    title="Picture in Picture"
                  >
                    <PictureInPicture2 className="w-5 h-5 md:w-6 md:h-6" />
                  </button>

                  <button 
                    onClick={toggleFullscreen} 
                    className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all duration-500 border border-white/10 shadow-xl active:scale-90"
                    title="Pantalla completa"
                  >
                    <Maximize className="w-5 h-5 md:w-6 md:h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stream Info Overlay (Always visible when controls are hidden) */}
          <div className={`absolute bottom-10 left-10 transition-opacity duration-500 pointer-events-none ${!showControls ? 'opacity-100' : 'opacity-0'}`}>
            <div className="space-y-2">
              <h1 className="text-4xl font-display font-black tracking-tighter uppercase italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"><span>{stream.title}</span></h1>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-[#ff4e00] rounded-full shadow-[0_0_8px_rgba(255,78,0,0.8)]" />
                <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] drop-shadow-lg"><span>{stream.userName}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/5 border border-white/10 rounded-[2.5rem] p-8 gap-8 shadow-xl">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-[#ff4e00] p-0.5 shadow-2xl shadow-[#ff4e00]/20">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`}
                alt="avatar"
                className="w-full h-full rounded-[1.4rem] bg-[#0a0502]"
              />
            </div>
            <div className="space-y-1">
              <h2 className="font-display font-black text-2xl uppercase italic tracking-tight"><span>{stream.userName}</span></h2>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#ff4e00]" />
                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]"><span>Streamer Mixe • Verificado</span></p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all duration-500 shadow-xl ${
                isLiked 
                  ? 'bg-red-500 text-white scale-105 shadow-red-500/20' 
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="flex items-center gap-2">
                <span>{isLiked ? '¡Me gusta!' : 'Me gusta'}</span>
                <span className="opacity-40 text-xs font-mono"><span>({stream.likes || 0})</span></span>
              </span>
            </button>
            <div className="flex gap-3">
              <button 
                onClick={handleShare}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-all shadow-xl active:scale-90"
                title="Copiar enlace"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button 
                onClick={shareToLinkedIn}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:bg-[#0077b5] hover:border-[#0077b5] hover:text-white transition-all shadow-xl active:scale-90"
                title="Compartir en LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 shadow-xl relative overflow-hidden group">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#ff4e00]/5 rounded-full blur-[100px] group-hover:bg-[#ff4e00]/10 transition-all duration-1000" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6 flex items-center gap-3">
            <Radio className="w-4 h-4 text-[#ff4e00]" />
            <span>Descripción de la Transmisión</span>
          </h2>
          <p className="text-white/70 text-lg leading-relaxed italic font-medium max-w-4xl">
            <span>{stream.description || 'El streamer no ha proporcionado una descripción para esta transmisión.'}</span>
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="lg:col-span-1 flex flex-col h-[calc(100vh-12rem)]">
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] flex-1 flex flex-col overflow-hidden shadow-2xl relative group">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#ff4e00]/5 rounded-full blur-[60px] group-hover:bg-[#ff4e00]/10 transition-all duration-1000" />
          
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
              <span>Chat en Vivo</span>
            </h3>
            <button 
              onClick={() => speak('Bienvenidos al chat')} 
              className="p-2 bg-white/5 rounded-xl text-white/20 hover:text-[#ff4e00] hover:bg-white/10 transition-all active:scale-90"
              title="Escuchar bienvenida"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide custom-scrollbar">
            <div className="text-center py-6">
              <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                <p className="text-[8px] text-white/20 uppercase tracking-[0.4em] font-black italic"><span>Comienzo de la transmisión</span></p>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {chat.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  key={msg.id}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                      <span>{msg.userName}</span>
                    </span>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  {msg.imageUrl ? (
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="mt-2 rounded-2xl overflow-hidden border border-white/10 max-w-[240px] shadow-xl"
                    >
                      <img src={msg.imageUrl} alt="chat" className="w-full h-auto" />
                    </motion.div>
                  ) : (
                    <p className={`text-sm p-4 rounded-[1.5rem] rounded-tl-none border italic leading-relaxed ${msg.userId === user?.uid ? 'bg-emerald-500/10 text-emerald-50 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-white/5 text-white/80 border-white/10 shadow-lg'}`}>
                      <span>{msg.text}</span>
                    </p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-6 bg-[#0a0502]/40 backdrop-blur-xl border-t border-white/10">
            <div className="relative flex gap-3">
              <input
                type="file"
                ref={chatImageInputRef}
                onChange={handleChatImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button 
                type="button"
                onClick={() => chatImageInputRef.current?.click()}
                disabled={isUploadingChatImage}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 relative overflow-hidden group active:scale-90"
              >
                {isUploadingChatImage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-[#ff4e00] transition-all duration-300"
                      style={{ width: `${chatUploadProgress}%` }}
                    />
                  </>
                ) : (
                  <ImageIcon className="w-5 h-5 group-hover:text-[#ff4e00] transition-colors" />
                )}
              </button>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enviar mensaje..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-[#ff4e00] hover:scale-110 transition-all disabled:opacity-30 active:scale-90"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      {/* Toast Notification */}
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default StreamView;
