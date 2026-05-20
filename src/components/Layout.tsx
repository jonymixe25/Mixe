import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, doc, getDoc, collection, query, where, getDocs, limit as firestoreLimit, onSnapshot } from '../firebase';
import { Home, User, Users, Video, LogOut, LogIn, Menu, X, Shield, Newspaper, Folder, Search, Play, ArrowRight, Film, Palette, Bell, Info, ExternalLink, MessageSquare, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { orderBy, limit } from 'firebase/firestore';
import LoginModal from './LoginModal';
import Toast from './Toast';
import { useTheme } from '../ThemeContext';
import { useDevice } from '../hooks/useDevice';
import { RechargeModal } from './RechargeModal';
import { listenToUnreadCount } from '../services/notificationService';

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
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [hoveredColor, setHoveredColor] = useState<{ name: string; value: string; desc: string } | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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
    { name: 'Sol Terracota', value: '#ff3e00', desc: 'Fuego resplandeciente de Tlahuitoltepec' },
    { name: 'Grana Carmín', value: '#d6013c', desc: 'Rojo cochinilla puro y profundo de Oaxaca' },
    { name: 'Añil Sagrado', value: '#134cd8', desc: 'Azul ancestral brillante de alta intensidad' },
    { name: 'Esmeralda Mixe', value: '#059669', desc: 'Verde poderoso de los bosques sagrados del Ayuuk' },
    { name: 'Bugambilia Eléctrica', value: '#db2777', desc: 'Fucsia de gran contraste y fuerza oaxaqueña' },
    { name: 'Cempasúchil Dorado', value: '#eab308', desc: 'Intenso fuego solar que guía a los ancestros' },
    { name: 'Púrpura de Concha', value: '#7c3aed', desc: 'Tinte de gran prestigio en los telares de cintura' },
    { name: 'Misty Ayuuk', value: '#4b4b32', desc: 'El color de la niebla serrana en una tonalidad más firme' },
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
    if (!user) {
      setUnreadNotificationsCount(0);
      return;
    }
    const unsubscribe = listenToUnreadCount(user.uid, (count) => {
      setUnreadNotificationsCount(count);
    });
    return () => unsubscribe();
  }, [user]);

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
      { path: '/friends', label: 'Amigos', icon: Users },
      { path: '/notifications', label: 'Notificaciones', icon: Bell },
      { path: '/chat', label: 'Mensajes', icon: MessageSquare },
      { path: '/gallery', label: 'Mis Archivos', icon: Folder },
      { path: '/studio', label: 'Transmitir', icon: Video },
      ...(user.role === 'admin' ? [{ path: '/admin', label: 'Admin', icon: Shield }] : []),
    ] : []),
  ];

  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
  };

  return (
    <div translate="no" className="min-h-screen bg-[#f5f5f0] text-black font-sans selection:bg-brand selection:text-black overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-brand/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-brand/3 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className={`fixed ${isMobile ? 'top-2' : 'top-6'} left-0 right-0 z-[100] px-4 md:px-6`}>
        <div className={`max-w-7xl mx-auto glass ${isMobile ? 'rounded-xl px-4' : 'rounded-3xl px-6 sm:px-10'} border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.02] backdrop-blur-2xl`}>
          <div className={`flex items-center justify-between ${isMobile ? 'h-16' : 'h-20 md:h-24'}`}>
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-4 group">
                <div className="w-12 h-12 bg-brand rounded-xl flex items-center justify-center group-hover:rotate-12 transition-all duration-700 shadow-lg shadow-black/[0.03] shadow-brand/30 relative overflow-hidden">
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Video className="w-6 h-6 text-black relative z-10" />
                  {isAnyStreamLive && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl md:text-3xl font-display font-bold tracking-tight text-black/90 leading-none">
                    {(globalSettings?.appName?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.appName || 'Vida Mixe')).split(' ')[0]} <span className="text-[var(--primary-color,#ff4e00)]">{(globalSettings?.appName?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.appName || 'Vida Mixe')).split(' ').slice(1).join(' ')}</span>
                  </span>
                  <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-black/30 mt-1">
                    {enableMixe ? 'Ayuujk Jää' : 'Plataforma Digital'}
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="relative group mr-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/50 group-focus-within:text-brand transition-colors" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..." 
                  className="bg-black/[0.03] border border-black/[0.06] rounded-xl py-3 pl-12 pr-4 text-xs font-medium focus:border-brand focus:bg-black/[0.06] outline-none transition-all w-48 focus:w-64"
                />
                
                {/* Search Results Overlay */}
                <AnimatePresence>
                  {(searchQuery.length >= 2) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full mt-4 left-0 w-[400px] glass rounded-3xl border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] overflow-hidden z-[200]"
                    >
                      <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {isSearching ? (
                          <div className="py-8 text-center text-black/50 text-xs font-semibold uppercase tracking-wider animate-pulse">Buscando...</div>
                        ) : (searchResults.news.length === 0 && searchResults.streams.length === 0) ? (
                          <div className="py-8 text-center text-black/50 text-xs font-semibold uppercase tracking-wider">No hay resultados</div>
                        ) : (
                          <>
                            {searchResults.streams.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">En Vivo</p>
                                {searchResults.streams.map(stream => (
                                  <Link 
                                    key={stream.id} 
                                    to={`/stream/${stream.id}`}
                                    onClick={() => setSearchQuery('')}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-black/[0.03] transition-colors group"
                                  >
                                    <div className="w-12 h-12 rounded-lg bg-rose-500/20 flex items-center justify-center relative">
                                      <Play className="w-4 h-4 text-red-600 fill-current" />
                                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate group-hover:text-brand transition-colors">{stream.title}</p>
                                      <p className="text-[10px] text-black/50 uppercase tracking-widest">{stream.userName}</p>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            )}
                            
                            {searchResults.news.length > 0 && (
                              <div className="space-y-4">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Noticias</p>
                                {searchResults.news.map(article => (
                                  <Link 
                                    key={article.id} 
                                    to="/news"
                                    onClick={() => setSearchQuery('')}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-black/[0.03] transition-colors group"
                                  >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden">
                                      <img src={article.imageUrl || `https://picsum.photos/seed/${article.id}/100/100`} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate group-hover:text-brand transition-colors">{article.title}</p>
                                      <p className="text-[10px] text-black/50 uppercase tracking-widest">Artículo</p>
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
                  className={`flex items-center gap-3 px-5 py-3 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all duration-500 relative group ${
                    location.pathname === item.path 
                      ? 'text-brand bg-black/[0.03] shadow-inner' 
                      : 'text-black/50 hover:text-black hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="relative">
                    <item.icon className={`w-4 h-4 transition-transform duration-500 group-hover:scale-110 ${location.pathname === item.path ? 'text-brand' : ''}`} />
                    {item.path === '/notifications' && unreadNotificationsCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[8px] font-black text-black shadow-sm ring-2 ring-[#f5f5f0]">
                        {unreadNotificationsCount}
                      </span>
                    )}
                  </div>
                  <span>{item.label}</span>
                  {location.pathname === item.path && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand rounded-full shadow-[0_0_10px_var(--primary-color)]" />
                  )}
                </Link>
              ))}
              
              <div className="w-px h-8 bg-black/[0.06] mx-4" />

              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="p-3 glass hover:bg-black/[0.06] text-black/50 hover:text-brand rounded-xl transition-all duration-500 border-black/[0.06] group"
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
                      className="absolute top-full right-0 mt-4 glass p-6 rounded-3xl border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] z-[201] w-64"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/40 mb-6 flex items-center gap-2">
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
                            onMouseEnter={() => setHoveredColor(color)}
                            onMouseLeave={() => setHoveredColor(null)}
                            className={`w-10 h-10 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-90 relative group ${
                              primaryColor === color.value ? 'ring-2 ring-brand ring-offset-2 ring-offset-[#f5f5f0]' : ''
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          >
                            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                          </button>
                        ))}
                      </div>

                      {/* Interactive cultural color descriptions */}
                      <div className="mt-5 p-3 bg-black/[0.03] rounded-2xl border border-black/[0.05] min-h-[58px] flex flex-col justify-center">
                        {hoveredColor ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-black/80 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hoveredColor.value }} />
                              {hoveredColor.name}
                            </span>
                            <p className="text-[9px] text-black/50 leading-relaxed italic">{hoveredColor.desc}</p>
                          </div>
                        ) : (
                          (() => {
                            const active = colors.find(c => c.value.toLowerCase() === primaryColor.toLowerCase());
                            return active ? (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-brand flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active.value }} />
                                  {active.name} (Activo)
                                </span>
                                <p className="text-[9px] text-black/50 leading-relaxed italic">{active.desc}</p>
                              </div>
                            ) : (
                              <p className="text-[9px] text-black/40 italic font-medium text-center">Explora los matices de la Sierra</p>
                            );
                          })()
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-black/5">
                        <p className="text-[8px] font-semibold uppercase tracking-wider text-black/30 italic">
                          Cualquier usuario puede modificar el color de la aplicación.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="w-px h-8 bg-black/[0.06] mx-4" />
              
              {user ? (
                <div className="flex items-center gap-4">
                  {/* Coins Balance Indicator */}
                  <button
                    onClick={() => setIsRechargeModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand/5 hover:bg-brand/10 border border-brand/15 hover:border-brand/35 transition-all text-xs font-semibold cursor-pointer text-brand"
                    title="Recargar Monedas Ayuuk"
                  >
                    <Coins className="w-4 h-4 fill-current text-brand animate-pulse shrink-0" />
                    <span className="font-mono font-bold text-black">{user.coins ?? 0} M.A.</span>
                    <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand text-black shrink-0">+ CARGAR</span>
                  </button>

                  <div className="hidden xl:flex flex-col items-end mr-2">
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-black/30">Bienvenido</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand italic">{user.displayName}</span>
                  </div>
                  <Link to="/profile" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-black/[0.03] p-0.5 border border-black/[0.06] group-hover:border-brand/50 transition-all duration-500">
                      <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        className="w-full h-full rounded-[0.5rem] bg-[#f5f5f0] object-cover" 
                        alt="avatar" 
                      />
                    </div>
                  </Link>
                  <button
                    onClick={() => { logout(); navigate('/'); }}
                    className="p-3 glass hover:bg-red-500/10 text-black/30 hover:text-red-500 rounded-xl transition-all duration-500 border-black/[0.06] group"
                    title="Cerrar Sesión"
                  >
                    <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="bg-brand px-8 py-4 rounded-xl text-[10px] font-semibold uppercase tracking-wider hover:bg-brand/90 hover:scale-105 active:scale-95 transition-all duration-500 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-brand/30 flex items-center gap-3 group"
                >
                  <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  <span>Ingresar</span>
                </button>
              )}
            </div>

            {/* Mobile Actions: Simple Palette Trigger & User Profile / Login on Mobile Topbar */}
            <div className="flex lg:hidden items-center gap-2">
              {user && (
                <button
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="p-3 glass text-brand rounded-xl border-black/[0.06] flex items-center gap-1 hover:text-brand"
                  title="Recargar Monedas Ayuuk"
                >
                  <Coins className="w-5 h-5 fill-current text-brand" />
                  <span className="text-[10px] font-bold font-mono text-black">{user.coins ?? 0}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                }}
                className="p-3 glass text-black/50 hover:text-brand rounded-xl border-black/[0.06] transition-all"
                title="Personalizar Tema"
              >
                <Palette className="w-5 h-5" />
              </button>

              {user && (
                <Link
                  to="/notifications"
                  className="p-3 glass text-black/50 hover:text-brand rounded-xl border-black/[0.06] transition-all relative"
                  title="Notificaciones"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[8px] font-extrabold text-black ring-1 ring-[#f5f5f0]">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>
              )}
              
              {user ? (
                <Link to="/profile" className="w-10 h-10 rounded-xl bg-black/[0.03] p-0.5 border border-black/[0.06]">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-full h-full rounded-[0.5rem] bg-[#f5f5f0] object-cover" 
                    alt="avatar" 
                  />
                </Link>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="bg-brand text-black p-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  <LogIn className="w-5 h-5" />
                </button>
              )}
              
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-3 glass rounded-xl text-black/50 hover:text-black border-black/[0.06] transition-all active:scale-90"
                title="Menú Completo"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Color Picker Modal for Mobile when triggered from mobile topbar */}
        <AnimatePresence>
          {showColorPicker && isMobile && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="lg:hidden mt-2 mx-4 glass p-6 rounded-3xl border-black/[0.06] shadow-xl relative z-50"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/40 flex items-center gap-2">
                  <Palette className="w-3 h-3" />
                  <span>Personalizar Tema</span>
                </p>
                <button onClick={() => setShowColorPicker(false)} className="text-black/40 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setPrimaryColor(color.value);
                      setShowColorPicker(false);
                    }}
                    onMouseEnter={() => setHoveredColor(color)}
                    onMouseLeave={() => setHoveredColor(null)}
                    className={`w-10 h-10 rounded-xl transition-all duration-300 transform hover:scale-110 active:scale-90 relative ${
                      primaryColor === color.value ? 'ring-2 ring-brand ring-offset-2 ring-offset-[#f5f5f0]' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    <div className="absolute inset-0 bg-black/10 opacity-0 rounded-xl" />
                  </button>
                ))}
              </div>
              <div className="mt-4 p-3 bg-black/[0.03] rounded-xl border border-black/[0.05]">
                {hoveredColor ? (
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-black/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hoveredColor.value }} />
                      {hoveredColor.name}
                    </span>
                    <p className="text-[9px] text-black/50 leading-relaxed italic">{hoveredColor.desc}</p>
                  </div>
                ) : (
                  (() => {
                    const active = colors.find(c => c.value.toLowerCase() === primaryColor.toLowerCase());
                    return active ? (
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-brand flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active.value }} />
                          {active.name} (Activo)
                        </span>
                        <p className="text-[9px] text-black/50 leading-relaxed italic">{active.desc}</p>
                      </div>
                    ) : (
                      <p className="text-[9px] text-black/40 italic font-medium text-center">Toca un color para cambiar el tema</p>
                    );
                  })()
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Full Navigation Menu & Search Drawer (Slide out from Right) */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[140] lg:hidden"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[360px] bg-[#f5f5f0] border-l border-black/[0.06] shadow-2xl z-[150] lg:hidden flex flex-col overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-6 border-b border-black/[0.06] flex items-center justify-between bg-black/[0.01]">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold font-display tracking-tight text-black/90">
                      {(globalSettings?.appName || 'Vida Mixe')}
                    </span>
                    <span className="text-[8px] font-semibold uppercase tracking-wider text-black/30">Menú de Navegación</span>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-2 hover:bg-black/[0.05] rounded-xl text-black/50 hover:text-black transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search in Drawer */}
                <div className="p-4 border-b border-black/[0.03] bg-black/[0.01]">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar noticias, transmisiones..." 
                      className="w-full bg-black/[0.03] border border-black/[0.06] rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold outline-none focus:border-brand transition-all"
                    />
                  </div>
                </div>

                {/* Drawer Contents / Navigation Links */}
                <div className="flex-1 overflow-y-auto p-6 space-y-2">
                  {/* Dynamic Search Results in Drawer */}
                  {searchQuery.length >= 2 && (
                    <div className="mb-6 p-4 bg-black/[0.02] rounded-2xl border border-black/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-brand mb-3">Resultados de búsqueda</p>
                      {isSearching ? (
                        <p className="text-[10px] text-center text-black/40 py-2 animate-pulse">Buscando...</p>
                      ) : (searchResults.news.length === 0 && searchResults.streams.length === 0) ? (
                        <p className="text-[10px] text-center text-black/40 py-2">Sin resultados</p>
                      ) : (
                        <div className="space-y-3">
                          {searchResults.streams.map(stream => (
                            <Link 
                              key={stream.id} 
                              to={`/stream/${stream.id}`}
                              onClick={() => { setSearchQuery(''); setIsMenuOpen(false); }}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.03] transition-colors"
                            >
                              <Play className="w-3.5 h-3.5 text-brand fill-current" />
                              <span className="text-xs font-bold truncate">{stream.title}</span>
                            </Link>
                          ))}
                          {searchResults.news.map(article => (
                            <Link 
                              key={article.id} 
                              to="/news"
                              onClick={() => { setSearchQuery(''); setIsMenuOpen(false); }}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.03] transition-colors"
                            >
                              <Newspaper className="w-3.5 h-3.5 text-black/50" />
                              <span className="text-xs font-semibold truncate">{article.title}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-black/30 mb-2">Secciones</p>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 font-semibold uppercase tracking-wider text-[10px] ${
                          isActive 
                            ? 'bg-brand/10 text-brand border border-brand/15' 
                            : 'text-black/60 hover:bg-black/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <item.icon className={`w-4 h-4 ${isActive ? 'text-brand' : 'text-black/40'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.path === '/notifications' && unreadNotificationsCount > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[9px] font-extrabold text-black ring-1 ring-[#f5f5f0]">
                            {unreadNotificationsCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Drawer Footer Actions */}
                <div className="p-6 border-t border-black/[0.06] bg-black/[0.01]">
                  {user ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 px-2 py-1">
                        <img 
                          src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                          className="w-8 h-8 rounded-lg bg-white object-cover border border-black/[0.05]" 
                          alt="avatar" 
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold truncate text-black/85">{user.displayName}</span>
                          <span className="text-[8px] font-semibold text-black/40 uppercase tracking-wider">{user.role === 'admin' ? 'Administrador' : 'Socio Digital'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { logout(); navigate('/'); setIsMenuOpen(false); }}
                        className="w-full flex items-center justify-center gap-3 p-3.5 rounded-xl text-red-500 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 active:scale-[0.98] transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="font-semibold uppercase tracking-wider text-[9px]">Cerrar Sesión</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { handleLoginClick(); setIsMenuOpen(false); }}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-brand text-black shadow-lg shadow-brand/20 active:scale-[0.98] transition-all font-semibold uppercase tracking-wider text-[10px]"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Iniciar Sesión</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>

      {/* Mobile Bottom Tab Bar (Ergonomic & Always Accessible) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[99] p-3 pb-safe bg-gradient-to-t from-[#f5f5f0] via-[#f5f5f0]/95 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto glass p-1.5 rounded-2xl border-black/[0.06] shadow-[0_-8px_24px_rgba(0,0,0,0.03)] backdrop-blur-2xl flex items-center justify-around pointer-events-auto">
          {/* Home Tab */}
          <Link
            to="/"
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl flex-1 transition-all ${
              location.pathname === '/' ? 'text-brand' : 'text-black/45 hover:text-black'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Inicio</span>
          </Link>

          {/* News Tab */}
          <Link
            to="/news"
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl flex-1 transition-all ${
              location.pathname === '/news' ? 'text-brand' : 'text-black/45 hover:text-black'
            }`}
          >
            <Newspaper className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Noticias</span>
          </Link>

          {/* Middle Highlighted Live Streaming Tab */}
          <Link
            to={user ? "/studio" : "#"}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                handleLoginClick();
              }
            }}
            className={`relative -top-4 w-12 h-12 rounded-full flex items-center justify-center transition-all bg-[var(--primary-color,#ff3e00)] text-black shadow-lg shadow-brand/35 select-none hover:scale-110 active:scale-90 ${
              location.pathname === '/studio' ? 'ring-4 ring-brand/20 scale-105' : ''
            }`}
            title="Transmitir en Vivo"
          >
            <Video className="w-5 h-5 text-black" />
            {isAnyStreamLive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
            )}
          </Link>

          {/* Chat Tab if logged in, else Friends */}
          <Link
            to={user ? "/chat" : "/friends"}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                handleLoginClick();
              }
            }}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl flex-1 transition-all duration-300 relative group ${
              (location.pathname === '/chat' || location.pathname === '/friends') 
                ? 'text-brand scale-110 font-bold' 
                : 'text-black/45 hover:text-brand hover:scale-105'
            }`}
          >
            <div className="relative">
              {user ? (
                <MessageSquare className={`w-5 h-5 transition-all duration-300 ${
                  (location.pathname === '/chat') ? 'text-brand rotate-[10deg] scale-110' : 'group-hover:scale-115 group-hover:-rotate-6'
                }`} />
              ) : (
                <Users className={`w-5 h-5 transition-all duration-300 ${
                  (location.pathname === '/friends') ? 'text-brand scale-110' : 'group-hover:scale-115'
                }`} />
              )}
              {/* Actively highlights with a glowing ping dot if this is the dynamic view */}
              {(location.pathname === '/chat' || location.pathname === '/friends') && (
                <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
                </span>
              )}
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">{user ? 'Mensajes' : 'Socio Ayuuk'}</span>
            <div className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-brand transition-all duration-500 ${
              (location.pathname === '/chat' || location.pathname === '/friends') ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`} />
          </Link>

          {/* Side Drawer Toggle / Menú */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl flex-1 transition-all ${
              isMenuOpen ? 'text-brand' : 'text-black/45 hover:text-black'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-wider">Menú</span>
          </button>
        </div>
      </div>

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <RechargeModal isOpen={isRechargeModalOpen} onClose={() => setIsRechargeModalOpen(false)} />
      
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
              <div className={`glass p-6 rounded-3xl border-brand/20 shadow-lg shadow-black/[0.03] shadow-black/[0.04] relative overflow-hidden group`}>
                <div className="absolute inset-0 bg-brand/5 animate-pulse pointer-events-none" />
                <div className="flex items-start gap-5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
                    <Bell className="w-6 h-6 text-brand animate-bounce" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">Alerta Global</p>
                      <button 
                        onClick={() => setActiveAlert(null)}
                        className="text-black/30 hover:text-black transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-display font-bold text-xl italic uppercase leading-none tracking-tighter">{activeAlert.title}</h4>
                    <p className="text-sm text-black/60 italic leading-relaxed">{activeAlert.message}</p>
                    {activeAlert.link && (
                      <Link 
                        to={activeAlert.link}
                        onClick={() => setActiveAlert(null)}
                        className="inline-flex items-center gap-2 text-brand text-[10px] font-semibold uppercase tracking-wider mt-4 hover:translate-x-2 transition-transform"
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
      <footer className="relative z-10 border-t border-black/5 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4 p-5 rounded-3xl bg-black/[0.015] border border-black/[0.05] backdrop-blur-md shadow-sm hover:bg-black/[0.025] hover:border-black/[0.08] hover:shadow-md transition-all duration-500 max-w-sm group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[var(--primary-color,#ff4e00)]/10 to-[var(--primary-color,#ff4e00)]/30 rounded-2xl flex items-center justify-center border border-[var(--primary-color,#ff4e00)]/15 group-hover:scale-105 transition-transform duration-500 shadow-sm">
                <Video className="w-5 h-5 text-[var(--primary-color,#ff4e00)] animate-pulse" />
              </div>
              <span className="font-display font-extrabold tracking-tight text-black/90 text-xl">
                {(globalSettings?.appName?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.appName || 'Vida Mixe')).split(' ')[0]} <span className="text-[var(--primary-color,#ff4e00)]">{(globalSettings?.appName?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.appName || 'Vida Mixe')).split(' ').slice(1).join(' ')}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 border-l-2 border-[var(--primary-color,#ff4e00)]/40 pl-3">
              <p className="text-black/60 text-[11px] font-medium tracking-wide leading-relaxed italic">
                "{globalSettings?.footerText?.includes('Voz') ? 'La región de los jamás conquistados.' : (globalSettings?.footerText || 'La región de los jamás conquistados.')}"
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-8">
              {['Privacidad', 'Términos', 'Contacto'].map(item => (
                <a key={item} href="#" className="text-[10px] font-semibold uppercase tracking-wider text-black/30 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                  {item}
                </a>
              ))}
              <a href="https://vidamixe.mx" target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold uppercase tracking-wider text-brand hover:underline decoration-brand/30 underline-offset-4 transition-all">
                Sitio Oficial
              </a>
              <a href="https://vidamixe.mx/gallery" target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold uppercase tracking-wider text-black/50 hover:text-black transition-all">
                Galería Socio
              </a>
            </div>
            {globalSettings?.socialLinks && (
              <div className="flex items-center gap-4">
                {globalSettings.socialLinks.facebook && (
                  <a href={globalSettings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-black/30 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {globalSettings.socialLinks.twitter && (
                  <a href={globalSettings.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-black/30 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                  </a>
                )}
                {globalSettings.socialLinks.instagram && (
                  <a href={globalSettings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-black/30 hover:text-[var(--primary-color,#ff4e00)] transition-colors">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="text-black/10 text-[10px] font-semibold uppercase tracking-wider text-center md:text-right">
            ©Jonatan García Diaz 2026 {globalSettings?.appName && `| ${globalSettings.appName}`}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
