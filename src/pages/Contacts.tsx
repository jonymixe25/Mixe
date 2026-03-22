import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, deleteDoc } from '../firebase';
import { Contact, UserProfile } from '../types';
import { Users, UserPlus, Search, Trash2, User as UserIcon, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Contacts: React.FC = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

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
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Simple search by email or name (Firestore limitation: no full-text search without external tools)
      const q = query(collection(db, 'users'), where('email', '==', searchQuery.trim()));
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== user?.uid);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  const addContact = async (targetUser: UserProfile) => {
    if (!user) return;
    try {
      const contactData: Contact = {
        userId: user.uid,
        contactId: targetUser.uid,
        contactName: targetUser.displayName,
        contactPhoto: targetUser.photoURL,
        addedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'users', user.uid, 'contacts'), contactData);
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding contact:', error);
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
      }
    } catch (error) {
      console.error('Error removing contact:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-[#ff4e00]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase italic">Mis Contactos</h1>
        </div>
        <span className="text-white/40 text-sm font-bold uppercase tracking-widest">
          {contacts.length} Amigos
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Search Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Buscar Amigos</h2>
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:border-[#ff4e00] outline-none transition-all text-sm"
                placeholder="Email del contacto..."
              />
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
                        <span className="text-sm font-medium truncate max-w-[100px]">{result.displayName}</span>
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
              "Conéctate con otros miembros de la comunidad Mixe para compartir experiencias y transmisiones en vivo."
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
                      <h3 className="font-bold text-sm">{contact.contactName}</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Amigo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-white/5 rounded-xl hover:text-[#ff4e00] transition-colors">
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
              <p className="text-white/40 font-medium italic">Aún no tienes contactos.</p>
              <p className="text-xs text-white/20 mt-2">Busca a tus amigos por su correo electrónico.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contacts;
