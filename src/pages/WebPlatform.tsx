import React from 'react';
import { motion } from 'motion/react';
import { Globe, ArrowLeft, ExternalLink, Shield, Zap, Cloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WebPlatform: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Shield, title: 'Seguridad Avanzada', desc: 'Protección de datos de nivel empresarial para toda la comunidad.' },
    { icon: Zap, title: 'Alta Velocidad', desc: 'Optimizado para conexiones rurales con baja latencia.' },
    { icon: Cloud, title: 'Nube Mixe', desc: 'Almacenamiento compartido para archivos culturales y educativos.' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-20">
      {/* Hero */}
      <section className="relative h-[60vh] rounded-[3rem] overflow-hidden flex items-center justify-center group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0502]/60 to-[#0a0502] z-10" />
        <img 
          src="https://picsum.photos/seed/digital-mixe/1920/1080" 
          alt="Digital Mixe" 
          className="absolute inset-0 w-full h-full object-cover opacity-50"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-20 text-center space-y-8 px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-24 h-24 bg-[#ff4e00] rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-[#ff4e00]/30"
          >
            <Globe className="w-12 h-12 text-white" />
          </motion.div>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter uppercase italic">
              Voz Mixe <span className="text-[#ff4e00]">Web</span>
            </h1>
            <p className="text-xl text-white/40 italic max-w-2xl mx-auto">
              La extensión digital de nuestra cultura. Accede a herramientas exclusivas y recursos comunitarios.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass p-10 rounded-[2.5rem] border-white/10 space-y-6 hover:border-[#ff4e00]/30 transition-colors group"
          >
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-[#ff4e00]/10 transition-colors">
              <f.icon className="w-7 h-7 text-[#ff4e00]" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold uppercase italic">{f.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed italic">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Action */}
      <section className="glass p-12 md:p-20 rounded-[3rem] border-white/10 text-center space-y-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4e00]/5 blur-[120px] rounded-full" />
        <div className="space-y-4 relative z-10">
          <h2 className="text-4xl md:text-5xl font-display font-black tracking-tighter uppercase italic">¿Listo para explorar?</h2>
          <p className="text-white/40 text-lg italic max-w-xl mx-auto">
            Esta plataforma está en fase beta. Pronto podrás gestionar tus propios proyectos comunitarios aquí.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-6 relative z-10">
          <button 
            onClick={() => navigate('/')}
            className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 hover:bg-[#ff4e00] hover:text-white transition-all transform hover:-translate-y-1"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver al Inicio</span>
          </button>
          <button className="glass px-10 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 border-white/10 hover:bg-white/5 transition-all transform hover:-translate-y-1">
            <span>Saber Más</span>
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default WebPlatform;
