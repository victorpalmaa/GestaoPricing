import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/utils';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let t = searchParams.get('token') || searchParams.get('access_token') || searchParams.get('code') || '';
      const em = searchParams.get('email') || '';
      if (!t && typeof window !== 'undefined' && window.location && window.location.hash) {
        const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
        const parts = hash.split('&');
        for (const p of parts) {
          const [k, v] = p.split('=');
          if (k === 'token' || k === 'access_token' || k === 'code') {
            t = decodeURIComponent(v || '');
          } else if (k === 'email' && !em) {
            try { setEmail(decodeURIComponent(v || '')); } catch {}
          }
        }
      }
      if (em) setEmail(em);
      setToken(t);
    } catch {}
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw new Error(updateError.message || 'Falha ao atualizar senha');
      }
      setMessage('Senha atualizada com sucesso. Faça login novamente.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" 
         style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-md w-full">
        <div className="card-pronutrition fade-in">
          <div className="text-center mb-8">
            <h1 className="text-2xl" style={{ color: 'var(--color-text-primary)' }}>Redefinir senha</h1>
          </div>
          <form onSubmit={submit} className="space-y-6">
            <div>
              <label htmlFor="email" className="label-pronutrition">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="email"
                  type="email"
                  className="input-pronutrition pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@pronutrition.com.br"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label-pronutrition">Nova senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-pronutrition pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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

            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', border: '1px solid var(--color-danger)' }}>
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>Voltar</button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;