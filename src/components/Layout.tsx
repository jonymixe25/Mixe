import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Home, User, Users, Video, LogOut, LogIn, Menu, X, Shield, Newspaper, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/news', label: 'Noticias', icon: Newspaper },
    ...(user ? [
      { path: '/profile', label: 'Perfil', icon: User },
      { path: '/contacts', label: 'Contactos', icon: Users },
      { path: '/gallery', label: 'Galería', icon: ImageIcon },
      { path: '/admin', label: 'Transmitir', icon: Video },
      ...(user.role === 'admin' ? [{ path: '/dashboard', label: 'Admin', icon: Shield }] : []),
    ] : []),
  ];

  const handleLogin = async () => {
    await login();
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-[#ff4e00] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0502]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 bg-[#ff4e00] rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tighter uppercase italic"><span>Voz Mixe Live</span></span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-[#ff4e00] ${
                    location.pathname === item.path ? 'text-[#ff4e00]' : 'text-white/60'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
              {user ? (
                <button
                  onClick={() => { logout(); navigate('/'); }}
                  className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-red-500 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Salir</span>
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="bg-[#ff4e00] px-4 py-2 rounded-full text-sm font-bold hover:bg-[#ff4e00]/90 transition-colors flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-white/60 hover:text-white"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence mode="wait">
          {isMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden bg-[#0a0502] border-b border-white/10 px-4 pt-2 pb-6 space-y-2"
            >
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    location.pathname === item.path ? 'bg-[#ff4e00]/10 text-[#ff4e00]' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
              {!user && (
                <button
                  onClick={() => { handleLogin(); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#ff4e00] text-white font-bold"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Ingresar</span>
                </button>
              )}
              {user && (
                <button
                  onClick={() => { logout(); navigate('/'); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Salir</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-top border-white/10 py-8 text-center text-white/40 text-xs">
        <p><span>© 2026 Voz Mixe Live. La región de los jamás conquistados.</span></p>
      </footer>
    </div>
  );
};

export default Layout;
