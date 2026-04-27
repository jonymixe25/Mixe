import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, doc, getDoc, collection, query, where, getDocs, limit as firestoreLimit, onSnapshot } from '../firebase';
import { Home, User, Users, Video, LogOut, LogIn, Menu, X, Shield, Newspaper, Folder, Search, Play, ArrowRight, Film, Palette, Bell, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { orderBy, limit } from 'firebase/firestore';
import LoginModal from './LoginModal';
import Toast from './Toast';
import { useTheme } from '../ThemeContext';
import { useDevice } from '../hooks/useDevice';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const { primaryColor, setPrimaryColor } = useTheme();
  const { isMobile } = useDevice();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(false);
  const [prevUser, setPrevUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ news: any[], streams: any[] }>({ news: [], streams: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [enableMixe, setEnableMixe] = useState(false);
  const [isAnyStreamLive, setIsAnyStreamLive] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeAlert, setActiveAlert] = useState<any>(null);

  useEffect(() => {
    const alertsQuery = query(
      collection(db, 'alerts'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      firestoreLimit(1)
    );

    const unsubscribe = onSnapshot(alertsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const alertData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setActiveAlert(alertData);
      } else {
        setActiveAlert(null);
      }
    }, (error) => {
      console.error('Firestore Error (alerts):', error);
    });

    return () => unsubscribe();
  }, []);

  const colors = [
    { name: 'Naranja', value: '#ff4e00' },
    { name: 'Rojo', value: '#ef4444' },
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Esmeralda', value: '#10b981' },
    { name: 'Violeta', value: '#8b5cf6' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Amarillo', value: '#eab308' },
    { name: 'Cian', value: '#06b6d4' },
  ];

  useEffect(() => {
    const streamsQuery = query(collection(db, 'streams'), where('status', '==', 'live'), firestoreLimit(1));
    const unsubscribe = onSnapshot(streamsQuery, (snapshot) => {
      setIsAnyStreamLive(!snapshot.empty);
    }, (error) => {
      console.error('Firestore Error (streams-check):', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGlobalSettings(data);
        setEnableMixe(data.enableMixe || false);
        
        // Only apply if user hasn't explicitly chosen their own color or set as default
        if (data.themeColor && !localStorage.getItem('theme-primary-color')) {
          setPrimaryColor(data.themeColor);
        }
      }
    }, (error) => {
      console.error('Firestore Error (settings):', error);
    });
    return () => unsubscribe();
  }, [setPrimaryColor]);

  useEffect(() => {
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

  useEffect(() => {
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
    <div translate="no" className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-brand selection:text-white overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-brand/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-brand/3 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className={`fixed ${isMobile ? 'top-2' : 'top-6'} left-0 right-0 z-[100] px-4 md:px-6`}>
        <div className={`max-w-7xl mx-auto glass ${isMobile ? 'rounded-2xl px-4' : 'rounded-[2.5rem] px-6 sm:px-10'} border-white/10 shadow-2xl shadow-black/50 backdrop-blur-2xl`}>
          <div className={`flex items-center justify-between ${isMobile ? 'h-16' : 'h-20 md:h-24'}`}>
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-xl shadow-brand/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Video className="w-6 h-6 text-white relative z-10" />
                  {isAnyStreamLive && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl md:text-3xl font-display font-black tracking-tighter uppercase italic leading-none">
                    {globalSettings?.appName?.split(' ')[0] || 'Voz'} <span className="text-[var(--primary-color,#ff4e00)]">{globalSettings?.appName?.split(' ').slice(1).join(' ') || 'Mixe'}</span>
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-brand transition-colors" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..." 
                  className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-medium focus:border-brand focus:bg-white/10 outline-none transition-all w-48 focus:w-64"
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
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand">En Vivo</p>
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
                                      <p className="text-sm font-bold truncate group-hover:text-brand transition-colors">{stream.title}</p>
                                      <p className="text-[10px] text-white/40 uppercase tracking-widest">{stream.userName}</p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                            
                            {searchResults.news.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand">Noticias</p>
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
                                      <p className="text-sm font-bold truncate group-hover:text-brand transition-colors">{article.title}</p>
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
                      ? 'text-brand bg-white/5 shadow-inner' 
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-4 h-4 transition-transform duration-500 group-hover:scale-110 ${location.pathname === item.path ? 'text-brand' : ''}`} />
                  <span>{item.label}</span>
                  {location.pathname === item.path && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_10px_var(--primary-color)]" />
                  )}
                </Link>
              ))}
              
              <div className="w-px h-8 bg-white/10 mx-4" />

              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-3 glass hover:bg-white/10 text-white/40 hover:text-brand rounded-xl transition-all duration-500 border-white/10 group"
                  title="Cambiar Color"
                >
                  <Palette className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                </button>
                
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-4 glass p-6 rounded-[2rem] border-white/10 shadow-2xl z-[201] w-64"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-6 flex items-center gap-2">
                        <Palette className="w-3 h-3" />
                        <span>Personalizar Tema</span>
                      </p>
                      <div className="grid grid-cols-4 gap-3">
                        {colors.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => {
                              setPrimaryColor(color.value);
                              setShowColorPicker(false);
                            }}
                            className={`w-10 h-10 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-90 relative group ${
                              primaryColor === color.value ? 'ring-2 ring-white ring-offset-4 ring-offset-[#0a0502]' : ''
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          >
                            <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                          </button>
                        ))}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/5">
                        <p className="text-[8px] font-black uppercase tracking-widest text-white/20 italic">
                          Cualquier usuario puede modificar el color de la aplicación.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="w-px h-8 bg-white/10 mx-4" />
              
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden xl:flex flex-col items-end mr-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Bienvenido</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand italic">{user.displayName}</span>
                  </div>
                  <Link to="/profile" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-white/5 p-0.5 border border-white/10 group-hover:border-brand/50 transition-all duration-500">
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
                  className="bg-brand px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand/90 hover:scale-105 active:scale-95 transition-all duration-500 shadow-2xl shadow-brand/30 flex items-center gap-3 group"
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
                        ? 'bg-brand/10 text-brand border border-brand/20' 
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
                      className="w-full flex items-center gap-4 p-5 rounded-2xl bg-brand text-white shadow-xl shadow-brand/20 transition-all duration-500"
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
        <AnimatePresence>
          {activeAlert && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              className="fixed top-32 left-1/2 -translate-x-1/2 z-[150] w-full max-w-2xl px-6"
            >
              <div className={`glass p-6 rounded-[2rem] border-brand/30 shadow-2xl relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-brand/5 animate-pulse pointer-events-none" />
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center shrink-0">
                    <Bell className="w-6 h-6 text-brand animate-bounce" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Alerta Global</p>
                      <button 
                        onClick={() => setActiveAlert(null)}
                        className="text-white/20 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-display font-black text-xl italic uppercase leading-none tracking-tighter">{activeAlert.title}</h4>
                    <p className="text-sm text-white/60 italic leading-relaxed">{activeAlert.message}</p>
                    {activeAlert.link && (
                      <Link 
                        to={activeAlert.link}
                        onClick={() => setActiveAlert(null)}
                        className="inline-flex items-center gap-2 text-brand text-[10px] font-black uppercase tracking-widest mt-4 hover:translate-x-2 transition-transform"
                      >
                        <span>Más información</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
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
                <Video className="w-4 h-4 text-[var(--primary-color,#ff4e00)]" />
              </div>
              <span className="font-display font-black tracking-tighter uppercase italic text-xl">
                {globalSettings?.appName?.split(' ')[0] || 'Voz'} <span className="text-[var(--primary-color,#ff4e00)]">{globalSettings?.appName?.split(' ').slice(1).join(' ') || 'Mixe'}</span>
              </span>
            </div>
            <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em] italic">
              {globalSettings?.footerText || 'La región de los jamás conquistados.'}
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-8">
              {['Privacidad', 'Términos', 'Contacto'].map(item => (
                <a key={item} href="#" className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                  {item}
                </a>
              ))}
            </div>
            {globalSettings?.socialLinks && (
              <div className="flex items-center gap-4">
                {globalSettings.socialLinks.facebook && (
                  <a href={globalSettings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {globalSettings.socialLinks.twitter && (
                  <a href={globalSettings.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                  </a>
                )}
                {globalSettings.socialLinks.instagram && (
                  <a href={globalSettings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="text-white/10 text-[10px] font-black uppercase tracking-widest text-center md:text-right">
            ©Jonatan García Diaz 2026 {globalSettings?.appName && `| ${globalSettings.appName}`}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
