import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, where, handleFirestoreError, orderBy, limit, deleteDoc, getDocs } from '../firebase';
import { StreamSession, OperationType, ChatMessage } from '../types';
import { Video, StopCircle, Play, Sparkles, MessageSquare, Users, Image as ImageIcon, Wand2, Send, Loader2, Heart, Clock, Trash2, Shield, Settings, Lock, Globe, Zap, Monitor, UserPlus, Check, X, Gauge, Activity, Pin, Layout, Share2, Maximize } from 'lucide-react';
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
    <div className="max-w-7xl mx-auto space-y-12 relative">
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Finalizar Transmisión"
        onConfirm={handleEndStream}
        confirmText="Finalizar"
        confirmVariant="danger"
      >
        <p className="text-white/60 italic"><span>¿Estás seguro de que deseas terminar la transmisión en vivo? Esta acción no se puede deshacer.</span></p>
      </Modal>

      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 bg-[#151619] p-8 rounded-[2rem] border border-white/5 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Video className={`w-4 h-4 ${activeStream ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Transmisión</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">Panel de Control</h1>
          {tokenError && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col gap-2 text-red-500 text-xs mt-4 font-mono max-w-xl">
              <div className="flex items-center gap-3">
                <X className="w-4 h-4 shrink-0" />
                <p className="font-bold">Error de Configuración de LiveKit</p>
              </div>
              <p className="text-red-400/80 pl-7">{tokenError}</p>
              <p className="text-red-400/80 pl-7 mt-2">
                Para transmitir en vivo, necesitas configurar las credenciales de LiveKit. 
                Abre el panel de <strong>Secrets</strong> en AI Studio y agrega:
                <br />- <code className="bg-black/30 px-1 py-0.5 rounded">LIVEKIT_URL</code> (ej. wss://new-app-6tu2ilh8.livekit.cloud)
                <br />- <code className="bg-black/30 px-1 py-0.5 rounded">LIVEKIT_API_KEY</code>
                <br />- <code className="bg-black/30 px-1 py-0.5 rounded">LIVEKIT_API_SECRET</code>
              </p>
            </div>
          )}
          <p className="text-[#8E9299] text-sm font-mono max-w-md">
            Configura y gestiona tu transmisión en vivo para conectar con tu audiencia.
          </p>
        </div>
        
        {activeStream && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Likes', value: activeStream.likes || 0, icon: Heart, color: 'text-red-500' },
              { label: 'Espectadores', value: activeStream.viewerCount, icon: Users, color: 'text-[#ff4e00]' },
              { label: 'Mensajes', value: chatMessages.length, icon: MessageSquare, color: 'text-emerald-500' },
              { label: 'Duración', value: '00:42:15', icon: Clock, color: 'text-blue-500' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col items-center justify-center gap-2"
                >
                  <Icon className={`w-4 h-4 ${stat.color} opacity-80`} />
                  <span className="text-xl font-mono text-white">{stat.value}</span>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#8E9299]">{stat.label}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {activeStream && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-6 bg-[#1a1b1e] px-8 py-4 rounded-2xl border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <span className="text-red-500 text-[10px] font-mono uppercase tracking-[0.2em]">En Vivo</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3 text-white/60">
              <Users className="w-4 h-4 text-[#ff4e00]" />
              <span className="text-lg font-mono font-black">{activeStream.viewerCount}</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Preview Area */}
        <div className="xl:col-span-2 space-y-8">
          <div className="aspect-video bg-[#151619] rounded-[2rem] overflow-hidden border border-white/5 relative group shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            {activeStream || isPreviewing ? (
              <>
                <div className="w-full h-full flex items-center justify-center gap-4 p-4 [&>video]:flex-1 [&>video]:h-full [&>video]:object-cover [&>video]:rounded-2xl [&>video]:border [&>video]:border-white/10" ref={remoteVideoContainerRef}>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      video.play().catch(err => {
                        if (err.name !== 'AbortError') console.error('Play error (admin):', err.message || err);
                      });
                    }}
                  />
                </div>

                {/* Stream Health Bar */}
                {connectionStatus === 'connected' && (
                  <div className="absolute top-6 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
                    <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2">
                        <Activity className={`w-3.5 h-3.5 ${streamStats.packetLoss < 0.1 ? 'text-emerald-500' : 'text-yellow-500'}`} />
                        <span className="text-[10px] font-mono font-bold text-white/80">{streamStats.bitrate} kbps</span>
                      </div>
                      <div className="w-px h-4 bg-white/10" />
                      <div className="flex items-center gap-2">
                        <Gauge className="w-3.5 h-3.5 text-[#ff4e00]" />
                        <span className="text-[10px] font-mono font-bold text-white/80">{streamStats.packetLoss.toFixed(2)}% loss</span>
                      </div>
                    </div>
                    
                    <div className="bg-red-500 px-4 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                      <div className="w-2 h-2 bg-white rounded-full" />
                      <span className="text-[10px] font-mono font-black uppercase tracking-widest text-white">LIVE</span>
                    </div>
                  </div>
                )}

                {/* Overlay Text */}
                {showOverlay && overlayText && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="bg-[#ff4e00]/90 text-white px-10 py-6 rounded-[2rem] shadow-2xl backdrop-blur-md border border-white/20 max-w-[80%]"
                    >
                      <p className="text-2xl md:text-3xl font-display font-black uppercase italic tracking-tighter text-center leading-none">{overlayText}</p>
                    </motion.div>
                  </div>
                )}

                <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between z-40">
                  <div className="flex gap-3">
                    <button 
                      onClick={toggleCamera}
                      className="bg-[#1a1b1e]/80 backdrop-blur-md p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-all group shadow-xl active:scale-95"
                      title="Voltear Cámara"
                    >
                      <Sparkles className="w-6 h-6 text-white/60 group-hover:text-[#ff4e00] transition-colors" />
                    </button>
                    {!activeStream && (
                      <button 
                        onClick={() => setIsPreviewing(false)}
                        className="bg-red-500/80 backdrop-blur-md p-4 rounded-xl border border-red-500/50 hover:bg-red-500 transition-all group shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-95"
                        title="Apagar Cámara"
                      >
                        <StopCircle className="w-6 h-6 text-white" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        if (videoRef.current) {
                          if (document.fullscreenElement) {
                            document.exitFullscreen();
                          } else {
                            videoRef.current.parentElement?.requestFullscreen();
                          }
                        }
                      }}
                      className="bg-[#1a1b1e]/80 backdrop-blur-md p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-all group shadow-xl active:scale-95"
                      title="Pantalla Completa"
                    >
                      <Maximize className="w-6 h-6 text-white/60 group-hover:text-[#ff4e00] transition-colors" />
                    </button>
                  </div>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-center p-10">
                    <div className="w-20 h-20 border border-red-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                      <Video className="w-10 h-10 text-red-500" />
                    </div>
                    <p className="text-red-500 font-mono text-xl uppercase mb-2">Error de Cámara</p>
                    <p className="text-[#8E9299] text-sm font-mono max-w-xs mb-8">{cameraError}</p>
                    <button 
                      onClick={() => {
                        setCameraError(null);
                        setIsPreviewing(true);
                      }}
                      className="bg-transparent border border-white/20 hover:bg-white/5 px-8 py-3 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all text-white"
                    >
                      Reintentar Conexión
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1b1e]">
                <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center mb-8">
                  <Video className="w-10 h-10 text-white/20" />
                </div>
                <p className="font-mono text-xl uppercase mb-8 tracking-widest text-[#8E9299]">Cámara Desactivada</p>
                <button 
                  onClick={() => setIsPreviewing(true)}
                  className="bg-[#ff4e00] text-white px-10 py-4 rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-[#ff4e00]/90 transition-all shadow-[0_0_20px_rgba(255,78,0,0.3)] active:scale-95"
                >
                  Activar Cámara
                </button>
              </div>
            )}
            
            {(activeStream || isPreviewing) && (
              <div className="absolute top-8 left-8 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="bg-[#1a1b1e]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-xl">
                    <div className={`w-2 h-2 rounded-full ${activeStream ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
                    <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-white">
                      {activeStream ? 'REC' : 'VISTA PREVIA'}
                    </span>
                  </div>
                  {activeStream && connectionStatus !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`bg-[#1a1b1e]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-xl ${
                        connectionStatus === 'connected' ? 'text-emerald-500' : 
                        connectionStatus === 'connecting' ? 'text-blue-500' : 
                        'text-red-500'
                      }`}
                    >
                      <Gauge className={`w-3 h-3 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em]">
                        {connectionStatus === 'connected' ? 'SEÑAL ESTABLE' : 
                         connectionStatus === 'connecting' ? 'CONECTANDO...' : 
                         'ERROR DE SEÑAL'}
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            )}
          </div>

          {activeStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#151619] rounded-3xl p-8 space-y-4 border border-white/5 shadow-xl">
                <div className="flex items-center gap-3 text-[#ff4e00]">
                  <Video className="w-4 h-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Información del Stream</span>
                </div>
                <h2 className="text-3xl font-display font-bold tracking-tight leading-tight text-white">{activeStream.title}</h2>
                <p className="text-[#8E9299] text-sm leading-relaxed font-mono">{activeStream.description || 'Sin descripción proporcionada.'}</p>
              </div>
              
              <div className="space-y-8">
                {/* Real-time Chat */}
                <div className="bg-[#151619] rounded-3xl flex flex-col h-[400px] border border-white/5 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1b1e]">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-[#ff4e00]" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white">Chat en Vivo</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleClearChat}
                      className="p-1.5 text-white/20 hover:text-red-500 transition-colors"
                      title="Borrar Chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="text-[9px] text-emerald-500 font-mono uppercase tracking-widest">En vivo</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#8E9299]">Auto-Mod</span>
                      <button 
                        onClick={() => setAutoModerate(!autoModerate)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${autoModerate ? 'bg-[#ff4e00]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoModerate ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pinned Message */}
                <AnimatePresence>
                  {pinnedMessage && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-[#ff4e00]/10 border-b border-[#ff4e00]/20 p-4 flex items-start gap-3 relative group"
                    >
                      <Pin className="w-3 h-3 text-[#ff4e00] mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-mono font-bold text-[#ff4e00] uppercase tracking-widest mb-1">Mensaje Fijado</p>
                        <p className="text-xs text-white/80 leading-relaxed italic">"{pinnedMessage.text}"</p>
                      </div>
                      <button 
                        onClick={() => setPinnedMessage(null)}
                        className="p-1 text-white/20 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className="flex flex-col gap-1.5 group/msg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium ${msg.userId === user?.uid ? 'text-emerald-400' : 'text-[#ff4e00]'}`}>
                            {msg.userName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-all">
                          <button 
                            onClick={() => handlePinMessage(msg)}
                            className="p-1 hover:text-[#ff4e00] transition-all text-[#8E9299]"
                            title="Fijar mensaje"
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => deleteMessage(msg.id)}
                            className="p-1 hover:text-red-500 transition-all text-[#8E9299]"
                            title="Eliminar mensaje"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {msg.imageUrl ? (
                        <div className="mt-1 rounded-xl overflow-hidden border border-white/5 max-w-[200px] shadow-lg">
                          <img src={msg.imageUrl} alt="chat" className="w-full h-auto" />
                        </div>
                      ) : (
                        <div className="text-sm text-white/70 leading-relaxed">
                          <p>{msg.text}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-black/20 flex gap-3">
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
                    className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-white/40 relative overflow-hidden border border-white/5"
                  >
                    {isUploadingChatImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-[#ff4e00] transition-all duration-300"
                          style={{ width: `${chatUploadProgress}%` }}
                        />
                      </>
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-sm outline-none focus:border-white/20 transition-all placeholder:text-[#8E9299] text-white"
                  />
                  <button type="submit" className="p-3 bg-[#ff4e00] text-white rounded-xl hover:bg-[#ff4e00]/90 transition-all shadow-[0_0_15px_rgba(255,78,0,0.3)] active:scale-95">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

              {/* Viewers & Invitations */}
              <div className="bg-[#151619] rounded-3xl flex flex-col h-[400px] border border-white/5 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#1a1b1e]">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-[#ff4e00]" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white">Espectadores ({remoteParticipants.length})</h3>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {remoteParticipants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                      <Users className="w-8 h-8" />
                      <p className="text-[10px] font-mono uppercase tracking-widest">No hay espectadores conectados</p>
                    </div>
                  ) : (
                    remoteParticipants.map((p) => (
                      <div key={p.sid} className="bg-[#1a1b1e] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-[#ff4e00]/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff4e00]/20 to-[#ff4e00]/5 flex items-center justify-center border border-white/5 font-display font-black text-[#ff4e00] text-sm italic">
                            {p.identity.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-display font-bold text-white tracking-tight">{p.identity}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Conectado</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {activeInvitations[p.identity] === 'accepted' ? (
                            <button 
                              onClick={() => navigate(`/conference/${activeStream.id}_${p.identity}`)}
                              className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-white flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                              <Check className="w-3 h-3" />
                              <span>Entrar</span>
                            </button>
                          ) : activeInvitations[p.identity] === 'pending' ? (
                            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                              <Loader2 className="w-3 h-3 text-[#ff4e00] animate-spin" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#ff4e00]">Invitación Enviada</span>
                            </div>
                          ) : (
                            <button 
                              onClick={() => sendConferenceInvite(p)}
                              className="bg-[#ff4e00]/10 hover:bg-[#ff4e00]/20 border border-[#ff4e00]/30 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#ff4e00] flex items-center gap-2 transition-all"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Invitar a 1:1</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-[#151619] rounded-[2rem] p-12 text-center space-y-6 border border-white/5 shadow-2xl">
              <div className="w-20 h-20 bg-[#1a1b1e] border border-white/5 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Video className="w-8 h-8 text-[#8E9299]" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-display font-bold tracking-tight text-white">Listo para transmitir</h3>
                <p className="text-[#8E9299] text-sm font-mono max-w-md mx-auto">Configura los detalles de tu transmisión en el panel lateral para comenzar a emitir en vivo.</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="space-y-8">
          {!activeStream ? (
            <div className="bg-[#151619] rounded-[2rem] p-8 space-y-8 border border-white/5 shadow-2xl">
            <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299]">Título del Stream</label>
                    <button
                      onClick={suggestTitle}
                      disabled={suggesting}
                      className="text-[#ff4e00] text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 hover:underline disabled:opacity-50 transition-all"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Sugerir</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-sm font-mono placeholder:text-white/20 text-white"
                    placeholder="Ej: Gran Concierto Mixe..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1">Miniatura del Stream</label>
                  <div className="glass rounded-2xl p-4 border-dashed border-white/5 bg-[#1a1b1e]">
                    <ImageUpload 
                      onUploadComplete={(url) => setThumbnailUrl(url)}
                      label="Selecciona una imagen de portada"
                      folder="thumbnails"
                      currentImageUrl={thumbnailUrl}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-sm font-mono text-white appearance-none"
                  >
                    <option value="cultura">Cultura</option>
                    <option value="musica">Música</option>
                    <option value="tradicion">Tradición</option>
                    <option value="noticias">Noticias</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1 flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      Privacidad
                    </label>
                    <div className="flex bg-[#1a1b1e] rounded-xl p-1 border border-white/5">
                      <button 
                        onClick={() => setPrivacy('public')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${privacy === 'public' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                      >
                        Público
                      </button>
                      <button 
                        onClick={() => setPrivacy('private')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${privacy === 'private' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                      >
                        Privado
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1 flex items-center gap-2">
                      <Zap className="w-3 h-3" />
                      Latencia
                    </label>
                    <div className="flex bg-[#1a1b1e] rounded-xl p-1 border border-white/5">
                      <button 
                        onClick={() => setLatency('normal')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${latency === 'normal' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                      >
                        Normal
                      </button>
                      <button 
                        onClick={() => setLatency('low')}
                        className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${latency === 'low' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                      >
                        Baja
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1 flex items-center gap-2">
                    <Monitor className="w-3 h-3" />
                    Resolución Máxima
                  </label>
                  <div className="flex bg-[#1a1b1e] rounded-xl p-1 border border-white/5">
                    <button 
                      onClick={() => setResolution('720p')}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${resolution === '720p' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                    >
                      720p (HD)
                    </button>
                    <button 
                      onClick={() => setResolution('1080p')}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${resolution === '1080p' ? 'bg-[#ff4e00] text-white shadow-[0_0_10px_rgba(255,78,0,0.3)]' : 'text-[#8E9299] hover:text-white'}`}
                    >
                      1080p (Full HD)
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-sm font-mono min-h-[120px] resize-none leading-relaxed placeholder:text-white/20 text-white"
                    placeholder="Cuéntale a tu audiencia de qué trata tu transmisión..."
                  />
                </div>
              </div>

              <button
                onClick={handleStartStream}
                disabled={loading || !title}
                className="w-full bg-[#ff4e00] text-white font-mono uppercase tracking-widest py-5 rounded-xl flex items-center justify-center gap-4 hover:bg-[#ff4e00]/90 transition-all shadow-[0_0_20px_rgba(255,78,0,0.3)] disabled:opacity-50 active:scale-95"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    <span>Iniciar Transmisión</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-[#151619] rounded-[2rem] p-8 space-y-8 border border-white/5 shadow-2xl">
              <div className="text-center space-y-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299]">Tiempo Transcurrido</p>
                <p className="text-5xl font-mono font-bold tracking-tighter text-[#ff4e00]">{elapsedTime}</p>
              </div>

              <div className="h-px bg-white/5" />

              {/* Advanced Controls */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={toggleScreenShare}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all ${isScreenSharing ? 'bg-[#ff4e00] border-[#ff4e00] text-white shadow-[0_0_20px_rgba(255,78,0,0.3)]' : 'bg-[#1a1b1e] border-white/5 text-[#8E9299] hover:border-white/20'}`}
                >
                  <Share2 className="w-6 h-6" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">{isScreenSharing ? 'Compartiendo' : 'Compartir'}</span>
                </button>
                <button 
                  onClick={() => setShowOverlay(!showOverlay)}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all ${showOverlay ? 'bg-[#ff4e00] border-[#ff4e00] text-white shadow-[0_0_20px_rgba(255,78,0,0.3)]' : 'bg-[#1a1b1e] border-white/5 text-[#8E9299] hover:border-white/20'}`}
                >
                  <Layout className="w-6 h-6" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">{showOverlay ? 'Overlay ON' : 'Overlay OFF'}</span>
                </button>
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`col-span-2 flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all ${isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-[#1a1b1e] border-white/5 text-[#8E9299] hover:border-white/20'}`}
                >
                  <Video className="w-6 h-6" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">{isRecording ? 'Detener Grabación' : 'Grabar Transmisión'}</span>
                </button>
              </div>

              {/* Join Requests */}
              {joinRequests.filter(r => r.status === 'pending').length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] flex items-center gap-2">
                    <UserPlus className="w-3 h-3" />
                    Solicitudes de Duo ({joinRequests.filter(r => r.status === 'pending').length})
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {joinRequests.filter(r => r.status === 'pending').map(req => (
                      <div key={req.id} className="flex items-center justify-between bg-[#1a1b1e] p-3 rounded-xl border border-white/5">
                        <span className="text-sm font-medium text-white">{req.userName}</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleAcceptRequest(req.id)}
                            className="p-2 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors"
                            title="Aceptar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRejectRequest(req.id)}
                            className="p-2 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                            title="Rechazar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showOverlay && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8E9299] px-1">Texto del Overlay</label>
                  <input
                    type="text"
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                    placeholder="Ej: ¡Ya volvemos!..."
                    className="w-full bg-[#1a1b1e] border border-white/5 rounded-xl py-4 px-6 focus:border-[#ff4e00] outline-none transition-all text-sm font-mono text-white"
                  />
                </motion.div>
              )}

              <div className="h-px bg-white/5" />

              <button
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
                className="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-mono uppercase tracking-widest py-5 rounded-xl flex items-center justify-center gap-4 hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
              >
                {loading ? (
                  <div className="w-6 h-6 border-3 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                ) : (
                  <>
                    <StopCircle className="w-6 h-6" />
                    <span>Finalizar Stream</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="bg-[#151619] rounded-[2rem] p-8 border border-[#ff4e00]/20 shadow-[0_0_30px_rgba(255,78,0,0.05)]">
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] mb-6 flex items-center gap-3 text-white">
              <Users className="w-4 h-4 text-[#ff4e00]" />
              <span>Solicitudes para Unirse</span>
            </h3>
            <div className="space-y-4">
              {joinRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="py-8 text-center bg-[#1a1b1e] rounded-xl border border-dashed border-white/10">
                  <p className="text-[10px] text-[#8E9299] font-mono uppercase tracking-widest">Sin solicitudes</p>
                </div>
              ) : (
                joinRequests.filter(r => r.status === 'pending').map(request => (
                  <motion.div 
                    key={request.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between bg-[#1a1b1e] p-4 rounded-xl border border-white/5 group hover:border-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-black/40 p-0.5 border border-white/5">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${request.userId}`} 
                          className="w-full h-full rounded-md bg-[#151619]" 
                          alt="avatar" 
                        />
                      </div>
                      <span className="text-xs font-mono text-white/80">{request.userName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAcceptRequest(request.id)}
                        className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                        title="Aceptar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleRejectRequest(request.id)}
                        className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                        title="Rechazar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-[#151619] rounded-[2rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ff4e00]/5 rounded-full blur-3xl group-hover:bg-[#ff4e00]/10 transition-all duration-700" />
            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] mb-4 flex items-center gap-3 text-white">
              <Sparkles className="w-4 h-4 text-[#ff4e00]" />
              <span>Consejo Pro</span>
            </h3>
            <p className="text-sm text-[#8E9299] leading-relaxed font-mono">
              "Asegúrate de tener buena iluminación y una conexión estable para que tu audiencia disfrute de la cultura Mixe sin interrupciones."
            </p>
          </div>
      </div>
    </div>
  </div>
  );
}
