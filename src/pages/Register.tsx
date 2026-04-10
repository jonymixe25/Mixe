import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, UserPlus, LogIn, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import Toast from '../components/Toast';
import { db, doc, getDoc } from '../firebase';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    repeatPassword: '',
    email: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  
  const navigate = useNavigate();
  const { registerWithEmail, login, user } = useAuth();

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setRegistrationEnabled(settingsDoc.data().registrationEnabled ?? true);
        }
      } catch (error) {
        console.error('Error checking registration settings:', error);
      } finally {
        setCheckingSettings(false);
      }
    };
    checkSettings();
  }, []);

  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.repeatPassword) {
      setToast({ message: 'Las contraseñas no coinciden', type: 'error', isVisible: true });
      return;
    }
    if (formData.password.length < 6) {
      setToast({ message: 'La contraseña debe tener al menos 6 caracteres', type: 'error', isVisible: true });
      return;
    }
    try {
      await registerWithEmail(formData.email, formData.password, formData.username);
    } catch (error: any) {
      console.error('Registration error:', error);
      let message = 'Error al registrarse';
      if (error.code === 'auth/email-already-in-use') {
        message = 'El correo electrónico ya está en uso.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Correo electrónico inválido.';
      } else if (error.code === 'auth/weak-password') {
        message = 'La contraseña es muy débil.';
      }
      setToast({ message, type: 'error', isVisible: true });
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      await login();
    } catch (error: any) {
      console.error('Google login error:', error);
      let message = 'Error al iniciar sesión con Google';
      if (error.code === 'auth/popup-blocked') {
        message = 'El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes.';
      }
      setToast({ message, type: 'error', isVisible: true });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (checkingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff4e00]"></div>
      </div>
    );
  }

  if (!registrationEnabled) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-12 rounded-[3rem] text-center space-y-8 border-yellow-500/20 shadow-2xl"
        >
          <div className="w-20 h-20 bg-yellow-500/10 rounded-2xl flex items-center justify-center mx-auto border border-yellow-500/20">
            <ShieldAlert className="w-10 h-10 text-yellow-500" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-black tracking-tighter uppercase italic">Registros <span className="text-yellow-500">Cerrados</span></h2>
            <p className="text-white/40 text-lg italic">
              Lo sentimos, el registro de nuevos usuarios está deshabilitado temporalmente por el administrador.
            </p>
          </div>
          <div className="pt-8 border-t border-white/5">
            <Link to="/" className="text-[#ff4e00] font-black uppercase tracking-widest text-xs hover:underline">
              Volver al Inicio
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 md:p-12 rounded-[3rem] shadow-2xl border-white/10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#ff4e00]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#ff4e00]/20">
            <UserPlus className="w-8 h-8 text-[#ff4e00]" />
          </div>
          <h2 className="text-4xl font-display font-black tracking-tighter uppercase italic mb-4">Crear Cuenta</h2>
          <p className="text-white/40 text-sm font-medium tracking-widest uppercase italic">Únete a la comunidad Voz Mixe</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full bg-white text-black p-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{isGoogleLoading ? 'Cargando...' : 'Google'}</span>
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]">
                <span className="px-4 bg-[#0a0502] text-white/20">O usa tu correo</span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Nombre de Usuario</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. MixeDigital" 
                  onChange={(e) => setFormData({...formData, username: e.target.value})} 
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-[#ff4e00] outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Correo Electrónico</label>
                <input 
                  type="email" 
                  required
                  placeholder="usuario@ejemplo.com" 
                  onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-[#ff4e00] outline-none transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Contraseña</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required
                    placeholder="••••••••" 
                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-[#ff4e00] outline-none transition-all" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 top-4 text-white/30 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Repetir Contraseña</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  onChange={(e) => setFormData({...formData, repeatPassword: e.target.value})} 
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-[#ff4e00] outline-none transition-all" 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#ff4e00] p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#ff8c00] transition-all transform active:scale-95 shadow-xl shadow-[#ff4e00]/20 mt-4"
              >
                Crear Cuenta
              </button>
            </form>
          </div>

          <div className="hidden md:flex flex-col justify-center space-y-8 border-l border-white/5 pl-12">
            <div className="space-y-4">
              <h4 className="text-xl font-display font-bold text-[#ff4e00] italic">¿Por qué unirse?</h4>
              <ul className="space-y-4">
                {[
                  'Acceso a transmisiones exclusivas',
                  'Conecta con otros miembros de la comunidad',
                  'Comparte tus propios archivos y medios',
                  'Mantente al día con las noticias locales'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-white/50 italic">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff4e00] mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10">
              <p className="text-xs text-white/40 italic leading-relaxed">
                Al registrarte, aceptas nuestros términos de servicio y política de privacidad. Tu información está segura con nosotros.
              </p>
            </div>

            <div className="text-center pt-4">
              <p className="text-xs text-white/40 font-black uppercase tracking-widest mb-4">¿Ya tienes cuenta?</p>
              <Link 
                to="/" 
                className="inline-flex items-center gap-2 text-[#ff4e00] font-black uppercase tracking-widest text-xs hover:gap-4 transition-all"
              >
                <span>Iniciar Sesión</span>
                <LogIn className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default Register;
