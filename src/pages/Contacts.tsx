import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, deleteDoc, handleFirestoreError, limit } from '../firebase';
import { Contact, UserProfile, OperationType } from '../types';
import { Users, UserPlus, Search, Trash2, User as UserIcon, MessageCircle } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-[#ff4e00]/10 rounded-xl lg:rounded-2xl flex items-center justify-center">
            <Users className="w-5 h-5 lg:w-6 lg:h-6 text-[#ff4e00]" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight uppercase italic"><span>Mis Contactos</span></h1>
        </div>
        <span className="text-white/40 text-[10px] lg:text-sm font-bold uppercase tracking-widest">
          <span>{contacts.length} Amigos</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40"><span>Buscar Amigos</span></h2>
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:border-[#ff4e00] outline-none transition-all text-sm"
                placeholder="Nombre o email..."
              />
              {searching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#ff4e00]/30 border-t-[#ff4e00] rounded-full animate-spin" />
                </div>
              )}
            </form>

            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-2 pt-4"
                >
                  {searchResults.map(result => (
                    <div key={result.uid} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden">
                          <img src={result.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.uid}`} alt="avatar" />
                        </div>
                        <span className="text-sm font-medium truncate max-w-[100px]"><span>{result.displayName}</span></span>
                      </div>
                      <button
                        onClick={() => addContact(result)}
                        className="p-2 bg-[#ff4e00] rounded-xl hover:scale-110 transition-transform"
                      >
                        <UserPlus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-gradient-to-br from-[#ff4e00]/10 to-transparent border border-[#ff4e00]/10 rounded-3xl p-6">
            <p className="text-xs text-white/40 italic leading-relaxed">
              <span>"Conéctate con otros miembros de la comunidad Mixe para compartir experiencias y transmisiones en vivo."</span>
            </p>
          </div>
        </div>

        {/* Contacts List */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map((contact) => (
                <motion.div
                  layout
                  key={contact.contactId}
                  className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 overflow-hidden border border-white/10">
                      <img src={contact.contactPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.contactId}`} alt="avatar" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm"><span>{contact.contactName}</span></h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest"><span>Amigo</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => navigate(`/chat/${contact.contactId}`)}
                      className="p-2 bg-white/5 rounded-xl hover:text-[#ff4e00] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeContact(contact.contactId)}
                      className="p-2 bg-white/5 rounded-xl hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
              <UserIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40 font-medium italic"><span>Aún no tienes contactos.</span></p>
              <p className="text-xs text-white/20 mt-2"><span>Busca a tus amigos por su nombre o correo electrónico.</span></p>
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
