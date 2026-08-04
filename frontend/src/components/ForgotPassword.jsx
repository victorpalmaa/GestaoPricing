import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { Mail } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const redirect = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_REDIRECT_URL)
        || `${window.location.origin}/update-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      if (resetError) {
        console.error('Reset password error:', resetError);
        let msg = resetError.message || 'Não foi possível enviar o e-mail.';
        
        if (/rate limit/i.test(msg) || /too many requests/i.test(msg)) {
          msg = 'Limite de tentativas excedido (Rate Limit do Supabase). Aguarde alguns minutos ou use outro e-mail.';
        } else if (/not confirmed/i.test(msg)) {
          msg = 'E-mail não confirmado. Verifique sua caixa de entrada.';
        } else if (/SMTP|mail/i.test(msg)) {
          msg = `Erro de envio (SMTP/Limite). Detalhe: ${msg}`;
        }
        
        setError(msg);
      } else {
        setMessage('Enviamos um e-mail para recuperar sua senha.');
        setResetLink('');
      }
    } catch (err) {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" 
         style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-md w-full">
        <div className="card-pronutrition">
          <h1 className="text-2xl mb-4" style={{ color: 'var(--color-text-primary)' }}>Recuperar senha</h1>
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

            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2', border: '1px solid var(--color-danger)' }}>
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{message}</p>
                {resetLink && (
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Se preferir, use este link direto: <a href={resetLink} className="underline" style={{ color: 'var(--color-primary)' }}>Redefinir senha</a>
                  </p>
                )}
              </div>
            )}
            

            <div className="flex items-center justify-between">
              <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>Voltar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
