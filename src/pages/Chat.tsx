import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, handleFirestoreError } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { Send, ArrowLeft, Loader2, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrivateMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  createdAt: any;
}

const Chat: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contact, setContact] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate a consistent chatId for two users
  const getChatId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
  };

  useEffect(() => {
    if (!user || !contactId) return;

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
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${getChatId(user.uid, contactId)}/messages`);
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-[#ff4e00] animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/contacts')}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 overflow-hidden border border-white/10">
              <img 
                src={contact?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contactId}`} 
                alt="avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-bold text-sm lg:text-base"><span>{contact?.displayName || 'Usuario'}</span></h2>
              <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold"><span>En línea</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
            <UserIcon className="w-12 h-12" />
            <p className="text-sm italic"><span>Comienza la conversación con {contact?.displayName}</span></p>
          </div>
        ) : (
          messages.map((msg) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id}
              className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-4 rounded-3xl text-sm ${
                msg.senderId === user?.uid 
                  ? 'bg-[#ff4e00] text-white rounded-tr-none' 
                  : 'bg-white/10 text-white/90 rounded-tl-none border border-white/10'
              }`}>
                <p className="italic"><span>{msg.text}</span></p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 lg:p-6 border-t border-white/10 bg-white/5 flex gap-3">
        <button 
          type="button"
          className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors text-white/40"
        >
          <ImageIcon className="w-5 h-5" />
        </button>
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-[#ff4e00] transition-all"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="p-3 bg-[#ff4e00] text-white rounded-2xl hover:bg-[#ff4e00]/90 transition-all disabled:opacity-50 disabled:scale-95"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};

export default Chat;
