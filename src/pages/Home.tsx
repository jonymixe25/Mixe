import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, orderBy, limit } from '../firebase';
import { StreamSession } from '../types';
import { Video, Users, Play, Radio, Newspaper, ArrowRight, Folder } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
            <a 
              href="./web.php"
              className="w-full sm:w-auto bg-[#ff4e00] text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#ff8c00] transition-all duration-500 transform hover:-translate-y-2 active:scale-95 shadow-2xl shadow-[#ff4e00]/20"
            >
              <Folder className="w-6 h-6" />
              <span>Segunda Plataforma</span>
            </a>
          </motion.div>
        </div>
      </section>

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
