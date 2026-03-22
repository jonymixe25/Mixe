import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot } from '../firebase';
import { Newspaper, Calendar, User, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
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
        <h1 className="text-3xl font-bold tracking-tight uppercase italic">Noticias y Cultura</h1>
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
              
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {article.createdAt?.seconds ? format(new Date(article.createdAt.seconds * 1000), 'dd MMM, yyyy', { locale: es }) : 'Reciente'}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {article.authorName}
                  </div>
                </div>

                <h2 className="text-2xl font-bold mb-4 group-hover:text-[#ff4e00] transition-colors">
                  {article.title}
                </h2>
                
                <p className="text-white/60 text-sm leading-relaxed line-clamp-3 mb-6 italic">
                  {article.content}
                </p>

                <div className="mt-auto">
                  <button className="flex items-center gap-2 text-[#ff4e00] font-bold text-sm hover:gap-3 transition-all">
                    Leer más
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
          <p className="text-white/40 font-medium italic">No hay noticias publicadas en este momento.</p>
        </div>
      )}
    </div>
  );
};

export default News;
