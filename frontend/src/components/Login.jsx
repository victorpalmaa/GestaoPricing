import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
 
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

const Login = ({ setUser }) => {
  const navigate = useNavigate();
  const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || 'http://localhost:8000/api';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password, remember: formData.rememberMe }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Credenciais inválidas');
      }
      const data = await res.json();
      setUser(data.user);
      if (formData.rememberMe) {
        localStorage.setItem('pronutrition_user', JSON.stringify(data.user));
        localStorage.setItem('pronutrition_token', data.token.access_token);
        localStorage.setItem('pronutrition_remember', 'true');
      } else {
        sessionStorage.setItem('pronutrition_user', JSON.stringify(data.user));
        sessionStorage.setItem('pronutrition_token', data.token.access_token);
        localStorage.removeItem('pronutrition_remember');
        localStorage.removeItem('pronutrition_user');
        localStorage.removeItem('pronutrition_token');
      }
      navigate('/select');
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Tempo limite atingido. Verifique a conexão.');
      } else {
        setError('Credenciais inválidas');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" 
         style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-md w-full">
        {/* Card de Login */}
        <div className="card-pronutrition fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src="/logo-pronutrition-symbol.png" 
              alt="PRONUTRITION" 
              className="h-16 mx-auto mb-4"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div style={{ display: 'none', fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
              PRONUTRITION
            </div>
            <h1 className="text-3xl mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Gestão de Pricing
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Acessar plataforma
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label-pronutrition">
                E-mail Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input-pronutrition pl-10"
                  placeholder="seu.email@pronutrition.com.br"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="label-pronutrition">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-pronutrition pl-10 pr-10"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="p-3 rounded-lg" style={{ 
                backgroundColor: '#FEE2E2', 
                border: '1px solid var(--color-danger)'
              }}>
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                  {error}
                </p>
              </div>
            )}

            {/* Lembrar-me e Esqueci senha */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="rememberMe"
                  name="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  style={{ 
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer'
                  }}
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <label 
                  htmlFor="rememberMe" 
                  className="ml-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                >
                  Lembrar de mim
                </label>
              </div>

              <div>
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => navigate('/forgot-password')}
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            {/* Link para Cadastro */}
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/cadastro')}
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Cadastre-se
                </button>
              </p>
            </div>
          </form>

          
        </div>
      </div>
    </div>
  );
};

export default Login;