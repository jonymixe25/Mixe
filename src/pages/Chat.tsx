import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, handleFirestoreError } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { Send, ArrowLeft, Loader2, User as UserIcon, Image as ImageIcon, Video, Phone, X, Camera, Mic, MicOff, VideoOff, Maximize2, MessageCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import Toast from '../components/Toast';
import { sendNotification } from '../services/notificationService';

interface PrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  fileType?: string;
  createdAt: any;
  isSystem?: boolean;
}

const Chat: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [contact, setContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const signalingUnsubscribes = useRef<(() => void)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !contactId) return;

    setUploadingFile(true);
    setToast({ message: 'Subiendo y guardando archivo...', type: 'success', isVisible: true });

    try {
      const { ref, uploadBytesResumable, getDownloadURL, storage } = await import('../firebase');
      const chatId = getChatId(user.uid, contactId);
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `chats/${chatId}/media/${filename}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed',
        () => {},
        (error) => {
          console.error('Error uploading file in chat:', error);
          setToast({ message: 'Error al subir: ' + error.message, type: 'error', isVisible: true });
          setUploadingFile(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.uid,
            senderName: user.displayName,
            text: file.type.startsWith('video/') ? '🎥 [Video enviado]' : '📸 [Foto enviada]',
            imageUrl: downloadUrl,
            fileType: file.type,
            createdAt: serverTimestamp()
          });

          // Send real-time notification
          await sendNotification(
            contactId,
            { id: user.uid, name: user.displayName || 'Socio', photo: user.photoURL || undefined },
            'message',
            'Nuevo archivo multimedia',
            file.type.startsWith('video/') ? '🎥 Te envió un video' : '📸 Te envió una imagen',
            `/chat/${user.uid}`
          );

          // Duplicate to user's gallery media collection to satisfy both saving requirements
          try {
            await addDoc(collection(db, 'media'), {
              userId: user.uid,
              url: downloadUrl,
              folder: file.type.startsWith('video/') ? 'Videos Enviados' : 'Fotos Enviadas',
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              isPublic: false,
              createdAt: serverTimestamp()
            });
          } catch (mediaErr) {
            console.error('Error auto-syncing chat attachment to personal media gallery:', mediaErr);
          }

          setToast({ message: 'Archivo enviado con éxito', type: 'success', isVisible: true });
          setUploadingFile(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      );
    } catch (error: any) {
      console.error('Error uploading chat file:', error);
      setToast({ message: 'Error de red al inicializar la subida', type: 'error', isVisible: true });
      setUploadingFile(false);
    }
  };

  // Generate a consistent chatId for two users
  const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  useEffect(() => {
    if (!user) return;

    if (!contactId) {
      const q = query(collection(db, 'users', user.uid, 'contacts'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setContacts(contactList);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching contacts in chat list:', error);
        setLoading(false);
      });
      return () => unsubscribe();
    }

    const fetchContact = async () => {
      try {
        const contactDoc = await getDoc(doc(db, 'users', contactId));
        if (contactDoc.exists()) {
          setContact(contactDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching contact:', error);
      }
    };

    fetchContact();

    const chatId = getChatId(user.uid, contactId);
    
    // Auto-start call if requested via query param
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('startCall') === 'true') {
      startCall();
      // Remove the query param from URL without refreshing
      navigate(location.pathname, { replace: true });
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PrivateMessage));
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, contactId]);

  // Auto-send welcome message for new conversations
  useEffect(() => {
    if (!loading && messages.length === 0 && user && contactId && contact) {
      const sendWelcome = async () => {
        const chatId = getChatId(user.uid, contactId);
        const chatRef = doc(db, 'chats', chatId);
        
        try {
          const chatDoc = await getDoc(chatRef);
          if (!chatDoc.exists() || !chatDoc.data().welcomeSent) {
            await setDoc(chatRef, { welcomeSent: true }, { merge: true });
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              senderId: 'system',
              senderName: 'Sistema',
              text: `¡Bienvenido al chat! Esta es una nueva conversación entre ${user.displayName} y ${contact.displayName}.`,
              createdAt: serverTimestamp(),
              isSystem: true
            });
          }
        } catch (e) {
          console.error('Error sending welcome message:', e);
        }
      };
      sendWelcome();
    }
  }, [loading, messages.length, user, contactId, contact]);

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    return () => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user || !contactId) return;
    const chatId = getChatId(user.uid, contactId);
    
    // Listen for incoming calls
    const callDoc = doc(db, 'calls', chatId);
    const unsubscribeCall = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data) {
        if (data.status === 'calling' && data.callerId !== user.uid) {
          setCallStatus('incoming');
          setIsCalling(true);
        } else if (data.status === 'connected') {
          setCallStatus('connected');
        } else if (data.status === 'ended') {
          endCall(false);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `calls/${chatId}`);
    });

    return () => {
      unsubscribeCall();
      signalingUnsubscribes.current.forEach(unsub => unsub());
      signalingUnsubscribes.current = [];
      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user, contactId]);

  const startCall = async () => {
    if (!user || !contactId) return;
    setIsCalling(true);
    setCallStatus('calling');
    const chatId = getChatId(user.uid, contactId);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        console.warn("Failed to get video, trying audio only", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setToast({ message: 'No se pudo acceder al video, usando solo audio', type: 'error', isVisible: true });
      }
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesCol = collection(db, 'calls', chatId, 'callerCandidates');
          addDoc(candidatesCol, event.candidate.toJSON());
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await setDoc(doc(db, 'calls', chatId), {
        callerId: user.uid,
        receiverId: contactId,
        status: 'calling',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        createdAt: serverTimestamp(),
      });

      // Send real-time call notification
      await sendNotification(
        contactId,
        { id: user.uid, name: user.displayName || 'Socio', photo: user.photoURL || undefined },
        'call',
        'Llamada de voz/video entrante',
        `Te está llamando por video/audio de Ayuuk en este momento.`,
        `/chat/${user.uid}?startCall=true`
      );

      // Listen for answer
      const unsubAnswer = onSnapshot(doc(db, 'calls', chatId), async (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        }
      }, (error) => {
        console.error('Answer signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubAnswer);

      // Listen for receiver candidates
      const unsubIce = onSnapshot(collection(db, 'calls', chatId, 'receiverCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      }, (error) => {
        console.error('ICE signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubIce);

    } catch (error) {
      console.error('Error starting call:', error);
      endCall();
    }
  };

  const answerCall = async () => {
    if (!user || !contactId) return;
    const chatId = getChatId(user.uid, contactId);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (e) {
        console.warn("Failed to get video, trying audio only", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setToast({ message: 'No se pudo acceder al video, usando solo audio', type: 'error', isVisible: true });
      }
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnection.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesCol = collection(db, 'calls', chatId, 'receiverCandidates');
          addDoc(candidatesCol, event.candidate.toJSON());
        }
      };

      const callDoc = await getDoc(doc(db, 'calls', chatId));
      const callData = callDoc.data();

      if (callData?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(doc(db, 'calls', chatId), {
          answer: {
            type: answer.type,
            sdp: answer.sdp,
          },
          status: 'connected',
        });
      }

      // Listen for caller candidates
      const unsubIce = onSnapshot(collection(db, 'calls', chatId, 'callerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      }, (error) => {
        console.error('ICE signaling error:', error);
      });
      signalingUnsubscribes.current.push(unsubIce);

    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
  };

  const endCall = async (notify = true) => {
    if (notify && user && contactId) {
      const chatId = getChatId(user.uid, contactId);
      try {
        await updateDoc(doc(db, 'calls', chatId), { status: 'ended' });
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }

    signalingUnsubscribes.current.forEach(unsub => unsub());
    signalingUnsubscribes.current = [];

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setRemoteStream(null);
    setIsCalling(false);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !contactId) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const chatId = getChatId(user.uid, contactId);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: user.uid,
        senderName: user.displayName,
        text,
        createdAt: serverTimestamp(),
      });

      // Send real-time chat notification
      await sendNotification(
        contactId,
        { id: user.uid, name: user.displayName || 'Socio', photo: user.photoURL || undefined },
        'message',
        'Nuevo mensaje de chat',
        text.length > 50 ? `${text.substring(0, 47)}...` : text,
        `/chat/${user.uid}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${getChatId(user.uid, contactId)}/messages`);
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand animate-spin" />
    </div>
  );

  if (!contactId) {
    return (
      <div className="max-w-4xl mx-auto space-y-12 relative animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-brand">
              <MessageCircle className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Mensajes Privados</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-bold tracking-tight text-black/90">
              <span>Mis Conversaciones</span>
            </h1>
            <p className="text-black/50 text-sm font-medium italic max-w-md">
              <span>Selecciona un contacto para iniciar un chat privado o videollamada.</span>
            </p>
          </div>
          
          <button
            onClick={() => navigate('/contacts')}
            className="px-8 py-4 bg-brand text-black rounded-xl text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#ff4e00]/20"
          >
            <Users className="w-4 h-4" />
            <span>Ver Directorio</span>
          </button>
        </div>

        {contacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contacts.map((c: any) => (
              <motion.div
                key={c.id || c.contactId}
                onClick={() => navigate(`/chat/${c.contactId}`)}
                className="glass border-black/[0.06] rounded-3xl p-6 flex items-center justify-between group hover:bg-black/[0.03] transition-all duration-500 shadow-lg shadow-black/[0.03] cursor-pointer hover:border-brand/35"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-xl bg-black/[0.03] p-1 border border-black/[0.06] group-hover:border-brand/20 transition-all duration-500">
                    <img 
                      src={c.contactPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.contactId}`} 
                      className="w-full h-full rounded-[0.8rem] bg-[#f5f5f0] object-cover group-hover:scale-110 transition-transform duration-700" 
                      alt="avatar" 
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg leading-none group-hover:text-brand transition-colors">{c.contactName}</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <p className="text-[10px] text-black/40 font-semibold uppercase tracking-wider">Chat Disponible</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 transition-transform duration-300 group-hover:translate-x-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand px-3 py-1.5 rounded-lg bg-brand/5 border border-brand/10 group-hover:bg-brand group-hover:text-black transition-colors">
                    Chatear →
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center glass rounded-3xl border-dashed border-black/[0.06] shadow-lg shadow-black/[0.03]">
            <div className="w-20 h-20 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-black/10" />
            </div>
            <p className="text-black/50 font-display text-xl italic mb-8"><span>Aún no tienes contactos agregados.</span></p>
            <button 
              onClick={() => navigate('/contacts')}
              className="bg-brand px-8 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:scale-105 transition-all shadow-lg shadow-brand/20 animate-bounce"
            >
              <span>Buscar Amigos</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col glass border-black/[0.06] rounded-3xl overflow-hidden shadow-lg shadow-black/[0.03] shadow-black/[0.04] relative">
      {/* Header */}
      <div className="px-8 py-6 border-b border-black/[0.06] bg-black/[0.03] backdrop-blur-xl flex items-center justify-between z-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/contacts')}
            className="p-3 glass hover:bg-black/[0.06] rounded-xl transition-all duration-500 border-black/[0.06] group"
          >
            <ArrowLeft className="w-5 h-5 text-black/50 group-hover:text-brand transition-colors" />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-14 h-14 rounded-xl bg-[#f5f5f0] p-0.5 border border-black/[0.06] group-hover:border-brand/50 transition-colors duration-500">
                <img 
                  src={contact?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`} 
                  alt="avatar" 
                  className="w-full h-full object-cover rounded-[0.8rem] group-hover:scale-110 transition-transform duration-700"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0a0502] shadow-lg" />
            </div>
            <div className="flex flex-col">
              <h2 className="font-display font-bold text-xl tracking-tighter uppercase italic leading-none group-hover:text-brand transition-colors">
                {contact?.displayName || 'Usuario'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-emerald-400">En línea ahora</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={startCall}
            className="p-4 glass hover:bg-brand text-brand hover:text-black rounded-xl transition-all duration-500 border-black/[0.06] shadow-lg shadow-[#ff4e00]/10 group"
            title="Video Llamada"
          >
            <Video className="w-5 h-5 group-hover:animate-pulse" />
          </button>
          <button 
            className="p-4 glass hover:bg-black/[0.06] text-black/30 hover:text-black rounded-xl transition-all duration-500 border-black/[0.06] group"
            title="Llamada de voz"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-[100] bg-[#f5f5f0] flex flex-col items-center justify-center p-8"
          >
            <div className="relative w-full h-full max-w-5xl flex flex-col items-center justify-center gap-10">
              {/* Remote Video (Main) */}
              <div className="relative w-full h-full rounded-3xl overflow-hidden glass border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] group">
                {callStatus === 'connected' ? (
                  <video
                    ref={remoteVideoRef}
                    playsInline
                    className="w-full h-full object-cover"
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      video.play().catch(err => {
                        if (err.name !== 'AbortError') console.error('Play error (remote):', err.message || err);
                      });
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ff4e00]/20 via-transparent to-transparent opacity-30" />
                    <div className="relative">
                      <div className="w-32 h-32 rounded-3xl bg-[#f5f5f0] p-1 border border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] relative z-10">
                        <img 
                          src={contact?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`} 
                          alt="avatar" 
                          className="w-full h-full object-cover rounded-3xl"
                        />
                      </div>
                      <div className="absolute inset-0 bg-brand rounded-3xl blur-2xl opacity-20 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2 relative z-10">
                      <h3 className="text-4xl font-display font-bold uppercase italic tracking-tighter text-black">
                        {callStatus === 'calling' ? 'Conectando...' : 'Llamada Entrante'}
                      </h3>
                      <p className="text-brand font-semibold uppercase tracking-[0.15em] text-[10px] italic">{contact?.displayName}</p>
                    </div>
                  </div>
                )}

                {/* Local Video (Picture-in-Picture) */}
                <div className="absolute bottom-8 right-8 w-1/4 aspect-video bg-[#f5f5f0] rounded-3xl overflow-hidden border-2 border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] z-10 group-hover:border-brand/50 transition-colors duration-500">
                  <video
                    ref={localVideoRef}
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      video.play().catch(err => {
                        if (err.name !== 'AbortError') console.error('Play error (local):', err.message || err);
                      });
                    }}
                  />
                </div>
              </div>

              {/* Call Controls */}
              <div className="flex items-center gap-8 glass p-6 rounded-3xl border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04]">
                {callStatus === 'incoming' ? (
                  <>
                    <button
                      onClick={answerCall}
                      className="w-20 h-20 bg-emerald-500 text-black rounded-3xl flex items-center justify-center hover:bg-emerald-600 transition-all duration-500 transform hover:scale-110 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-emerald-500/40 group"
                    >
                      <Phone className="w-10 h-10 fill-current group-hover:animate-bounce" />
                    </button>
                    <button
                      onClick={() => endCall()}
                      className="w-20 h-20 bg-red-500 text-black rounded-3xl flex items-center justify-center hover:bg-rose-500 transition-all duration-500 transform hover:scale-110 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-red-500/40"
                    >
                      <X className="w-10 h-10" />
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={toggleMute}
                      className={`w-16 h-16 rounded-xl transition-all duration-500 flex items-center justify-center shadow-lg shadow-black/[0.03] ${isMuted ? 'bg-red-500 text-black' : 'glass text-black/50 hover:text-black hover:bg-black/[0.06] border-black/[0.06]'}`}
                    >
                      {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                    </button>
                    <button 
                      onClick={toggleVideo}
                      className={`w-16 h-16 rounded-xl transition-all duration-500 flex items-center justify-center shadow-lg shadow-black/[0.03] ${isVideoOff ? 'bg-red-500 text-black' : 'glass text-black/50 hover:text-black hover:bg-black/[0.06] border-black/[0.06]'}`}
                    >
                      {isVideoOff ? <VideoOff className="w-7 h-7" /> : <Video className="w-7 h-7" />}
                    </button>
                    <button
                      onClick={() => endCall()}
                      className="w-20 h-20 bg-red-500 text-black rounded-3xl flex items-center justify-center hover:bg-rose-500 transition-all duration-500 transform hover:scale-110 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-red-500/40"
                    >
                      <X className="w-10 h-10" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-white/[0.02]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-20">
            <div className="w-24 h-24 bg-black/[0.03] rounded-full flex items-center justify-center">
              <MessageCircle className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <p className="font-display text-2xl font-bold uppercase italic tracking-tighter">Inicia la charla</p>
              <p className="text-sm italic max-w-[200px] mx-auto">Comparte tus pensamientos con {contact?.displayName}</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.isSystem) {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className="flex justify-center my-6"
                >
                  <div className="bg-black/[0.03] border border-black/[0.06] px-6 py-3 rounded-full backdrop-blur-sm">
                    <p className="text-xs font-mono text-black/50 uppercase tracking-widest text-center">
                      {msg.text}
                    </p>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                initial={{ opacity: 0, x: msg.senderId === user?.uid ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={msg.id}
                className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col gap-2 max-w-[75%]">
                  <div className={`px-6 py-4 rounded-3xl text-sm font-medium shadow-lg shadow-black/[0.03] relative group ${
                    msg.senderId === user?.uid 
                      ? 'bg-brand text-black rounded-tr-none' 
                      : 'glass text-black/80 rounded-tl-none border-black/[0.06]'
                  }`}>
                    <p className="leading-relaxed italic"><span>{msg.text}</span></p>
                    {msg.imageUrl && (
                      <div className="mt-3 rounded-2xl overflow-hidden max-w-sm border border-black/10">
                        {msg.fileType?.startsWith('video/') || msg.text?.includes('[Video') ? (
                          <video src={msg.imageUrl} controls className="w-full h-auto max-h-60 object-cover" />
                        ) : (
                          <img src={msg.imageUrl} alt="Adjunto" className="w-full h-auto max-h-60 object-cover" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    )}
                    <div className={`absolute top-0 ${msg.senderId === user?.uid ? '-right-2' : '-left-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <div className={`w-4 h-4 rotate-45 ${msg.senderId === user?.uid ? 'bg-brand' : 'bg-black/[0.06]'}`} />
                    </div>
                  </div>
                  <span className={`text-[8px] font-semibold uppercase tracking-wider text-black/30 ${msg.senderId === user?.uid ? 'text-right' : 'text-left'}`}>
                    {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm', { locale: es }) : 'Ahora'}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-8 border-t border-black/[0.06] bg-black/[0.03] backdrop-blur-xl">
        <form onSubmit={handleSend} className="flex gap-4 items-center">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAttachFile} 
            className="hidden" 
            accept="image/*,video/*" 
          />
          <button 
            type="button"
            disabled={uploadingFile}
            onClick={() => fileInputRef.current?.click()}
            className="p-4 glass rounded-xl hover:bg-black/[0.06] text-black/30 hover:text-brand transition-all duration-500 border-black/[0.06] disabled:opacity-50"
            title="Enviar Foto o Video"
          >
            {uploadingFile ? (
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
          </button>
          <div className="flex-1 relative group">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="w-full bg-black/[0.03] border border-black/[0.06] rounded-3xl px-8 py-4 text-sm font-medium outline-none focus:border-brand focus:bg-black/[0.06] transition-all placeholder:text-black/30"
            />
            <div className="absolute inset-0 rounded-3xl bg-brand/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
          </div>
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending || uploadingFile}
            className="p-5 bg-brand text-black rounded-[1.5rem] hover:bg-brand/90 transition-all duration-500 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-[#ff4e00]/30 disabled:opacity-50 disabled:scale-95 active:scale-90 group"
          >
            {sending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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

export default Chat;
