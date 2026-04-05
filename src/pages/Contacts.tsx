import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, deleteDoc, handleFirestoreError, limit } from '../firebase';
import { Contact, UserProfile, OperationType } from '../types';
import { Users, UserPlus, Search, Trash2, User as UserIcon, MessageCircle, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import Toast from '../components/Toast';

import { useNavigate } from 'react-router-dom';

const Contacts: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'contacts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactList = snapshot.docs.map(doc => doc.data() as Contact);
      setContacts(contactList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;

    setSearching(true);
    try {
      const lowerTerm = term.toLowerCase();
      // Search by email (exact match)
      const emailQuery = query(collection(db, 'users'), where('emailLowercase', '==', lowerTerm));
      
      // Search by name (starts with)
      const nameQuery = query(
        collection(db, 'users'), 
        where('displayNameLowercase', '>=', lowerTerm),
        where('displayNameLowercase', '<=', lowerTerm + '\uf8ff'),
        limit(10)
      );

      const [emailSnap, nameSnap] = await Promise.all([
        getDocs(emailQuery),
        getDocs(nameQuery)
      ]);

      const emailResults = emailSnap.docs.map(doc => doc.data() as UserProfile);
      const nameResults = nameSnap.docs.map(doc => doc.data() as UserProfile);
      
      // Combine and remove duplicates (by uid)
      const combined = [...emailResults, ...nameResults];
      const uniqueResults = Array.from(new Map(combined.map(u => [u.uid, u])).values())
        .filter(u => u.uid !== user?.uid);

      setSearchResults(uniqueResults);
      
      if (uniqueResults.length === 0) {
        setToast({ message: 'No se encontraron usuarios.', type: 'error', isVisible: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
      setToast({ message: 'Error al buscar usuarios.', type: 'error', isVisible: true });
    } finally {
      setSearching(false);
    }
  };

  const addContact = async (targetUser: UserProfile) => {
    if (!user) return;
    try {
      // Check if already in contacts
      if (contacts.some(c => c.contactId === targetUser.uid)) {
        setToast({ message: 'Este usuario ya está en tus contactos.', type: 'error', isVisible: true });
        return;
      }

      const contactData: Contact = {
        userId: user.uid,
        contactId: targetUser.uid,
        contactName: targetUser.displayName,
        contactPhoto: targetUser.photoURL,
        addedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'users', user.uid, 'contacts'), contactData);
      setToast({ message: 'Contacto añadido con éxito.', type: 'success', isVisible: true });
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/contacts`);
    }
  };

  const removeContact = async (contactId: string) => {
    if (!user) return;
    try {
      // Need to find the doc ID first
      const q = query(collection(db, 'users', user.uid, 'contacts'), where('contactId', '==', contactId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', snapshot.docs[0].id));
        setToast({ message: 'Contacto eliminado.', type: 'success', isVisible: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/contacts`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 relative">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Users className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Comunidad</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic"><span>Mis Contactos</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md">
            <span>Conecta con otros miembros, comparte experiencias y mantén el contacto.</span>
          </p>
        </div>
        
        <div className="glass px-8 py-4 rounded-[2rem] border-white/10 shadow-xl flex items-center gap-4">
          <div className="w-10 h-10 bg-[#ff4e00]/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-[#ff4e00]" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-display font-black tracking-tighter leading-none">{contacts.length}</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Amigos Conectados</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Search Section */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass rounded-[2.5rem] p-8 space-y-8 border-white/10 shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff4e00]">Encontrar Amigos</h2>
              <p className="text-white/40 text-xs italic">Busca por nombre o correo electrónico.</p>
            </div>

            <form onSubmit={handleSearch} className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#ff4e00] transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all placeholder:text-white/20"
                placeholder="Ej: Juan Pérez..."
              />
              {searching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-3 border-[#ff4e00]/30 border-t-[#ff4e00] rounded-full animate-spin" />
                </div>
              )}
            </form>

            <AnimatePresence mode="wait">
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-3 pt-4 border-t border-white/10"
                >
                  {searchResults.map(result => (
                    <motion.div 
                      key={result.uid} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-4 glass rounded-2xl border-white/10 group hover:bg-white/5 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 p-0.5 border border-white/10">
                          <img 
                            src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} 
                            className="w-full h-full rounded-[0.5rem] bg-[#0a0502]" 
                            alt="avatar" 
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white/80 truncate max-w-[120px]">{result.displayName}</span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Usuario</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addContact(result)}
                        className="p-2.5 bg-[#ff4e00] text-white rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[#ff4e00]/20"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="glass rounded-[2.5rem] p-8 border-[#ff4e00]/20 shadow-2xl shadow-[#ff4e00]/5 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ff4e00]/10 rounded-full blur-3xl group-hover:bg-[#ff4e00]/20 transition-all duration-700" />
            <p className="text-sm text-white/40 italic leading-relaxed relative z-10">
              <span>"Conéctate con otros miembros de la comunidad Mixe para compartir experiencias y transmisiones en vivo."</span>
            </p>
          </div>
        </div>

        {/* Contacts List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 glass rounded-[2.5rem] animate-pulse border-white/10" />
              ))}
            </div>
          ) : contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contacts.map((contact) => (
                <motion.div
                  layout
                  key={contact.contactId}
                  className="glass border-white/10 rounded-[2.5rem] p-6 flex items-center justify-between group hover:bg-white/5 transition-all duration-500 shadow-xl"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 p-1 border border-white/10 group-hover:border-[#ff4e00]/30 transition-all duration-500">
                      <img 
                        src={contact.contactPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.contactId}`} 
                        className="w-full h-full rounded-[0.8rem] bg-[#0a0502] object-cover group-hover:scale-110 transition-transform duration-700" 
                        alt="avatar" 
                      />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-lg leading-none group-hover:text-[#ff4e00] transition-colors">{contact.contactName}</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">Amigo Conectado</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={() => navigate(`/chat/${contact.contactId}`)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-[#ff4e00] text-white/40 hover:text-white transition-all shadow-lg"
                      title="Chat"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => navigate(`/chat/${contact.contactId}?startCall=true`)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-[#ff4e00] text-white/40 hover:text-white transition-all shadow-lg"
                      title="Video Llamada"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => removeContact(contact.contactId)}
                      className="p-3 bg-white/5 rounded-xl hover:bg-red-500 text-white/40 hover:text-white transition-all shadow-lg"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center glass rounded-[3rem] border-dashed border-white/10 shadow-2xl">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
                <UserIcon className="w-12 h-12 text-white/10" />
              </div>
              <p className="text-white/40 font-display text-2xl font-black uppercase italic tracking-tighter mb-4"><span>Aún no tienes contactos</span></p>
              <p className="text-sm text-white/20 italic max-w-xs mx-auto"><span>Busca a tus amigos por su nombre o correo electrónico para empezar a conectar.</span></p>
            </div>
          )}
        </div>
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

export default Contacts;
