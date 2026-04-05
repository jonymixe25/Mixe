import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, orderBy, limit } from '../firebase';
import { StreamSession } from '../types';
import { Video, Users, Play, Radio, Newspaper, ArrowRight } from 'lucide-react';
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
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative h-[70vh] rounded-[2.5rem] overflow-hidden flex items-center justify-center group">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0502]/40 to-[#0a0502] z-10" />
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          src="https://picsum.photos/seed/mixe-culture/1920/1080?blur=2"
          alt="Voz Mixe Hero"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 text-center max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-block px-4 py-1.5 rounded-full bg-[#ff4e00]/20 border border-[#ff4e00]/30 text-[#ff4e00] text-[10px] font-bold uppercase tracking-[0.2em] mb-8"
          >
            <span>Cultura • Tradición • Comunidad</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter uppercase italic leading-[0.85] mb-8"
          >
            <span>La Voz</span> <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4e00] via-[#ff8c00] to-[#ff4e00] bg-[length:200%_auto] animate-gradient">
              Mixe
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg sm:text-2xl text-white/70 font-medium italic max-w-2xl mx-auto leading-relaxed"
          >
            <span>"La región de los jamás conquistados" — Conectando al pueblo Mixe a través de la tecnología.</span>
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap justify-center gap-6"
          >
            <Link 
              to="/news"
              className="w-full sm:w-auto bg-white text-black px-10 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-[#ff4e00] hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-xl shadow-white/5"
            >
              <Newspaper className="w-5 h-5" />
              <span>Explorar Noticias</span>
            </Link>
            {streams.length > 0 && (
              <Link 
                to={`/stream/${streams[0].id}`}
                className="w-full sm:w-auto bg-white/10 backdrop-blur-md border border-white/20 text-white px-10 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/20 transition-all transform hover:-translate-y-1 active:scale-95"
              >
                <Radio className="w-5 h-5 text-[#ff4e00] animate-pulse" />
                <span>Ver Transmisión en Vivo</span>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Live Streams Grid */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-[#ff4e00] animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight uppercase italic"><span>En Vivo Ahora</span></h2>
          </div>
          <span className="text-white/40 text-sm font-medium uppercase tracking-widest">
            <span>{streams.length} Transmisiones</span>
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-video bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {streams.map((stream) => (
              <Link
                key={stream.id}
                to={`/stream/${stream.id}`}
                className="group relative aspect-video rounded-3xl overflow-hidden bg-white/5 border border-white/10 hover:border-[#ff4e00]/50 transition-all flex flex-col items-center justify-center"
              >
                {stream.thumbnailUrl ? (
                  <img 
                    src={stream.thumbnailUrl} 
                    alt={stream.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#ff4e00]/10 to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />
                )}
                <Video className="w-12 h-12 text-white/10 group-hover:text-[#ff4e00]/20 transition-colors relative z-10" />
                
                <div className="absolute top-4 left-4">
                  <div className="bg-red-600 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span>Live</span>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-lg font-bold truncate group-hover:text-[#ff4e00] transition-colors">
                    {stream.title}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <div className="w-5 h-5 rounded-full bg-white/20 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.userId}`} alt="avatar" />
                      </div>
                      <span>{stream.userName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-white/60">
                      <Users className="w-3 h-3" />
                      <span>{stream.viewerCount}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
            <Video className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 font-medium italic"><span>No hay transmisiones en vivo en este momento.</span></p>
            <Link to="/admin" className="mt-4 inline-block text-[#ff4e00] font-bold hover:underline">
              <span>¡Sé el primero en transmitir!</span>
            </Link>
          </div>
        )}
      </section>

      {/* Latest News Section */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-[#ff4e00]" />
            <h2 className="text-2xl font-bold tracking-tight uppercase italic"><span>Noticias Recientes</span></h2>
          </div>
          <Link to="/news" className="text-[#ff4e00] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:underline">
            <span>Ver todas</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {news.map((article) => (
            <Link
              key={article.id}
              to="/news"
              className="group bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-[#ff4e00]/30 transition-all flex flex-col"
            >
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={article.imageUrl || `https://picsum.photos/seed/${article.id}/800/450`}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2 group-hover:text-[#ff4e00] transition-colors line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-white/40 text-xs line-clamp-2 italic">
                  {article.content}
                </p>
              </div>
            </Link>
          ))}
          {news.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
              <p className="text-white/40 italic"><span>No hay noticias recientes.</span></p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
