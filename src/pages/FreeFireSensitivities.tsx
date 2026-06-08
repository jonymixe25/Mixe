import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Target, Crosshair, Zap, ArrowLeft, Trophy, MousePointer2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const PhoneModelCard = ({ model, settings, icon: Icon }: { model: string, settings: any, icon: any }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[2.5rem] p-8 hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
  >
    {/* Decorative background accent */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700" />
    
    <div className="flex items-center gap-5 mb-8 relative z-10">
      <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center text-brand group-hover:rotate-12 transition-transform duration-500">
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <h3 className="text-2xl font-display font-bold text-black/90 dark:text-white/90">{model}</h3>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">Configuración Optimizada</p>
      </div>
    </div>

    <div className="space-y-4 relative z-10">
      {Object.entries(settings).map(([key, value]: [string, any]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">{key}</span>
            <span className="text-sm font-mono font-bold text-brand">{value}%</span>
          </div>
          <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${value}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-brand to-brand/60 rounded-full shadow-[0_0_10px_rgba(255,62,0,0.3)]"
            />
          </div>
        </div>
      ))}
    </div>

    <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-brand" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/60 dark:text-white/60">DPN Sugerido: 500-600</span>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1 bg-brand/5 rounded-full text-[9px] font-black text-brand uppercase tracking-tighter">
        Elite Config
      </div>
    </div>
  </motion.div>
);

export default function FreeFireSensitivities() {
  const models = [
    {
      model: "Motorola Moto G54",
      icon: Smartphone,
      settings: {
        "General": 98,
        "Mira Punto Rojo": 92,
        "Mira 2x": 88,
        "Mira 4x": 85,
        "Francotirador": 50,
        "Cámara": 100
      }
    },
    {
      model: "Honor X8c",
      icon: Zap,
      settings: {
        "General": 100,
        "Mira Punto Rojo": 95,
        "Mira 2x": 90,
        "Mira 4x": 88,
        "Francotirador": 45,
        "Cámara": 95
      }
    },
    {
      model: "Xiaomi Poco X3 Pro",
      icon: Trophy,
      settings: {
        "General": 95,
        "Mira Punto Rojo": 88,
        "Mira 2x": 85,
        "Mira 4x": 82,
        "Francotirador": 40,
        "Cámara": 90
      }
    },
    {
      model: "Samsung Galaxy A54",
      icon: MousePointer2,
      settings: {
        "General": 92,
        "Mira Punto Rojo": 85,
        "Mira 2x": 82,
        "Mira 4x": 80,
        "Francotirador": 45,
        "Cámara": 100
      }
    },
    {
      model: "iPhone 13 / 14",
      icon: Target,
      settings: {
        "General": 88,
        "Mira Punto Rojo": 82,
        "Mira 2x": 80,
        "Mira 4x": 78,
        "Francotirador": 50,
        "Cámara": 95
      }
    },
    {
      model: "Generic / Global",
      icon: Crosshair,
      settings: {
        "General": 95,
        "Mira Punto Rojo": 90,
        "Mira 2x": 85,
        "Mira 4x": 85,
        "Francotirador": 50,
        "Cámara": 100
      }
    }
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 sm:px-10 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 mb-16 px-4">
        <div className="space-y-4">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-black/40 hover:text-brand transition-colors text-[10px] font-bold uppercase tracking-widest group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Volver al Inicio
          </Link>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-black/90 dark:text-white/90">
              Sensibilidades <span className="text-brand">Free Fire</span>
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-black/30 dark:text-white/30 max-w-lg">
              Configuraciones maestras optimizadas para los modelos más populares. Domina el campo de batalla con precisión Ayuuk.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 p-6 glass rounded-[2rem] border-black/5 bg-brand/5">
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-widest text-black/40">Última Actualización</p>
            <p className="text-xs font-mono font-bold text-brand">JUNIO 2026</p>
          </div>
          <div className="w-px h-10 bg-black/10" />
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="w-8 h-8 rounded-full border-2 border-[var(--bg-color)] overflow-hidden">
                <img src={`https://i.pravatar.cc/150?u=${idx + 10}`} alt="user" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-[var(--bg-color)] bg-brand flex items-center justify-center text-[10px] font-bold text-white relative z-10">
              +1k
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Sensitivities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {models.map((item, idx) => (
          <PhoneModelCard 
            key={idx}
            model={item.model}
            settings={item.settings}
            icon={item.icon}
          />
        ))}
      </div>

      {/* Tips Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        className="mt-20 p-10 bg-brand text-black rounded-[3rem] relative overflow-hidden shadow-2xl group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-black/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:scale-125 transition-transform duration-1000" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold font-display">Respuesta Táctil</h4>
            <p className="text-sm font-medium opacity-80 leading-relaxed uppercase tracking-tight text-[10px]">
              Limpia tu pantalla regularmente y usa micas de cristal templado de alta calidad para no afectar la sensibilidad.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <Target className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold font-display">Ajuste de DPI</h4>
            <p className="text-sm font-medium opacity-80 leading-relaxed uppercase tracking-tight text-[10px]">
              Si sientes que la mira sube demasiado lento, aumenta el DPI de tu celular en opciones de desarrollador paso a paso.
            </p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <Crosshair className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold font-display">Práctica Diaria</h4>
            <p className="text-sm font-medium opacity-80 leading-relaxed uppercase tracking-tight text-[10px]">
              Visita el campo de entrenamiento antes de entrar a clasificatoria para calentar tus dedos y ajustar el "auto-head".
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
