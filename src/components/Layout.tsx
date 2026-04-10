import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, doc, getDoc, collection, query, where, getDocs, limit as firestoreLimit, onSnapshot } from '../firebase';
import { Home, User, Users, Video, LogOut, LogIn, Menu, X, Shield, Newspaper, Folder, Search, Play, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LoginModal from './LoginModal';
import Toast from './Toast';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [prevUser, setPrevUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ news: any[], streams: any[] }>({ news: [], streams: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [enableMixe, setEnableMixe] = useState(false);
  const [isAnyStreamLive, setIsAnyStreamLive] = useState(false);

  React.useEffect(() => {
    const streamsQuery = query(collection(db, 'streams'), where('status', '==', 'live'), firestoreLimit(1));
    const unsubscribe = onSnapshot(streamsQuery, (snapshot) => {
      setIsAnyStreamLive(!snapshot.empty);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setEnableMixe(settingsDoc.data().enableMixe || false);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchGlobalSettings();
  }, []);

  React.useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 2) {
        setSearchResults({ news: [], streams: [] });
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // Search News (simple prefix search)
        const newsQ = query(
          collection(db, 'news'),
          where('title', '>=', searchQuery),
          where('title', '<=', searchQuery + '\uf8ff'),
          firestoreLimit(5)
        );
        const newsSnap = await getDocs(newsQ);
        const newsResults = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Search Streams
        const streamsQ = query(
          collection(db, 'streams'),
          where('status', '==', 'live'),
          where('title', '>=', searchQuery),
          where('title', '<=', searchQuery + '\uf8ff'),
          firestoreLimit(5)
        );
        const streamsSnap = await getDocs(streamsQ);
        const streamsResults = streamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setSearchResults({ news: newsResults, streams: streamsResults });
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  React.useEffect(() => {
    if (user && !prevUser) {
      setShowWelcomeToast(true);
    }
    setPrevUser(user);
  }, [user, prevUser]);

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/news', label: 'Noticias', icon: Newspaper },
    ...(user ? [
      { path: '/profile', label: 'Perfil', icon: User },
      { path: '/contacts', label: 'Contactos', icon: Users },
      { path: '/gallery', label: 'Mis Archivos', icon: Folder },
      { path: '/admin', label: 'Transmitir', icon: Video },
      ...(user.role === 'admin' ? [{ path: '/dashboard', label: 'Admin', icon: Shield }] : []),
    ] : []),
  ];

  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-[#ff4e00] selection:text-white overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-[#ff4e00]/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[#ff4e00]/3 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-6 left-0 right-0 z-[100] px-6">
        <div className="max-w-7xl mx-auto glass rounded-[2.5rem] border-white/10 px-6 sm:px-10 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          <div className="flex items-center justify-between h-20 md:h-24">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-[#ff4e00] rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-xl shadow-[#ff4e00]/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Video className="w-6 h-6 text-white relative z-10" />
                  {isAnyStreamLive && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl md:text-3xl font-display font-black tracking-tighter uppercase italic leading-none">
                    Voz <span className="text-[#ff4e00]">Mixe</span>
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 mt-1">
                    {enableMixe ? 'Ayuujk Jää' : 'Plataforma Digital'}
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="relative group mr-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-[#ff4e00] transition-colors" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..." 
                  className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-medium focus:border-[#ff4e00] focus:bg-white/10 outline-none transition-all w-48 focus:w-64"
                />
                
                {/* Search Results Overlay */}
                <AnimatePresence>
                  {(searchQuery.length >= 2) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full mt-4 left-0 w-[400px] glass rounded-[2rem] border-white/10 shadow-2xl overflow-hidden z-[200]"
                    >
                      <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {isSearching ? (
                          <div className="py-8 text-center text-white/40 text-xs font-black uppercase tracking-widest animate-pulse">Buscando...</div>
                        ) : (searchResults.news.length === 0 && searchResults.streams.length === 0) ? (
                          <div className="py-8 text-center text-white/40 text-xs font-black uppercase tracking-widest">No hay resultados</div>
                        ) : (
                          <>
                            {searchResults.streams.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">En Vivo</p>
                                {searchResults.streams.map(stream => (
                                  <Link 
                                    key={stream.id} 
                                    to={`/stream/${stream.id}`}
                                    onClick={() => setSearchQuery('')}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                  >
                                    <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center relative">
                                      <Play className="w-4 h-4 text-red-600 fill-current" />
                                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate group-hover:text-[#ff4e00] transition-colors">{stream.title}</p>
                                      <p className="text-[10px] text-white/40 uppercase tracking-widest">{stream.userName}</p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                            
                            {searchResults.news.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">Noticias</p>
                                {searchResults.news.map(article => (
                                  <Link 
                                    key={article.id} 
                                    to="/news"
                                    onClick={() => setSearchQuery('')}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                  >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden">
                                      <img src={article.imageUrl || `https://picsum.photos/seed/${article.id}/100/100`} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate group-hover:text-[#ff4e00] transition-colors">{article.title}</p>
                                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Artículo</p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 relative group ${
                    location.pathname === item.path 
                      ? 'text-[#ff4e00] bg-white/5 shadow-inner' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 transition-transform duration-500 group-hover:scale-110 ${location.pathname === item.path ? 'text-[#ff4e00]' : ''}`} />
                  <span>{item.label}</span>
                  {location.pathname === item.path && (
                    <motion.div 
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#ff4e00] rounded-full shadow-[0_0_10px_#ff4e00]"
                    />
                  )}
                </Link>
              ))}
              
              <div className="w-px h-8 bg-white/10 mx-4" />
              
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden xl:flex flex-col items-end mr-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Bienvenido</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#ff4e00] italic">{user.displayName}</span>
                  </div>
                  <Link to="/profile" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 p-0.5 border border-white/10 group-hover:border-[#ff4e00]/50 transition-all duration-500">
                      <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        className="w-full h-full rounded-[0.5rem] bg-[#0a0502] object-cover" 
                        alt="avatar" 
                      />
                    </div>
                  </Link>
                  <button
                    onClick={() => { logout(); navigate('/'); }}
                    className="p-3 glass hover:bg-red-500/10 text-white/20 hover:text-red-500 rounded-xl transition-all duration-500 border-white/10 group"
                    title="Cerrar Sesión"
                  >
                    <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="bg-[#ff4e00] px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#ff4e00]/90 hover:scale-105 active:scale-95 transition-all duration-500 shadow-2xl shadow-[#ff4e00]/30 flex items-center gap-3 group"
                >
                  <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  <span>Ingresar</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-4 glass rounded-2xl text-white/40 hover:text-white border-white/10 transition-all duration-500 active:scale-90"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="lg:hidden mt-4 glass rounded-[2.5rem] border-white/10 overflow-hidden shadow-2xl backdrop-blur-3xl"
            >
              <div className="p-8 space-y-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-4 p-5 rounded-2xl transition-all duration-500 ${
                      location.pathname === item.path 
                        ? 'bg-[#ff4e00]/10 text-[#ff4e00] border border-[#ff4e00]/20' 
                        : 'text-white/40 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="font-black uppercase tracking-widest text-xs">{item.label}</span>
                  </Link>
                ))}
                
                <div className="pt-4 border-t border-white/10">
                  {user ? (
                    <button
                      onClick={() => { logout(); navigate('/'); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all duration-500"
                    >
                      <LogOut className="w-6 h-6" />
                      <span className="font-black uppercase tracking-widest text-xs">Cerrar Sesión</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { handleLoginClick(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-[#ff4e00] text-white shadow-xl shadow-[#ff4e00]/20 transition-all duration-500"
                    >
                      <LogIn className="w-6 h-6" />
                      <span className="font-black uppercase tracking-widest text-xs">Ingresar</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      
      <Toast 
        message={`¡Bienvenido, ${user?.displayName || 'Usuario'}!`}
        type="success"
        isVisible={showWelcomeToast}
        onClose={() => setShowWelcomeToast(false)}
      />

      <main className="pt-32 pb-24 px-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                <Video className="w-4 h-4 text-[#ff4e00]" />
              </div>
              <span className="font-display font-black tracking-tighter uppercase italic text-xl">
                Voz <span className="text-[#ff4e00]">Mixe</span>
              </span>
            </div>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] italic">
              La región de los jamás conquistados.
            </p>
          </div>
          
          <div className="flex items-center gap-8">
            {['Privacidad', 'Términos', 'Contacto'].map(item => (
              <a key={item} href="#" className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-[#ff4e00] transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="text-white/10 text-[10px] font-black uppercase tracking-widest">
            © 2026 Voz Mixe Live. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
