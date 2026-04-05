import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot } from '../firebase';
import { Newspaper, Calendar, User, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  authorName: string;
  imageUrl?: string;
  createdAt: any;
}

const News: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setArticles(newsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching news:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center">
          <Newspaper className="w-6 h-6 text-[#ff4e00]" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase italic"><span>Noticias y Cultura</span></h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[400px] bg-white/5 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {articles.map((article) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
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
              
              <div className="p-6 lg:p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 lg:mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>{article.createdAt?.seconds ? format(new Date(article.createdAt.seconds * 1000), 'dd MMM, yyyy', { locale: es }) : 'Reciente'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    <span>{article.authorName}</span>
                  </div>
                </div>

                <h2 className="text-xl lg:text-2xl font-bold mb-3 lg:mb-4 group-hover:text-[#ff4e00] transition-colors">
                  {article.title}
                </h2>
                
                <p className="text-white/60 text-xs lg:text-sm leading-relaxed line-clamp-3 mb-4 lg:mb-6 italic">
                  {article.content}
                </p>

                <div className="mt-auto">
                  <button 
                    onClick={() => setSelectedArticle(article)}
                    className="flex items-center gap-2 text-[#ff4e00] font-bold text-sm hover:gap-3 transition-all"
                  >
                    <span>Leer más</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Newspaper className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 font-medium italic"><span>No hay noticias publicadas en este momento.</span></p>
        </div>
      )}

      {/* News Detail Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div 
            key="news-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[#0a0502] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedArticle(null)}
                className="absolute top-6 right-6 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="overflow-y-auto">
                <div className="aspect-video relative">
                  <img
                    src={selectedArticle.imageUrl || `https://picsum.photos/seed/${selectedArticle.id}/1200/675`}
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent" />
                </div>

                <div className="p-8 sm:p-12 space-y-6">
                  <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-white/40">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#ff4e00]" />
                      <span>{selectedArticle.createdAt?.seconds ? format(new Date(selectedArticle.createdAt.seconds * 1000), 'dd MMMM, yyyy', { locale: es }) : 'Reciente'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#ff4e00]" />
                      <span>{selectedArticle.authorName}</span>
                    </div>
                  </div>

                  <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase italic leading-tight">
                    {selectedArticle.title}
                  </h2>

                  <div className="h-px bg-white/10 w-24" />

                  <div className="text-white/80 text-lg leading-relaxed italic whitespace-pre-wrap">
                    {selectedArticle.content}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default News;
