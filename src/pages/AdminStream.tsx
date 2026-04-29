import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where, handleFirestoreError, orderBy, limit, deleteDoc, getDocs } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Image as ImageIcon, Wand2, Send, Loader2, Heart, Clock, Trash2, Shield, Settings, Lock, Globe, Zap, Monitor, UserPlus, Check, X, Gauge, Activity, Pin, Layout, Share2, Maximize, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import ImageUpload from '../components/ImageUpload';
import { Room, RoomEvent, Track, VideoTrack, AudioTrack } from 'livekit-client';
import { useLiveKitToken } from '../hooks/useLiveKitToken';

export default function AdminStream() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStream, setActiveStream] = useState<StreamSession | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [category, setCategory] = useState('cultura');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [latency, setLatency] = useState<'normal' | 'low'>('normal');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [autoModerate, setAutoModerate] = useState(true);
  const [moderationSensitivity, setModerationSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [remoteParticipants, setRemoteParticipants] = useState<any[]>([]);
  const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [activeInvitations, setActiveInvitations] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const { token, url: liveKitUrl, error: tokenError } = useLiveKitToken(activeStream?.id || '', user?.uid || '');

  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    if (!activeStream || activeStream.status !== 'live') {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const start = activeStream.startedAt?.toDate ? activeStream.startedAt.toDate().getTime() : Date.now();
      const diff = Math.max(0, Date.now() - start);
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStream]);

  // Real-time Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploadingChatImage, setIsUploadingChatImage] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamStats, setStreamStats] = useState({ bitrate: 0, packetLoss: 0 });
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebRTC Broadcaster State
  const localStream = useRef<MediaStream | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    // ... existing active stream listener ...

    const q = query(
      collection(db, 'streams'),
      where('userId', '==', user.uid),
      where('status', '==', 'live')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Sort in memory to avoid index requirement for now, or just pick the first
        // In a real app, we'd use orderBy('startedAt', 'desc') with a composite index
        const streams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession));
        const latestStream = streams.sort((a, b) => {
          const timeA = a.startedAt?.toMillis?.() || 0;
          const timeB = b.startedAt?.toMillis?.() || 0;
          return timeB - timeA;
        })[0];
        
        setActiveStream(latestStream);
      } else {
        setActiveStream(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'streams');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (tokenError) {
      setToast({ message: `Error de LiveKit: ${tokenError}`, type: 'error', isVisible: true });
    }
  }, [tokenError]);

  useEffect(() => {
    if (!activeStream) {
      setChatMessages([]);
      return;
    }

    const chatQuery = query(
      collection(db, 'streams', activeStream.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setChatMessages(messages);
    }, (error) => {
      console.error('Chat error:', error);
    });

    return () => unsubscribeChat();
  }, [activeStream?.id]);

  useEffect(() => {
    if (!activeStream) return;

    const requestsRef = collection(db, 'streams', activeStream.id, 'joinRequests');
    const unsubscribe = onSnapshot(requestsRef, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJoinRequests(requests);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `streams/${activeStream.id}/joinRequests`);
    });

    return () => unsubscribe();
  }, [activeStream?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setModerationSensitivity(snapshot.data().moderationSensitivity || 'medium');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const setupCamera = async () => {
      if ((activeStream || isPreviewing) && videoRef.current) {
        try {
          // If we already have a stream and it's active, don't restart it unless facingMode changed
          if (localStream.current && localStream.current.active) {
            // Check if facingMode matches
            const videoTrack = localStream.current.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            // This is a rough check as settings.facingMode might not be supported everywhere
            if (settings.facingMode && settings.facingMode !== facingMode) {
              localStream.current.getTracks().forEach(track => track.stop());
            } else {
              if (videoRef.current.srcObject !== localStream.current) {
                videoRef.current.srcObject = localStream.current;
              }
              return;
            }
          }

          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: { facingMode: { ideal: facingMode } }, 
              audio: true 
            });
          } catch (e) {
            console.warn("Failed with facingMode, trying default video constraints", e);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
              });
            } catch (e2) {
              console.warn("Failed to get video, trying audio only", e2);
              stream = await navigator.mediaDevices.getUserMedia({ 
                video: false, 
                audio: true 
              });
              setToast({ message: 'No se pudo acceder al video, usando solo audio', type: 'error', isVisible: true });
            }
          }
          
          localStream.current = stream;
          setIsStreamReady(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraError(null);
        } catch (err) {
          console.error("Error accessing camera:", err);
          setCameraError(err instanceof Error ? err.message : 'Error al acceder a la cámara');
          setIsPreviewing(false);
        }
      } else {
        // Stop camera if not previewing and no active stream
        if (localStream.current) {
          localStream.current.getTracks().forEach(track => track.stop());
          localStream.current = null;
          setIsStreamReady(false);
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };

    setupCamera();
  }, [activeStream?.id, isPreviewing, facingMode]);

  useEffect(() => {
    let isMounted = true;

    const connectToLiveKit = async () => {
      if (activeStream && token && liveKitUrl && isStreamReady && localStream.current && !roomRef.current) {
        setConnectionStatus('connecting');
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            simulcast: true,
            videoCodec: 'vp8',
            stopMicTrackOnMute: true,
          },
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720 },
          }
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
            const element = track.attach();
            if (element instanceof HTMLVideoElement) {
              element.playsInline = true;
              element.autoplay = true;
            }
            if (remoteVideoContainerRef.current) {
              remoteVideoContainerRef.current.appendChild(element);
            }
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
          track.detach().forEach((element) => element.remove());
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          if (roomRef.current) {
            setRemoteParticipants(Array.from(roomRef.current.remoteParticipants.values()));
          }
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          if (roomRef.current) {
            setRemoteParticipants(Array.from(roomRef.current.remoteParticipants.values()));
          }
        });
        
        try {
          console.log('Conectando a LiveKit con URL:', liveKitUrl);
          await room.connect(liveKitUrl, token);
          
          if (!isMounted) {
            room.disconnect();
            return;
          }

          console.log('Conectado a LiveKit, preparando publicación...');
          
          // Pequeña espera para estabilizar la conexión antes de publicar
          await new Promise(resolve => setTimeout(resolve, 500));

          if (!isMounted) {
            room.disconnect();
            return;
          }

          // Publish tracks from the already running localStream
          const videoTrack = localStream.current.getVideoTracks()[0];
          const audioTrack = localStream.current.getAudioTracks()[0];
          
          if (videoTrack) {
            console.log('Publicando track de video...');
            await room.localParticipant.publishTrack(videoTrack, { 
              name: 'camera',
              source: Track.Source.Camera
            });
          }
          if (audioTrack) {
            console.log('Publicando track de audio...');
            await room.localParticipant.publishTrack(audioTrack, { 
              name: 'microphone',
              source: Track.Source.Microphone
            });
          }
          
          if (isMounted) {
            setConnectionStatus('connected');
            setRemoteParticipants(Array.from(room.remoteParticipants.values()));
            console.log('Connected and publishing to LiveKit');
          }
        } catch (err) {
          if (isMounted) {
            console.error("Error connecting to LiveKit:", err);
            // Ignore "Client initiated disconnect" as it's usually a cleanup side effect
            if (err instanceof Error && err.message.includes('Client initiated disconnect')) {
              return;
            }
            setConnectionStatus('error');
            setToast({
              message: `Error de streaming: ${err instanceof Error ? err.message : 'No se pudo conectar'}`,
              type: 'error',
              isVisible: true
            });
            roomRef.current = null;
          }
        }
      }
    };

    connectToLiveKit();

    return () => {
      isMounted = false;
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionStatus('idle');
    };
  }, [activeStream?.id, token, liveKitUrl, isStreamReady]);

  // Handle track updates when localStream changes (e.g. camera switch)
  useEffect(() => {
    const updateTracks = async () => {
      if (roomRef.current && roomRef.current.state === 'connected' && localStream.current) {
        try {
          // Unpublish old tracks
          const publications = roomRef.current.localParticipant.getTrackPublications();
          for (const pub of Array.from(publications.values())) {
            if (pub.track) {
              await roomRef.current.localParticipant.unpublishTrack(pub.track as any);
            }
          }

          // Publish new tracks
          const videoTrack = localStream.current.getVideoTracks()[0];
          const audioTrack = localStream.current.getAudioTracks()[0];
          
          if (videoTrack) await roomRef.current.localParticipant.publishTrack(videoTrack);
          if (audioTrack) await roomRef.current.localParticipant.publishTrack(audioTrack);
          
          console.log('Tracks updated in LiveKit room');
        } catch (err) {
          console.error("Error updating tracks:", err);
        }
      }
    };

    updateTracks();
  }, [localStream.current]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const startRecording = () => {
    if (!localStream.current) {
      setToast({ message: 'No hay stream disponible para grabar', type: 'error', isVisible: true });
      return;
    }

    recordedChunksRef.current = [];
    const mimeTypes = [
      'video/mp4;codecs=h264',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    if (!selectedMimeType) {
      setToast({ message: 'Tu navegador no soporta grabación de video', type: 'error', isVisible: true });
      return;
    }

    try {
      const recorder = new MediaRecorder(localStream.current, { mimeType: selectedMimeType });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        await saveRecording(blob, selectedMimeType);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setToast({ message: 'Grabación iniciada', type: 'success', isVisible: true });
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      setToast({ message: 'Error al iniciar la grabación del stream', type: 'error', isVisible: true });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveRecording = async (blob: Blob, mimeType: string) => {
    if (!user) return;
    
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `grabacion_${Date.now()}.${ext}`;
      const folder = `recordings/${user.uid}`;
      
      const formData = new FormData();
      formData.append('folder', folder);
      formData.append('file', blob, fileName);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error al subir la grabación');
      
      const data = await response.json();
      const downloadUrl = data.url;
      
      const recordingData = {
        userId: user.uid,
        url: downloadUrl,
        fileName,
        fileSize: blob.size,
        fileType: mimeType,
        streamId: activeStream?.id || 'manual',
        streamTitle: activeStream?.title || 'Grabación manual',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'recordings'), recordingData);

      // Also add to general media for the gallery
      await addDoc(collection(db, 'media'), {
        ...recordingData,
        folder: 'Transmisiones Guardadas',
        isPublic: false,
      });

      setToast({ message: 'Grabación guardada con éxito en tu galería', type: 'success', isVisible: true });
    } catch (err) {
      console.error('Error saving recording:', err);
      setToast({ message: 'Error al salvar la grabación localmente', type: 'error', isVisible: true });
    }
  };

  // Stream Stats Monitoring
  useEffect(() => {
    if (connectionStatus !== 'connected' || !roomRef.current) return;

    const interval = setInterval(async () => {
      if (!roomRef.current) return;
      
      const stats = await roomRef.current.localParticipant.getTrackPublications();
      let totalBitrate = 0;
      let maxPacketLoss = 0;

      // This is a simplified stats gathering
      setStreamStats({
        bitrate: Math.floor(Math.random() * 2000) + 1000, // Mocking for now as real-time bitrate requires more complex calculation
        packetLoss: Math.random() * 0.5
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [connectionStatus]);

  const toggleScreenShare = async () => {
    if (!roomRef.current) return;
    
    try {
      if (isScreenSharing) {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
      } else {
        await roomRef.current.localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      setToast({ message: 'Error al compartir pantalla', type: 'error', isVisible: true });
    }
  };

  const handlePinMessage = async (message: ChatMessage) => {
    if (!activeStream) return;
    try {
      // Unpin others first (simplified: just set the new one)
      setPinnedMessage(message);
      setToast({ message: 'Mensaje fijado', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const sendConferenceInvite = async (participant: any) => {
    if (!activeStream || !user) return;
    
    try {
      const invitationId = `${activeStream.id}_${participant.identity}`;
      const roomId = `private_${activeStream.id}_${participant.identity}_${Date.now()}`;
      
      await addDoc(collection(db, 'streams', activeStream.id, 'invitations'), {
        from: user.uid,
        fromName: user.displayName || 'Streamer',
        to: participant.identity,
        status: 'pending',
        roomId: roomId,
        createdAt: serverTimestamp()
      });
      
      setActiveInvitations(prev => ({ ...prev, [participant.identity]: 'pending' }));
      
      setToast({
        message: `Invitación enviada a ${participant.identity}`,
        type: 'success',
        isVisible: true
      });
    } catch (err) {
      console.error('Error sending invitation:', err);
      setToast({
        message: 'No se pudo enviar la invitación.',
        type: 'error',
        isVisible: true
      });
    }
  };

  useEffect(() => {
    if (!activeStream) return;
    
    const q = query(collection(db, 'streams', activeStream.id, 'invitations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invites: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        invites[doc.data().to] = doc.data().status;
      });
      setActiveInvitations(invites);
    }, (error) => {
      console.error('Invitations listener error:', error);
    });
    
    return () => unsubscribe();
  }, [activeStream]);

  const handleClearChat = async () => {
    if (!activeStream) return;
    if (!window.confirm('¿Estás seguro de que quieres borrar todos los mensajes?')) return;
    
    try {
      const messagesRef = collection(db, 'streams', activeStream.id, 'messages');
      const snapshot = await getDocs(messagesRef);
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'streams', activeStream.id, 'messages', d.id)));
      await Promise.all(deletePromises);
      setToast({ message: 'Chat borrado', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error clearing chat:', error);
      setToast({ message: 'Error al borrar el chat', type: 'error', isVisible: true });
    }
  };

  const handleStartStream = async () => {
    if (!user || !title) return;
    setLoading(true);
    try {
      // First, end any existing live streams for this user to avoid conflicts
      const q = query(
        collection(db, 'streams'),
        where('userId', '==', user.uid),
        where('status', '==', 'live')
      );
      const existingStreams = await getDocs(q);
      for (const streamDoc of existingStreams.docs) {
        await updateDoc(doc(db, 'streams', streamDoc.id), {
          status: 'ended',
          endedAt: serverTimestamp()
        });
      }

      const streamData = {
        userId: user.uid,
        userName: user.displayName,
        title,
        description,
        thumbnailUrl,
        category,
        privacy,
        latency,
        resolution,
        status: 'live',
        startedAt: serverTimestamp(),
        viewerCount: 0,
        likes: 0,
      };
      await addDoc(collection(db, 'streams'), streamData);
      // Don't set isPreviewing(false) immediately to keep camera running
      // The activeStream listener will trigger the UI switch
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'streams');
    } finally {
      // Keep loading true for a moment to allow the listener to catch up
      setTimeout(() => setLoading(false), 1000);
    }
  };

  const handleEndStream = async () => {
    if (!activeStream) return;
    setLoading(true);
    try {
      const streamRef = doc(db, 'streams', activeStream.id);
      await updateDoc(streamRef, {
        status: 'ended',
        endedAt: serverTimestamp(),
      });
      
      // Stop camera
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsPreviewing(false);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `streams/${activeStream.id}`);
    } finally {
      setLoading(false);
    }
  };

  const suggestTitle = async () => {
    setSuggesting(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Sugiere 3 títulos creativos y breves para una transmisión en vivo sobre cultura Mixe, tradiciones o música de la región. Devuelve solo los títulos separados por comas.",
      });
      const suggestions = response.text?.split(',') || [];
      if (suggestions.length > 0) {
        setTitle(suggestions[0].trim());
      }
    } catch (error) {
      console.error('Error suggesting title:', error);
    } finally {
      setSuggesting(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!activeStream) return;
    try {
      await updateDoc(doc(db, 'streams', activeStream.id, 'joinRequests', requestId), {
        status: 'accepted'
      });
      // Make stream private when it becomes a Duo session
      await updateDoc(doc(db, 'streams', activeStream.id), {
        privacy: 'private'
      });
      setToast({ message: 'Solicitud aceptada y modo dúo privado activado', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!activeStream) return;
    try {
      await updateDoc(doc(db, 'streams', activeStream.id, 'joinRequests', requestId), {
        status: 'rejected'
      });
      setToast({ message: 'Solicitud rechazada', type: 'success', isVisible: true });
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeStream) return;
    
    const msgText = newMessage.trim();
    setNewMessage('');

    // Auto-moderation logic with Gemini
    if (autoModerate) {
      try {
        const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');
        const ai = new GoogleGenAI({ apiKey });
        const sensitivityPrompt = 
          moderationSensitivity === 'high' ? 'Sé extremadamente estricto: bloquea cualquier mensaje que pueda ser remotamente ofensivo, spam, o que use lenguaje informal inapropiado.' :
          moderationSensitivity === 'low' ? 'Sé permisivo: bloquea solo insultos graves o spam evidente.' :
          'Bloquea mensajes ofensivos, spam o lenguaje inapropiado para una comunidad cultural.';

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Actúa como moderador de chat. ${sensitivityPrompt} Responde solo con "SI" (si debe ser bloqueado) o "NO" (si es aceptable): "${msgText}"`,
        });
        if (response.text?.trim().toUpperCase() === 'SI') {
          setToast({ message: 'Mensaje bloqueado por moderación automática.', type: 'error', isVisible: true });
          return;
        }
      } catch (error) {
        console.error('Moderation error:', error);
      }
    }

    try {
      await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
        userId: user.uid,
        userName: user.displayName,
        text: msgText,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `streams/${activeStream.id}/messages`);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeStream) return;
    try {
      await deleteDoc(doc(db, 'streams', activeStream.id, 'messages', messageId));
      setToast({ message: 'Mensaje eliminado.', type: 'success', isVisible: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `streams/${activeStream.id}/messages/${messageId}`);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeStream) return;

    setIsUploadingChatImage(true);
    setChatUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('folder', `chat/${activeStream.id}`);
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const p = (event.loaded / event.total) * 100;
          setChatUploadProgress(p);
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          const url = response.url;
          
          await addDoc(collection(db, 'streams', activeStream.id, 'messages'), {
            userId: user.uid,
            userName: user.displayName,
            imageUrl: url,
            createdAt: serverTimestamp(),
          });
          setIsUploadingChatImage(false);
          setChatUploadProgress(0);
          if (chatImageInputRef.current) chatImageInputRef.current.value = '';
        } else {
          throw new Error('Error en la subida');
        }
      };

      xhr.onerror = () => {
        throw new Error('Error de red');
      };

      xhr.send(formData);
    } catch (error: any) {
      console.error('Error uploading chat image:', error);
      setToast({ message: 'Error al subir la imagen', type: 'error', isVisible: true });
      setIsUploadingChatImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070504] text-white selection:bg-[#ff4e00]/30 -mx-4 md:-mx-8 lg:-mx-12 -mt-8">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-radial from-[#ff4e00]/10 to-transparent blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-radial from-[#3a1510]/30 to-transparent blur-[120px] opacity-40" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row h-screen lg:overflow-hidden">
        {/* Main Dashboard Area */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto lg:overflow-hidden">
          {/* Admin Header */}
          <header className="px-6 py-4 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div 
                onClick={() => navigate('/')}
                className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer group"
              >
                <ChevronLeft className="w-5 h-5 text-white/70 group-hover:-translate-x-1 transition-transform" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4e00]">Panel de Control</span>
                  {activeStream && (
                    <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                      <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-red-500">En Vivo</span>
                    </div>
                  )}
                </div>
                <h1 className="text-sm font-bold tracking-tight">Gestión de Transmisión</h1>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {activeStream && (
                <div className="hidden md:flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Duración</span>
                    <span className="text-sm font-mono font-bold text-[#ff4e00]">{elapsedTime}</span>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Audiencia</span>
                    <span className="text-sm font-mono font-bold">{activeStream.viewerCount}</span>
                  </div>
                </div>
              )}
              <button 
                onClick={() => setIsModalOpen(true)}
                disabled={!activeStream}
                className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-20 disabled:grayscale transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/20"
              >
                Finalizar
              </button>
            </div>
          </header>

          {/* Dashboard Main Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-hide">
            {/* Video Preview Stage */}
            <section className="relative aspect-video bg-black rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden border border-white/5 shadow-2xl group/player ring-1 ring-white/5">
              {(activeStream || isPreviewing) ? (
                <>
                  <div className="w-full h-full flex items-center justify-center bg-black [&>video]:max-w-full [&>video]:max-h-full [&>video]:w-full [&>video]:h-full [&>video]:object-contain" ref={remoteVideoContainerRef}>
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      className={`w-full h-full object-contain ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                      onLoadedMetadata={(e) => {
                        const video = e.target as HTMLVideoElement;
                        video.play().catch(err => {
                          if (err.name !== 'AbortError') console.error('Play error (admin):', err.message || err);
                        });
                      }}
                    />
                  </div>

                  {/* Status Badges */}
                  <div className="absolute top-6 left-6 right-6 flex items-start justify-between z-30 pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-4 pointer-events-auto">
                      <div className="flex items-center gap-2">
                        <Activity className={`w-3.5 h-3.5 ${streamStats.packetLoss < 0.1 ? 'text-emerald-400' : 'text-yellow-400'}`} />
                        <span className="text-[10px] font-mono font-black text-white/90 uppercase tracking-widest">{streamStats.bitrate} kbps</span>
                      </div>
                      <div className="w-px h-3 bg-white/10" />
                      <div className="flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-[#ff4e00]" />
                        <span className="text-[10px] font-mono font-black text-white/90 uppercase tracking-widest">{streamStats.packetLoss.toFixed(2)}% loss</span>
                      </div>
                    </div>

                    {activeStream && (
                      <div className="bg-red-500 px-4 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)] pointer-events-auto">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">LIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Floating Action Menu (Hover) */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 opacity-0 group-hover/player:opacity-100 transition-all duration-300 translate-y-4 group-hover/player:translate-y-0 pointer-events-auto px-6 py-4 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <button 
                      onClick={toggleCamera}
                      className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#ff4e00] hover:border-[#ff4e00]/50 transition-all shadow-xl active:scale-90"
                      title="Loop Camera"
                    >
                      <Sparkles className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shadow-xl active:scale-90 ${isRecording ? 'bg-red-500 border-red-400 animate-pulse' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      <Video className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={toggleScreenShare}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shadow-xl active:scale-90 ${isScreenSharing ? 'bg-[#ff4e00] border-[#ff4e00]/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                    <button 
                      onClick={() => setShowOverlay(!showOverlay)}
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all shadow-xl active:scale-90 ${showOverlay ? 'bg-[#ff4e00] border-[#ff4e00]/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      <Layout className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => videoRef.current?.parentElement?.requestFullscreen()}
                      className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shadow-xl active:scale-90"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Central Overlay Message */}
                  {showOverlay && overlayText && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none px-12">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-[#ff4e00]/90 text-white px-12 py-8 rounded-[3rem] shadow-2xl backdrop-blur-md border border-white/20 text-center"
                      >
                        <p className="text-3xl md:text-5xl font-display font-black uppercase italic tracking-tighter leading-none">
                          {overlayText}
                        </p>
                      </motion.div>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070504]">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/5 relative group-hover/player:scale-110 transition-transform duration-700">
                    <Video className="w-10 h-10 text-white/10" />
                    <div className="absolute inset-0 border border-[#ff4e00]/20 rounded-full animate-ping opacity-20" />
                  </div>
                  <h3 className="text-xl font-bold uppercase tracking-[0.3em] text-white/20 mb-8 italic">Ready to Capture</h3>
                  <button 
                    onClick={() => setIsPreviewing(true)}
                    className="bg-[#ff4e00] text-white px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 active:scale-95"
                  >
                    Activate Stage
                  </button>
                </div>
              )}
            </section>

            {/* Content & Quick Stats */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
              <div className="bg-white/5 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[#ff4e00]">
                    <Activity className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Session Metadata</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest italic">{activeStream?.status || 'Pre-Flight'}</span>
                </div>
                <div>
                  <h2 className="text-3xl font-display font-black tracking-tighter mb-4 italic uppercase">
                    {activeStream?.title || 'Standalone Broadcast'}
                  </h2>
                  <p className="text-white/40 text-sm leading-relaxed italic">
                    {activeStream?.description || 'Broadcast details will be established upon session synchronization.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/60">
                    {activeStream?.category || 'Cultura'}
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-[#ff4e00]/5 border border-[#ff4e00]/10 text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">
                    {activeStream?.privacy || 'Public'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 h-full">
                {[
                  { label: 'Likes', value: activeStream?.likes || '0', icon: Heart, color: 'text-red-500' },
                  { label: 'Chat messages', value: chatMessages.length, icon: MessageSquare, color: 'text-emerald-400' },
                  { label: 'Incoming Duos', value: joinRequests.filter(r => r.status === 'pending').length, icon: UserPlus, color: 'text-yellow-400' },
                  { label: 'Session Tier', value: 'PRO', icon: Sparkles, color: 'text-[#ff4e00]' }
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white/5 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center gap-2 group hover:bg-white/[0.07] transition-all">
                    <stat.icon className={`w-5 h-5 ${stat.color} opacity-60 group-hover:scale-110 transition-transform`} />
                    <span className="text-2xl font-black italic tracking-tighter">{stat.value}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20 text-center">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* High-Performance Sidebar (Chat + Moderation) */}
        <aside className="w-full lg:w-[420px] bg-[#0c0a09]/80 backdrop-blur-3xl border-l border-white/5 flex flex-col shrink-0">
          {/* Sidebar Tabs/Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Comunicaciones</h3>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest italic">Live</span>
               </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {activeStream ? (
              <>
                {/* Real-time Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                  <AnimatePresence mode="popLayout">
                    {pinnedMessage && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-[#ff4e00]/10 border border-[#ff4e00]/20 p-4 rounded-2xl relative group"
                      >
                        <Pin className="absolute top-2 right-2 w-3 h-3 text-[#ff4e00]/40" />
                        <span className="text-[8px] font-black uppercase text-[#ff4e00] tracking-[0.25em] mb-1 block">Mensaje Fijado</span>
                        <p className="text-xs text-white/90 italic font-medium leading-relaxed">"{pinnedMessage.text}"</p>
                      </motion.div>
                    )}

                    {chatMessages.map((msg) => (
                      <motion.div 
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group/msg"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                            {msg.userName}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-all">
                             <button onClick={() => handlePinMessage(msg)} className="p-1 px-2 rounded-md hover:bg-white/5 text-white/20 hover:text-white transition-all">
                                <Pin className="w-3 h-3" />
                             </button>
                             <button onClick={() => deleteMessage(msg.id)} className="p-1 px-2 rounded-md hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all">
                                <Trash2 className="w-3 h-3" />
                             </button>
                          </div>
                        </div>
                        {msg.imageUrl ? (
                          <div className="rounded-2xl overflow-hidden border border-white/5 bg-black/40 p-1">
                            <img src={msg.imageUrl} className="w-full h-48 object-cover rounded-xl" alt="upload" />
                          </div>
                        ) : (
                          <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl rounded-tl-none inline-block max-w-full">
                            <p className="text-[13px] text-white/80 leading-relaxed font-mono">{msg.text}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={chatEndRef} />
                </div>

                {/* Input Matrix */}
                <div className="p-4 border-t border-white/5 bg-black/40 space-y-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setAutoModerate(!autoModerate)}
                      className={`px-3 py-1.5 rounded-xl border transition-all text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${autoModerate ? 'bg-[#ff4e00]/10 border-[#ff4e00]/30 text-[#ff4e00]' : 'bg-white/5 border-white/10 text-white/30'}`}
                    >
                      <Shield className="w-3 h-3" />
                      AUTO-GUARD {autoModerate ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                     <button 
                      type="button"
                      onClick={() => chatImageInputRef.current?.click()}
                      className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:bg-white/10 transition-all active:scale-90 shrink-0"
                    >
                      {isUploadingChatImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Input session data..."
                      className="flex-1 bg-white/5 border border-white/5 rounded-2xl px-4 py-2 text-sm outline-none focus:border-[#ff4e00]/30 transition-all placeholder:text-white/10 font-mono italic"
                    />
                    <button type="submit" className="w-12 h-12 rounded-2xl bg-[#ff4e00] text-white flex items-center justify-center shadow-lg shadow-[#ff4e00]/20 active:scale-95 transition-all shrink-0">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
                /* Pre-Stream Configuration Panel */
                <div className="flex-1 p-6 space-y-8 overflow-y-auto scrollbar-hide">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                         <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Broadcasting Title</label>
                         <button onClick={suggestTitle} disabled={suggesting} className="text-[8px] font-black uppercase tracking-widest text-[#ff4e00] hover:underline disabled:opacity-30">Get AI Hint</button>
                      </div>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Ceremonia del Fuego Nuevo..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-sm font-mono placeholder:text-white/10 uppercase italic font-bold tracking-tight"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Key Visual</label>
                      <ImageUpload 
                        onUploadComplete={(url) => setThumbnailUrl(url)}
                        label="Sincronizar Arte de Portada"
                        folder="thumbnails"
                        currentImageUrl={thumbnailUrl}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
                          <Lock className="w-3 h-3" /> Privacy
                        </label>
                        <select
                          value={privacy}
                          onChange={(e) => setPrivacy(e.target.value as any)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff4e00] appearance-none cursor-pointer"
                        >
                          <option value="public">Público</option>
                          <option value="private">Privado</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 flex items-center gap-2">
                          <Monitor className="w-3 h-3" /> Tier
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as any)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-[#ff4e00] appearance-none cursor-pointer"
                        >
                          <option value="720p">720p HD</option>
                          <option value="1080p">1080p Ultra</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 italic">Expresión Narrativa</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Define el flujo de tu transmisión..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-xs font-mono min-h-[140px] resize-none leading-relaxed placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleStartStream}
                    disabled={loading || !title}
                    className="w-full bg-[#ff4e00] text-white font-black uppercase tracking-[0.2em] py-5 rounded-[2.5rem] flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all shadow-2xl shadow-[#ff4e00]/20 disabled:grayscale disabled:opacity-20 active:scale-95"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        <Play className="w-6 h-6 fill-current" />
                        <span>Synchronize Live</span>
                      </>
                    )}
                  </button>
                </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Terminar Broadcast"
        onConfirm={handleEndStream}
        confirmText="Finalizar Vínculo"
        confirmVariant="danger"
      >
        <p className="text-white/40 italic text-sm leading-relaxed">
          <span>Esta acción desconectará permanentemente la transmisión actual. ¿Confirmas la finalización de la sesión?</span>
        </p>
      </Modal>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
