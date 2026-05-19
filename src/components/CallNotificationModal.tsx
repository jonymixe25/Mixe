import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, X } from 'lucide-react';
import { Call } from '../types';

interface Props {
  call: Call;
  onAccept: (call: Call) => void;
  onDecline: (call: Call) => void;
}

const CallNotificationModal: React.FC<Props> = ({ call, onAccept, onDecline }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="fixed bottom-8 right-8 z-[500] w-96 bg-[#1a1a1a] border border-brand/20 p-6 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-brand/5 animate-pulse" />
        <h3 className="text-white font-bold text-lg mb-2 relative z-10">Llamada Entrante</h3>
        <p className="text-white/60 mb-6 text-sm relative z-10">Tienes una nueva llamada de contacto.</p>
        <div className="flex gap-4 relative z-10">
          <button 
            onClick={() => onAccept(call)} 
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black py-3 rounded-xl font-bold transition-all"
          >
            Aceptar
          </button>
          <button 
            onClick={() => onDecline(call)} 
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold transition-all"
          >
            Rechazar
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallNotificationModal;
