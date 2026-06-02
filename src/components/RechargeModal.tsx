import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, doc, updateDoc, increment } from '../firebase';
import { COIN_PACKAGES, CoinPackage } from '../data/gifts';
import { Coins, CreditCard, Sparkles, Loader2, CheckCircle2, ChevronRight, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [step, setStep] = useState<'packages' | 'payment' | 'success'>('packages');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('4000 1234 5678 9010');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');

  if (!isOpen) return null;

  const handleSelectPackage = (pkg: CoinPackage) => {
    if (!user) return;
    setSelectedPackage(pkg);
    setCardName(user.displayName || '');
    setStep('payment');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPackage) return;

    setIsProcessing(true);
    // Simulate transaction delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const userRef = doc(db, 'users', user.uid);
      const coinsToAdd = selectedPackage.coins + selectedPackage.bonusCoins;
      
      await updateDoc(userRef, {
        coins: increment(coinsToAdd)
      });

      setStep('success');
    } catch (err) {
      console.error("Error setting coin transaction:", err);
      alert("Hubo un problema al procesar la simulated compra.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentCoins = user?.coins ?? 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isProcessing) {
              onClose();
              // Reset values
              setStep('packages');
              setSelectedPackage(null);
            }
          }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[var(--card-bg)] border border-[var(--border-color)] shadow-2xl rounded-3xl overflow-hidden z-10 text-[var(--text-color)] max-h-[90vh] flex flex-col backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between bg-black/[0.01]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                <Coins className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display leading-tight">Centro de Monedas Ayuuk</h3>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-40">Recarga saldo virtual para regalos</p>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={() => {
                  onClose();
                  setStep('packages');
                  setSelectedPackage(null);
                }}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[var(--text-color)] opacity-40 hover:opacity-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Current balance band */}
          {user && (
            <div className="px-6 py-3 bg-brand/5 border-b border-[var(--border-color)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-50">Tu Saldo Actual:</span>
              <div className="flex items-center gap-1.5 bg-brand/10 px-3 py-1 rounded-xl border border-brand/15">
                <Coins className="w-3.5 h-3.5 text-brand fill-current" />
                <span className="text-xs font-mono font-bold text-brand">{currentCoins} M.A.</span>
              </div>
            </div>
          )}

          {/* Scrollable Content wrapper */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {!user ? (
              <div className="text-center py-8 space-y-3">
                <AlertCircle className="w-12 h-12 text-black/30 mx-auto" />
                <p className="text-sm font-semibold text-black/60">Debes iniciar sesión para recargar monedas de apoyo.</p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {step === 'packages' && (
                  <motion.div
                    key="packages"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-[var(--text-color)]/5 border border-[var(--border-color)] rounded-2xl">
                      <p className="text-[10px] text-[var(--text-color)] opacity-50 leading-relaxed font-medium">
                        Adquiere <strong className="text-brand">Monedas Ayuuk (M.A.)</strong> para cambiarlas por coloridos e interactivos regalos virtuales que destacan en el chat y apoyan a tus sabios expositores y artistas locales.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {COIN_PACKAGES.map((pkg) => (
                        <div
                          key={pkg.id}
                          onClick={() => handleSelectPackage(pkg)}
                          className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-brand/40 hover:bg-brand/[0.01] rounded-2xl p-5 cursor-pointer transition-all hover:shadow-[0_12px_24px_rgba(0,0,0,0.02)] active:scale-[0.98] flex flex-col justify-between"
                        >
                          {pkg.badge && (
                            <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-brand text-black shadow-md">
                              {pkg.badge}
                            </span>
                          )}

                          <div className="space-y-1">
                            <span className="text-[9px] font-extrabold text-[var(--text-color)] opacity-30 uppercase tracking-widest block">
                              {pkg.title}
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-mono font-bold tracking-tight text-[var(--text-color)] flex items-center gap-1.5">
                                <Coins className="w-5 h-5 text-brand fill-current shrink-0" />
                                {pkg.coins}
                              </span>
                              {pkg.bonusCoins > 0 && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                  +{pkg.bonusCoins} de Regalo
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--text-color)] opacity-40">Precio</span>
                            <span className="text-sm font-extrabold text-brand flex items-center gap-1">
                              ${pkg.priceUSD.toFixed(2)} USD
                              <ChevronRight className="w-4 h-4 text-[var(--text-color)] opacity-20 group-hover:text-brand transition-colors" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 'payment' && selectedPackage && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="bg-[var(--text-color)]/5 border border-[var(--border-color)] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-extrabold text-[var(--text-color)] opacity-30 uppercase tracking-wider">Paquete Seleccionado</span>
                        <div className="font-bold flex items-center gap-1.5 text-[var(--text-color)]">
                          <Coins className="w-4 h-4 text-brand fill-current" />
                          {selectedPackage.coins} M.A. {selectedPackage.bonusCoins > 0 && `(+${selectedPackage.bonusCoins})`}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-extrabold text-[var(--text-color)] opacity-30 uppercase tracking-wider block">Total a Pagar</span>
                        <span className="text-lg font-extrabold text-brand">${selectedPackage.priceUSD.toFixed(2)} USD</span>
                      </div>
                    </div>

                    <form onSubmit={handleConfirmPayment} className="space-y-4">
                      <div className="p-4 bg-black/5 dark:bg-white/5 border border-dashed border-[var(--border-color)] rounded-2xl">
                        <div className="flex gap-2.5 items-start">
                          <CreditCard className="w-5 h-5 text-brand mt-0.5" />
                          <div className="space-y-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider">Simulación de Pago con Tarjeta de Pruebas</h4>
                            <p className="text-[9px] text-[var(--text-color)] opacity-40 leading-relaxed font-semibold">
                              ¡Esta es una pasarela de pruebas 100% simulada! No se te cobrará dinero real.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-50">Nombre del Titular</label>
                          <input
                            type="text"
                            required
                            disabled={isProcessing}
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-xl px-4 py-3 text-xs font-semibold"
                            placeholder="Nombre Completo"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-50">Número de Tarjeta</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              disabled={isProcessing}
                              maxLength={19}
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value)}
                              className="w-full bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-xl pl-10 pr-4 py-3 text-xs font-mono font-bold"
                              placeholder="4000 1234 5678 9010"
                            />
                            <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-color)] opacity-30" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-50">Fecha de Vence</label>
                            <input
                              type="text"
                              required
                              disabled={isProcessing}
                              maxLength={5}
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-xl px-4 py-3 text-xs font-mono font-bold text-center"
                              placeholder="MM/AA"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-color)] opacity-50">CVV</label>
                            <input
                              type="password"
                              required
                              disabled={isProcessing}
                              maxLength={3}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value)}
                              className="w-full bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] focus:border-brand/40 outline-none rounded-xl px-4 py-3 text-xs font-mono font-bold text-center"
                              placeholder="•••"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 flex gap-3">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => setStep('packages')}
                          className="flex-1 border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-color)] text-[10px] font-bold uppercase tracking-wider py-4 rounded-xl transition-all"
                        >
                          Atrás
                        </button>
                        <button
                          type="submit"
                          disabled={isProcessing}
                          className="flex-1 bg-brand text-black text-[10px] font-bold uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-brand/20 hover:bg-brand/90 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Procesando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Confirmar ${selectedPackage.priceUSD.toFixed(2)} USD</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {step === 'success' && selectedPackage && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center py-6 space-y-5"
                  >
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xl font-bold font-display">¡Compra Simulada Exitosa!</h4>
                      <p className="text-[10px] text-[var(--text-color)] opacity-50 leading-relaxed font-semibold">
                        Se han agregado <strong className="text-brand">{selectedPackage.coins + selectedPackage.bonusCoins} Monedas Ayuuk</strong> a tu cuenta de manera recreativa para patrocinar a tus creadores preferidos.
                      </p>
                    </div>

                    {/* Cute animated visual coin box inside success state */}
                    <div className="py-4 px-6 bg-brand/5 border border-brand/10 rounded-2xl w-fit mx-auto flex items-center gap-2.5">
                      <div className="p-2 bg-brand/10 rounded-xl">
                        <Coins className="w-5 h-5 text-brand fill-current animate-bounce" />
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-[8px] font-extrabold text-[var(--text-color)] opacity-30 uppercase tracking-wider block">Nuevo Saldo</span>
                        <span className="text-sm font-bold text-brand">{currentCoins} M.A.</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        setStep('packages');
                        setSelectedPackage(null);
                      }}
                      className="w-full bg-brand text-black text-[10px] font-bold uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Volver a Vida Mixe
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
