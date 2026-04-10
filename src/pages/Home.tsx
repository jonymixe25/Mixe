import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, orderBy, limit } from '../firebase';
import { StreamSession } from '../types';
import { Video, Users, Play, Radio, Newspaper, ArrowRight, Folder, Sparkles, Languages, Clock, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const Home: React.FC = () => {
  const { user } = useAuth();
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mixeWord, setMixeWord] = useState({ mixe: 'Määy', spanish: 'Buenos días', pronunciation: 'Ma-ai' });

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
    const streamsQuery = query(collection(db, 'streams'), where('status', '==', 'live'));
    const unsubscribeStreams = onSnapshot(streamsQuery, (snapshot) => {
      const liveStreams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreamSession));
      setStreams(liveStreams);
    }, (error) => {
      console.error('Error fetching live streams:', error);
    });

    const newsQuery = query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribeNews = onSnapshot(newsQuery, (snapshot) => {
      setNews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching news:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeStreams();
      unsubscribeNews();
    };
  }, []);

  return (
    <div className="space-y-20 md:space-y-32">
      {/* Hero Section */}
      <section className="relative h-[85vh] rounded-[3rem] overflow-hidden flex items-center justify-center group shadow-2xl shadow-black/50">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0502]/40 to-[#0a0502] z-10" />
        <motion.img
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          src="https://picsum.photos/seed/mixe-culture/1920/1080?blur=2"
          alt="Voz Mixe Hero"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 text-center max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="inline-block px-5 py-2 rounded-full bg-[#ff4e00]/10 border border-[#ff4e00]/30 text-[#ff4e00] text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-10 backdrop-blur-md"
          >
            <span>Cultura • Tradición • Comunidad</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl sm:text-8xl md:text-[10rem] font-display font-black tracking-tighter uppercase italic leading-[0.8] mb-10"
          >
            <span className="block">La Voz</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4e00] via-[#ff8c00] to-[#ff4e00] bg-[length:200%_auto] animate-gradient">
              Mixe
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-xl sm:text-2xl md:text-3xl text-white/60 font-medium italic max-w-3xl mx-auto leading-tight"
          >
            <span>"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.</span>
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-16 flex flex-wrap justify-center gap-6"
          >
            <Link 
              to="/news"
              className="w-full sm:w-auto bg-white text-black px-12 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#ff4e00] hover:text-white transition-all duration-500 transform hover:-translate-y-2 active:scale-95 shadow-2xl shadow-white/5"
            >
              <Newspaper className="w-6 h-6" />
              <span>Explorar Noticias</span>
            </Link>
            {streams.length > 0 && (
              <Link 
                to={`/stream/${streams[0].id}`}
                className="w-full sm:w-auto glass text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all duration-500 transform hover:-translate-y-2 active:scale-95"
              >
                <Radio className="w-6 h-6 text-[#ff4e00] animate-pulse" />
                <span>En Vivo Ahora</span>
              </Link>
            )}
            <Link 
              to="/web"
              className="w-full sm:w-auto bg-[#ff4e00] text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#ff8c00] transition-all duration-500 transform hover:-translate-y-2 active:scale-95 shadow-2xl shadow-[#ff4e00]/20"
            >
              <Folder className="w-6 h-6" />
              <span>Segunda Plataforma</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Welcome Message Section */}
      {user && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2">
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2"
          >
            <div className="glass p-8 md:p-12 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 border-white/10 shadow-2xl h-full">
              <div className="space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 text-[#ff4e00]">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-[0.3em]">Bienvenido de nuevo</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase italic leading-none">
                  <span>¡Hola, {user.displayName}!</span>
                </h2>
                <p className="text-white/40 text-lg italic max-w-xl">
                  <span>Es un gusto tenerte de vuelta en la comunidad. Explora las últimas noticias y transmisiones en vivo de nuestra región.</span>
                </p>
              </div>
              <Link 
                to="/profile"
                className="group relative flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 pr-8 rounded-[2rem] transition-all duration-500 border border-white/10"
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#ff4e00]/30 group-hover:border-[#ff4e00] transition-colors">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Tu Perfil</p>
                  <p className="font-bold text-white group-hover:text-[#ff4e00] transition-colors">Ver mi cuenta</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#ff4e00] transform group-hover:translate-x-2 transition-transform" />
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
            <div className="glass p-8 md:p-10 rounded-[3rem] border-[#ff4e00]/20 shadow-2xl shadow-[#ff4e00]/5 h-full flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#ff4e00]/10 rounded-full blur-3xl group-hover:bg-[#ff4e00]/20 transition-all duration-700" />
              <div className="flex items-center gap-3 text-[#ff4e00] mb-6">
                <Languages className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Palabra del Día (Mixe)</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-5xl font-display font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-[#ff4e00] transition-colors">
                  {mixeWord.mixe}
                </h3>
                <p className="text-white/40 text-sm font-medium italic">
                  Pronunciación: <span className="text-white/60">{mixeWord.pronunciation}</span>
                </p>
              </div>
              <div className="mt-8 pt-8 border-t border-white/5">
                <p className="text-2xl font-display font-bold text-white/80 italic">
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
            <div className="flex items-center gap-3 text-[#ff4e00]">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Directo</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase italic"><span>En Vivo Ahora</span></h2>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-white/40 text-xs font-black uppercase tracking-widest">
            <div className="w-12 h-px bg-white/10" />
            <span>{streams.length} Transmisiones</span>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video glass rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {streams.map((stream) => (
              <Link
                key={stream.id}
                to={`/stream/${stream.id}`}
                className="group relative aspect-video rounded-[2.5rem] overflow-hidden glass glass-hover shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff4e00]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-500">
                    <Play className="w-8 h-8 text-white fill-current" />
                  </div>
                </div>
                
                <div className="absolute top-6 left-6">
                  <div className="bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#0a0502] via-[#0a0502]/60 to-transparent">
                  <h3 className="text-xl font-display font-bold truncate group-hover:text-[#ff4e00] transition-colors duration-300">
                    {stream.title}
                  </h3>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-3 text-xs font-bold text-white/60">
                      <div className="w-8 h-8 rounded-xl bg-white/10 p-0.5 border border-white/10">
                        <img 
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`} 
                          alt="avatar" 
                          className="w-full h-full rounded-[0.6rem] bg-[#0a0502]"
                        />
                      </div>
                      <span className="tracking-widest uppercase">{stream.userName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-white/40 tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded-full">
                      <Users className="w-3 h-3 text-[#ff4e00]" />
                      <span>{stream.viewerCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center glass rounded-[3rem] border-dashed">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-white/10" />
            </div>
            <p className="text-white/40 font-display text-xl italic mb-8"><span>No hay transmisiones en vivo en este momento.</span></p>
            <Link to="/admin" className="bg-[#ff4e00] px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all">
              <span>¡Sé el primero en transmitir!</span>
            </Link>
          </div>
        )}
      </section>

      {/* Mixe Radio Section */}
      <section className="space-y-12">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[#ff4e00]">
              <Volume2 className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Radio en Línea</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase italic"><span>Radio Ayuujk</span></h2>
          </div>
        </div>
        <div className="glass p-8 md:p-12 rounded-[3rem] border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
            <Radio className="w-64 h-64 text-[#ff4e00]" />
          </div>
          <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
            <div className="w-48 h-48 bg-[#ff4e00] rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-[#ff4e00]/30 group-hover:rotate-6 transition-transform duration-700">
              <Radio className="w-24 h-24 text-white" />
            </div>
            <div className="flex-1 space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <h3 className="text-3xl font-display font-black uppercase italic tracking-tight">Sintonía Directa</h3>
                <p className="text-white/40 text-lg italic">Escucha la música y las voces de nuestra tierra en cualquier parte del mundo.</p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <button className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 hover:bg-[#ff4e00] hover:text-white transition-all shadow-xl">
                  <Play className="w-5 h-5 fill-current" />
                  <span>Escuchar Ahora</span>
                </button>
                <div className="glass px-8 py-5 rounded-2xl border-white/10 flex items-center gap-4">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">124 Oyentes en línea</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stream Schedule Section */}
      <section className="space-y-12">
        <div className="flex items-center gap-3 text-[#ff4e00] px-2">
          <Clock className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Programación</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
          {[
            { day: 'Lunes', time: '18:00', title: 'Música Tradicional', host: 'Juan P.' },
            { day: 'Miércoles', time: '19:30', title: 'Historias Ayuujk', host: 'María G.' },
            { day: 'Viernes', time: '20:00', title: 'Noticias de la Región', host: 'Pedro S.' },
            { day: 'Domingo', time: '10:00', title: 'Misa y Comunidad', host: 'Padre Luis' }
          ].map((item, i) => (
            <div key={i} className="glass p-6 rounded-[2rem] border-white/10 hover:border-[#ff4e00]/30 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">{item.day}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{item.time}</span>
              </div>
              <h4 className="font-bold text-sm group-hover:text-[#ff4e00] transition-colors mb-2">{item.title}</h4>
              <p className="text-[10px] text-white/20 font-black uppercase tracking-widest italic">{item.host}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Latest News Section */}
      <section className="space-y-12">
        <div className="flex items-end justify-between px-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-[#ff4e00]">
              <Newspaper className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Actualidad</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase italic"><span>Noticias Recientes</span></h2>
          </div>
          <Link to="/news" className="text-[#ff4e00] text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:gap-5 transition-all duration-300">
            <span>Ver todas</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {news.map((article, index) => (
            <Link
              key={article.id}
              to="/news"
              className={`group glass rounded-[2.5rem] overflow-hidden glass-hover flex flex-col shadow-xl ${index === 0 ? 'md:col-span-2 lg:col-span-2' : ''}`}
            >
              <div className={`relative overflow-hidden ${index === 0 ? 'aspect-[21/9]' : 'aspect-[4/3]'}`}>
                <img
                  src={article.imageUrl || `https://picsum.photos/seed/${article.id}/800/600`}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent opacity-60" />
              </div>
              <div className="p-8 space-y-4">
                <h3 className={`font-display font-bold leading-tight group-hover:text-[#ff4e00] transition-colors duration-300 ${index === 0 ? 'text-3xl' : 'text-xl'}`}>
                  {article.title}
                </h3>
                <p className="text-white/40 text-sm line-clamp-2 italic leading-relaxed">
                  {article.content}
                </p>
                <div className="pt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">
                  <span>Leer más</span>
                  <div className="w-8 h-px bg-[#ff4e00]/30" />
                </div>
              </div>
            </Link>
          ))}
          {news.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center glass rounded-[3rem] border-dashed">
              <p className="text-white/40 font-display text-lg italic"><span>No hay noticias recientes.</span></p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
