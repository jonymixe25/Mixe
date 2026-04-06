import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    repeatPassword: '',
    email: '',
    city: '',
    neighborhood: '',
    streetAndNumber: '',
    dateOfBirth: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.repeatPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    // Handle registration logic here
    console.log('Registering:', formData);
    navigate('/profile');
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-[#0a0502] border border-white/10 rounded-3xl mt-10">
      <h2 className="text-3xl font-bold mb-6">Registro</h2>
      <form onSubmit={handleRegister} className="space-y-4">
        <input type="text" placeholder="Usuario" onChange={(e) => setFormData({...formData, username: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <input type="email" placeholder="Correo electrónico" onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} placeholder="Contraseña" onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/50"><Eye className="w-5 h-5" /></button>
        </div>
        <input type="password" placeholder="Repetir contraseña" onChange={(e) => setFormData({...formData, repeatPassword: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <input type="text" placeholder="Ciudad" onChange={(e) => setFormData({...formData, city: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <input type="text" placeholder="Colonia" onChange={(e) => setFormData({...formData, neighborhood: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <input type="text" placeholder="Calle y número" onChange={(e) => setFormData({...formData, streetAndNumber: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <input type="date" placeholder="Fecha de nacimiento" onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})} className="w-full p-3 rounded-xl bg-white/5 border border-white/10" />
        <button type="submit" className="w-full bg-[#ff4e00] p-3 rounded-xl font-bold">Registrarse</button>
      </form>
    </div>
  );
};

export default Register;
