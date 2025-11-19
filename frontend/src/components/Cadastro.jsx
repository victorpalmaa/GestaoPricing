import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBase } from '@/lib/utils';
const allowedAreas = ['Pricing', 'Pré-vendas', 'CS'];
import { User, Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react';

const Cadastro = ({ setUser }) => {
  const navigate = useNavigate();
  const API = getApiBase();
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    area: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    if (email && !email.endsWith('@pronutrition.com.br')) {
      setEmailError('Email deve ser corporativo (@pronutrition.com.br)');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(formData.email)) {
      return;
    }

    setLoading(true);

    try {
      if (!API) {
        setError('Configuração ausente: defina VITE_API_URL no Vercel');
        return;
      }
      const res = await fetch(`${API}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          sobrenome: formData.sobrenome,
          email: formData.email,
          area: formData.area,
          password: formData.password
        })
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = 'Falha ao cadastrar';
        try { const j = JSON.parse(t); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }

      const loginRes = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      if (!loginRes.ok) {
        const t = await loginRes.text();
        let msg = 'Falha ao autenticar';
        try { const j = JSON.parse(t); if (j?.detail) msg = j.detail; } catch {}
        throw new Error(msg);
      }
      const auth = await loginRes.json();
      setUser(auth.user);
      localStorage.setItem('pronutrition_user', JSON.stringify(auth.user));
      localStorage.setItem('pronutrition_token', auth.token.access_token);
      navigate('/select');
    } catch (err) {
      setError(err.message || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      validateEmail(value);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" 
         style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-md w-full">
        {/* Card de Cadastro */}
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
              Criar conta
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome e Sobrenome (lado a lado) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="nome" className="label-pronutrition">
                  Nome
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    required
                    className="input-pronutrition pl-10"
                    placeholder="João"
                    value={formData.nome}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sobrenome" className="label-pronutrition">
                  Sobrenome
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={18} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                  <input
                    id="sobrenome"
                    name="sobrenome"
                    type="text"
                    required
                    className="input-pronutrition pl-10"
                    placeholder="Silva"
                    value={formData.sobrenome}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Área/Time */}
            <div>
              <label htmlFor="area" className="label-pronutrition">
                Área/Time
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <select
                  id="area"
                  name="area"
                  required
                  className="input-pronutrition pl-10"
                  value={formData.area}
                  onChange={handleChange}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Selecione sua área</option>
                  {allowedAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                  style={{ 
                    borderColor: emailError ? 'var(--color-danger)' : undefined 
                  }}
                />
              </div>
              {emailError && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                  {emailError}
                </p>
              )}
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
                  minLength={6}
                  className="input-pronutrition pl-10 pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
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

            {/* Botão Cadastrar */}
            <button
              type="submit"
              disabled={loading || emailError}
              className="btn-primary w-full"
              style={{ opacity: (loading || emailError) ? 0.7 : 1 }}
            >
              {loading ? 'Criando conta...' : 'Cadastrar'}
            </button>

            {/* Link para Login */}
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Fazer login
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;
