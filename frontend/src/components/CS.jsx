import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { LogOut, ArrowLeft } from 'lucide-react';

const CS = ({ user }) => {
  const navigate = useNavigate();
  const userArea = user?.area || user?.user_metadata?.area;
  const canEdit = userArea === 'CS';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Botão Voltar */}
      <div className="bg-white border-b border-gray-200">
         <div className="max-w-[110rem] mx-auto px-6 py-2 flex justify-end">
            <button 
              onClick={() => navigate('/select')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
         </div>
      </div>

      {/* Header */}
      <header className="">
        <div className="max-w-[110rem] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/logo-pronutrition-symbol.png" 
                alt="PRONUTRITION" 
                className="h-20"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                PN
              </div>
              <div>
                <h2 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Gestão de Pricing
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Dados CS
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.nome || user?.user_metadata?.nome} {user?.sobrenome || user?.user_metadata?.sobrenome}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {user?.area || user?.user_metadata?.area}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto mt-8 px-6">
        <div className="card-pronutrition p-6">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tela de CS em implementação. Visualização em breve
          </p>
        </div>
      </div>
    </div>
  );
};

export default CS;
