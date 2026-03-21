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
      <section className="relative h-[60vh] rounded-3xl overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0502]/60 to-[#0a0502] z-10" />
        <img
          src="https://picsum.photos/seed/mixe/1920/1080?blur=2"
          alt="Voz Mixe Hero"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 text-center max-w-3xl px-4">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-none"
          >
            La Voz <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4e00] to-[#ff8c00]">
              De La Cultura Mixe
            </span>
          </motion.h1>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-white/60 font-medium italic">
            La región de los jamás conquistados
          </p>
          <div className="mt-8 sm:mt-10 flex flex-wrap justify-center gap-4">
            <button className="w-full sm:w-auto bg-[#ff4e00] text-white px-8 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-current" />
              Ver en Pantalla Completa
            </button>
          </div>
        </div>
      </section>

      {/* Live Streams Grid */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-[#ff4e00] animate-pulse" />
            <h2 className="text-2xl font-bold tracking-tight uppercase italic">En Vivo Ahora</h2>
          </div>
          <span className="text-white/40 text-sm font-medium uppercase tracking-widest">
            {streams.length} Transmisiones
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
                className="group relative aspect-video rounded-3xl overflow-hidden bg-white/5 border border-white/10 hover:border-[#ff4e00]/50 transition-all"
              >
                <img
                  src={stream.thumbnailUrl || `https://picsum.photos/seed/${stream.id}/800/450`}
                  alt={stream.title}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute top-4 left-4">
                  <div className="bg-red-600 px-2 py-1 rounded-md flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    Live
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
            <p className="text-white/40 font-medium italic">No hay transmisiones en vivo en este momento.</p>
            <Link to="/admin" className="mt-4 inline-block text-[#ff4e00] font-bold hover:underline">
              ¡Sé el primero en transmitir!
            </Link>
          </div>
        )}
      </section>

      {/* Latest News Section */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-[#ff4e00]" />
            <h2 className="text-2xl font-bold tracking-tight uppercase italic">Noticias Recientes</h2>
          </div>
          <Link to="/news" className="text-[#ff4e00] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:underline">
            Ver todas
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
              <p className="text-white/40 italic">No hay noticias recientes.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
