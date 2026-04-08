import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import Toast from './Toast';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const { loginWithEmail, login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isOpen) {
      navigate('/profile');
      onClose();
    }
  }, [user, isOpen, navigate, onClose]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginWithEmail(email, password);
    } catch (error) {
      console.error('Login error:', error);
      setToast({ message: 'Error al iniciar sesión', type: 'error', isVisible: true });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Google login error:', error);
      setToast({ message: 'Error al iniciar sesión con Google', type: 'error', isVisible: true });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0a0502] border border-white/10 p-8 rounded-3xl w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6">Acceder</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-white/5 border border-white/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-white/50"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <button type="submit" className="w-full bg-[#ff4e00] p-3 rounded-xl font-bold">
            Acceder
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#0a0502] text-white/50">O continuar con</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200"
          >
            Google
          </button>
          <div className="text-center text-white/50 text-sm">
            ¿No tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/register');
              }}
              className="text-[#ff4e00] font-bold hover:underline"
            >
              Regístrate aquí
            </button>
          </div>
        </form>
        <Toast 
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      </div>
    </div>
  );
};

export default LoginModal;
