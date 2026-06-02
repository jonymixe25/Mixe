import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, orderBy, limit, doc } from '../firebase';
import { StreamSession } from '../types';
import { Video, Users, Play, Newspaper, ArrowRight, Folder, Sparkles, Languages, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useDevice } from '../hooks/useDevice';
import { FALLBACK_NEWS_ARTICLES } from '../data/fallbackNews';
import defaultAvatar from '../assets/images/regenerated_image_1779544399609.jpg';

const Home: React.FC = () => {
  const { user } = useAuth();
  const { isMobile } = useDevice();
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mixeWord, setMixeWord] = useState({ mixe: 'Määy', spanish: 'Buenos días', pronunciation: 'Ma-ai' });
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [showLiveNotification, setShowLiveNotification] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalSettings(snapshot.data());
      }
    }, (error) => {
      console.error('Firestore Error (settings):', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const words = [
      { mixe: 'Määy', spanish: 'Buenos días', pronunciation: 'Ma-ai' },
      { mixe: 'Tsä’äm', spanish: 'Fruta', pronunciation: 'Tsa-am' },
      { mixe: 'Poj', spanish: 'Viento', pronunciation: 'Poj' },
      { mixe: 'Kääw', spanish: 'Caballo', pronunciation: 'Ka-aw' },
      { mixe: 'Mëj', spanish: 'Grande', pronunciation: 'Mej' }
    ];
    setMixeWord(words[Math.floor(Math.random() * words.length)]);
  }, []);

  useEffect(() => {
    const streamsQuery = query(
      collection(db, 'streams'), 
      where('status', '==', 'live'),
      where('privacy', '==', 'public')
    );
    const unsubscribeStreams = onSnapshot(streamsQuery, (snapshot) => {
      const liveStreams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession));
      setStreams(liveStreams);
      
      // Show notification if there's a live stream and we haven't shown it yet in this session
      if (liveStreams.length > 0 && !sessionStorage.getItem('notified-live')) {
        setShowLiveNotification(true);
        sessionStorage.setItem('notified-live', 'true');
      }
    }, (error) => {
      console.error('Error fetching live streams:', error);
    });

    const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      const newsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      if (newsList.length === 0) {
        setNews(FALLBACK_NEWS_ARTICLES.slice(0, 3));
      } else {
        const merged = [...newsList];
        FALLBACK_NEWS_ARTICLES.forEach(fallback => {
          if (!merged.some(item => (item as any).title === fallback.title)) {
            merged.push(fallback as any);
          }
        });
        setNews(merged.slice(0, 3));
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching news:', error);
      setNews(FALLBACK_NEWS_ARTICLES.slice(0, 3));
      setLoading(false);
    });

    return () => {
      unsubscribeStreams();
      unsubscribeNews();
    };
  }, []);

  return (
    <div className="space-y-16 md:space-y-32">
      {/* Live Stream Notification Overlay */}
      <AnimatePresence>
        {showLiveNotification && streams.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed bottom-10 right-6 md:right-10 z-[120] max-w-sm w-[calc(100vw-3rem)]"
          >
            <div className="glass p-6 rounded-3xl border-brand/20 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-brand/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                <button 
                  onClick={() => setShowLiveNotification(false)}
                  className="p-2 hover:bg-black/[0.06] rounded-full transition-colors text-black/50 hover:text-black"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-xl bg-brand/20 flex items-center justify-center relative shrink-0">
                  <Video className="w-7 h-7 text-brand animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-pulse border-2 border-[#0a0502]" />
                </div>
                
                <div className="flex-1 space-y-2 pr-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">Transmisión en Vivo</p>
                  <h4 className="font-display font-bold text-lg leading-tight uppercase italic">{streams[0].title}</h4>
                  <p className="text-[10px] text-black/50 font-semibold uppercase tracking-wider">{streams[0].userName} está transmitiendo ahora</p>
                </div>
              </div>
              
              <div className="mt-6 flex gap-3">
                <Link 
                  to={`/stream/${streams[0].id}`}
                  className="flex-1 bg-brand text-black text-[10px] font-semibold uppercase tracking-wider py-4 rounded-xl text-center hover:bg-brand/80 transition-colors shadow-lg shadow-brand/20"
                >
                  Ver Transmisión
                </Link>
                <button 
                  onClick={() => setShowLiveNotification(false)}
                  className="px-6 glass text-[10px] font-semibold uppercase tracking-wider py-4 rounded-xl text-black/50 hover:text-black transition-colors"
                >
                  Después
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className={`relative ${isMobile ? 'py-16 min-h-[55vh]' : 'py-24 min-h-[75vh]'} rounded-3xl overflow-hidden flex items-center justify-center group shadow-lg border border-[var(--border-color)] bg-[var(--bg-color)]`}>
        <div className="relative z-20 text-center max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="inline-block px-5 py-2 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em] mb-10 backdrop-blur-md"
          >
            <span>Cultura • Tradición • Comunidad</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={`${isMobile ? 'text-5xl' : 'text-6xl sm:text-8xl md:text-[10rem]'} font-display font-bold tracking-tight text-black/90 leading-[0.8] mb-10`}
          >
            <span className="block">{(globalSettings?.heroTitle?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.heroTitle || 'Vida')).split(' ')[0]}</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand via-brand/80 to-brand bg-[length:200%_auto] animate-gradient">
              {(globalSettings?.heroTitle?.includes('Voz') ? 'Vida Mixe' : (globalSettings?.heroTitle || 'Mixe')).split(' ').slice(1).join(' ')}
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className={`${isMobile ? 'text-lg' : 'text-xl sm:text-2xl md:text-3xl'} text-black/60 font-medium italic max-w-3xl mx-auto leading-tight`}
          >
            <span>{globalSettings?.heroSubtitle?.replace(/Voz Mixe/g, 'Vida Mixe') || '"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.'}</span>
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className={`mt-16 flex ${isMobile ? 'flex-col' : 'flex-wrap'} justify-center gap-6`}
          >
            <Link 
              to="/news"
              className={`${isMobile ? 'w-full' : 'w-full sm:w-auto'} bg-black text-white px-12 py-6 rounded-xl font-semibold uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-brand hover:text-black transition-all duration-500 transform hover:-translate-y-2 active:scale-95 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-black/5`}
            >
              <Newspaper className="w-6 h-6" />
              <span>Explorar Noticias</span>
            </Link>
            {streams.length > 0 && (
              <Link 
                to={`/stream/${streams[0].id}`}
                className={`${isMobile ? 'w-full' : 'w-full sm:w-auto'} glass text-black px-12 py-6 rounded-xl font-semibold uppercase tracking-wider flex items-center justify-center gap-3 hover:bg-black/[0.06] transition-all duration-500 transform hover:-translate-y-2 active:scale-95`}
              >
                <Video className="w-6 h-6 text-brand animate-pulse" />
                <span>En Vivo Ahora</span>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Guest Welcome / User Welcome */}
      {!user ? (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="px-2"
        >
          <div className="glass p-8 md:p-16 rounded-3xl border-brand/20 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-brand/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Users className="w-64 h-64 text-brand" />
            </div>
            <div className="max-w-3xl space-y-6 relative z-10 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 text-brand">
                <Info className="w-5 h-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">Acceso de Visitante</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-black/90 leading-none">
                Mira nuestras transmisiones <span className="text-brand">sin registro</span>
              </h2>
              <p className="text-black/50 text-lg md:text-xl italic leading-relaxed">
                Nuestra plataforma es abierta para todos. Puedes disfrutar de las transmisiones públicas y noticias sin necesidad de crear una cuenta.
              </p>
              <div className="pt-6">
                <Link to="/register" className="inline-flex items-center gap-3 text-brand text-xs font-semibold uppercase tracking-[0.15em] group/btn">
                  <span>O crea una cuenta para participar en el chat</span>
                  <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </motion.section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2">
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2"
          >
            <div className="glass p-8 md:p-12 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-8 border-black/[0.06] shadow-lg shadow-black/[0.03] shadow-black/[0.04] h-full">
              <div className="space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 text-brand">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-[0.15em]">Bienvenido de nuevo</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black/90 leading-none">
                  <span>¡Hola, {user.displayName}!</span>
                </h2>
                <p className="text-black/50 text-lg italic max-w-xl">
                  <span>Es un gusto tenerte de vuelta en la comunidad. Explora las últimas noticias y transmisiones en vivo de nuestra región.</span>
                </p>
              </div>
              <Link 
                to="/profile"
                className="group relative flex items-center gap-4 bg-black/[0.03] hover:bg-black/[0.06] p-4 pr-8 rounded-3xl transition-all duration-500 border border-black/[0.06]"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-brand/20 group-hover:border-brand transition-colors">
                  <img 
                    src={user.photoURL || defaultAvatar} 
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">Tu Perfil</p>
                  <p className="font-bold text-black group-hover:text-brand transition-colors">Ver mi cuenta</p>
                </div>
                <ArrowRight className="w-5 h-5 text-brand transform group-hover:translate-x-2 transition-transform" />
              </Link>
            </div>
          </motion.section>

          {/* Mixe Word of the Day */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="h-full"
          >
            <div className="glass p-8 md:p-10 rounded-3xl border-brand/20 shadow-lg shadow-black/[0.03] shadow-black/[0.04] shadow-brand/5 h-full flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand/10 rounded-full blur-3xl group-hover:bg-brand/20 transition-all duration-700" />
              <div className="flex items-center gap-3 text-brand mb-6">
                <Languages className="w-5 h-5" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">Palabra del Día (Mixe)</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-5xl font-display font-bold text-black italic tracking-tighter uppercase leading-none group-hover:text-brand transition-colors">
                  {mixeWord.mixe}
                </h3>
                <p className="text-black/50 text-sm font-medium italic">
                  Pronunciación: <span className="text-black/60">{mixeWord.pronunciation}</span>
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-black/5">
                <p className="text-2xl font-display font-bold text-black/80 italic">
                  "{mixeWord.spanish}"
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      )}

      {/* Live Streams Grid */}
      <section className="space-y-12">
        <div className="flex items-end justify-between px-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-brand">
              <Video className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Directo</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black/90"><span>En Vivo Ahora</span></h2>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-black/50 text-xs font-semibold uppercase tracking-wider">
            <div className="w-12 h-px bg-black/[0.06]" />
            <span>{streams.length} Transmisiones</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video glass rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {streams.map((stream) => (
              <Link
                key={stream.id}
                to={`/stream/${stream.id}`}
                className="group relative aspect-video rounded-3xl overflow-hidden glass glass-hover shadow-lg shadow-black/[0.03]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff4e00]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-black/[0.06] backdrop-blur-md rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-500">
                    <Play className="w-8 h-8 text-black fill-current" />
                  </div>
                </div>
                
                <div className="absolute top-6 left-6">
                  <div className="bg-rose-500 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider shadow-lg">
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)]/60 to-transparent">
                  <h3 className="text-xl font-display font-bold truncate group-hover:text-brand transition-colors duration-300">
                    {stream.title}
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3 text-xs font-bold text-black/60">
                      <div className="w-8 h-8 rounded-xl bg-black/[0.06] p-0.5 border border-black/[0.06]">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`} 
                          alt="avatar" 
                          className="w-full h-full rounded-[0.6rem] bg-[var(--bg-color)]"
                          loading="lazy"
                        />
                      </div>
                      <span className="tracking-widest uppercase">{stream.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-black/50 tracking-widest uppercase bg-black/[0.03] px-3 py-1.5 rounded-full">
                      <Users className="w-3 h-3 text-brand" />
                      <span>{stream.viewerCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center glass rounded-3xl border-dashed">
            <div className="w-20 h-20 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-black/10" />
            </div>
            <p className="text-black/50 font-display text-xl italic mb-8"><span>No hay transmisiones en vivo en este momento.</span></p>
            <Link to="/studio" className="bg-brand px-8 py-4 rounded-xl font-semibold uppercase tracking-wider hover:scale-105 transition-all">
              <span>¡Sé el primero en transmitir!</span>
            </Link>
          </div>
        )}
      </section>

      {/* Latest News Section */}
      <section className="space-y-12">
        <div className="flex items-end justify-between px-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-brand">
              <Newspaper className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Actualidad</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black/90"><span>Noticias Recientes</span></h2>
          </div>
          <Link to="/news" className="text-brand text-xs font-semibold uppercase tracking-[0.15em] flex items-center gap-3 hover:gap-5 transition-all duration-300">
            <span>Ver todas</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {news.map((article, index) => (
            <Link
              key={article.id}
              to="/news"
              className={`group glass rounded-3xl overflow-hidden glass-hover flex flex-col shadow-lg shadow-black/[0.03] ${index === 0 ? 'md:col-span-2 lg:col-span-2' : ''}`}
            >
              <div className={`relative overflow-hidden ${index === 0 ? 'aspect-[21/9]' : 'aspect-[4/3]'}`}>
                <img
                  src={article.imageUrl || `https://picsum.photos/seed/${article.id}/800/600`}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-color)] via-transparent to-transparent opacity-60" />
              </div>
              <div className="p-8 space-y-4">
                <h3 className={`font-display font-bold leading-tight group-hover:text-brand transition-colors duration-300 ${index === 0 ? 'text-3xl' : 'text-xl'}`}>
                  {article.title}
                </h3>
                <p className="text-black/50 text-sm line-clamp-2 italic leading-relaxed">
                  {article.content}
                </p>
                <div className="pt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
                  <span>Leer más</span>
                  <div className="w-8 h-px bg-brand/30" />
                </div>
              </div>
            </Link>
          ))}
          {news.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center glass rounded-3xl border-dashed">
              <p className="text-black/50 font-display text-lg italic"><span>No hay noticias recientes.</span></p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
