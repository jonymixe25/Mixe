import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from '../firebase';
import { Newspaper, Calendar, User, ArrowRight, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Comment } from '../types';
import { useAuth } from '../AuthContext';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  authorName: string;
  imageUrl?: string;
  createdAt: any;
}

const News: React.FC = () => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!selectedArticle) return;
    const q = query(collection(db, 'news', selectedArticle.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(commentList);
    });
    return () => unsubscribe();
  }, [selectedArticle]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedArticle || !newComment.trim()) return;
    try {
      await addDoc(collection(db, 'news', selectedArticle.id, 'comments'), {
        newsId: selectedArticle.id,
        userId: user.uid,
        userName: user.displayName,
        text: newComment,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

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
    <div className="max-w-7xl mx-auto space-y-16 md:space-y-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[#ff4e00]">
            <Newspaper className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.3em]">Actualidad</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter uppercase italic"><span>Noticias y Cultura</span></h1>
          <p className="text-white/40 text-sm font-medium italic max-w-md leading-relaxed">
            <span>Explora las últimas novedades, historias y tradiciones de la región Mixe.</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-4 text-white/20 text-xs font-black uppercase tracking-widest">
          <div className="w-16 h-px bg-white/10" />
          <span>{articles.length} Artículos</span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[500px] glass rounded-[3rem] animate-pulse" />
          ))}
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
          {articles.map((article) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="group glass rounded-[3rem] overflow-hidden glass-hover flex flex-col shadow-2xl shadow-black/50"
            >
              <div className="aspect-[16/10] relative overflow-hidden">
                <img
                  src={article.imageUrl || `https://picsum.photos/seed/${article.id}/1200/750`}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-[#0a0502]/20 to-transparent opacity-60" />
                
                <div className="absolute top-8 left-8">
                  <div className="glass px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff4e00]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{article.createdAt?.seconds ? format(new Date(article.createdAt.seconds * 1000), 'dd MMM, yyyy', { locale: es }) : 'Reciente'}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-10 lg:p-12 flex-1 flex flex-col space-y-6">
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-white/5 p-0.5 border border-white/10">
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${article.authorName}`} 
                        alt="author" 
                        className="w-full h-full rounded-[0.3rem] bg-[#0a0502]"
                      />
                    </div>
                    <span>{article.authorName}</span>
                  </div>
                  <div className="w-1 h-1 bg-white/20 rounded-full" />
                  <span>Cultura</span>
                </div>

                <h2 className="text-3xl lg:text-4xl font-display font-black leading-[1.1] tracking-tight group-hover:text-[#ff4e00] transition-colors duration-500">
                  {article.title}
                </h2>
                
                <p className="text-white/60 text-sm lg:text-base leading-relaxed line-clamp-3 italic font-medium">
                  {article.content}
                </p>

                <div className="pt-6 mt-auto">
                  <button 
                    onClick={() => setSelectedArticle(article)}
                    className="group/btn flex items-center gap-4 text-[#ff4e00] font-black text-xs uppercase tracking-[0.2em] hover:gap-6 transition-all duration-300"
                  >
                    <span>Seguir leyendo</span>
                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="py-32 text-center glass rounded-[4rem] border-dashed">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
            <Newspaper className="w-12 h-12 text-white/10" />
          </div>
          <p className="text-white/40 font-display text-2xl italic"><span>No hay noticias publicadas en este momento.</span></p>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-5xl glass border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setSelectedArticle(null)}
                className="absolute top-8 right-8 z-50 p-3 rounded-2xl bg-black/40 text-white hover:bg-[#ff4e00] transition-all duration-300 group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>

              <div className="overflow-y-auto custom-scrollbar">
                <div className="aspect-[21/9] relative">
                  <img
                    src={selectedArticle.imageUrl || `https://picsum.photos/seed/${selectedArticle.id}/1600/900`}
                    alt={selectedArticle.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0502] via-transparent to-transparent opacity-80" />
                </div>

                <div className="p-10 sm:p-20 space-y-10">
                  <div className="flex flex-wrap items-center gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-[#ff4e00]" />
                      <span>{selectedArticle.createdAt?.seconds ? format(new Date(selectedArticle.createdAt.seconds * 1000), 'dd MMMM, yyyy', { locale: es }) : 'Reciente'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-[#ff4e00]" />
                      <span>{selectedArticle.authorName}</span>
                    </div>
                  </div>

                  <h2 className="text-4xl sm:text-6xl md:text-7xl font-display font-black tracking-tighter uppercase italic leading-[0.95]">
                    {selectedArticle.title}
                  </h2>

                  <div className="w-32 h-1 bg-gradient-to-r from-[#ff4e00] to-transparent rounded-full" />

                  <div className="text-white/80 text-xl md:text-2xl leading-relaxed italic whitespace-pre-wrap font-medium max-w-4xl">
                    {selectedArticle.content}
                  </div>
                  
                  <div className="pt-12 flex items-center gap-6">
                    <button 
                      onClick={() => setSelectedArticle(null)}
                      className="bg-white text-black px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#ff4e00] hover:text-white transition-all duration-500"
                    >
                      <span>Cerrar Artículo</span>
                    </button>
                  </div>
                  
                  <div className="pt-12 border-t border-white/10 space-y-8">
                    <h3 className="text-2xl font-display font-black uppercase italic">Comentarios</h3>
                    {user ? (
                      <form onSubmit={handlePostComment} className="space-y-4">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:border-[#ff4e00] outline-none"
                          placeholder="Escribe un comentario..."
                        />
                        <button type="submit" className="bg-[#ff4e00] text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs">Publicar</button>
                      </form>
                    ) : (
                      <p className="text-white/40 italic">Inicia sesión para comentar.</p>
                    )}
                    <div className="space-y-6">
                      {comments.map(comment => (
                        <div key={comment.id} className="bg-white/5 p-4 rounded-2xl space-y-2">
                          <p className="text-[#ff4e00] font-black text-xs uppercase">{comment.userName}</p>
                          <p className="text-sm text-white/80">{comment.text}</p>
                        </div>
                      ))}
                    </div>
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
