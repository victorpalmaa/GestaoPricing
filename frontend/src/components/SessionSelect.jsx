import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ClipboardList, Users } from 'lucide-react';

const SessionSelect = ({ user }) => {
  const navigate = useNavigate();
  const cards = [
    { key: 'pricing', title: 'Pricing', icon: Briefcase, to: '/pricing' },
    { key: 'pre-vendas', title: 'Pré-sales', icon: ClipboardList, to: '/pre-vendas/new-leads' },
    { key: 'cs', title: 'CS', icon: Users, to: '/cs' },
  ];
  const subtitleFor = (key) => {
    const area = user?.area || user?.user_metadata?.area;
    if (area === 'Pricing') return 'Acessar e gerenciar';
    if (area === 'Pré-vendas') return key === 'pre-vendas' ? 'Acessar e gerenciar' : 'Acessar';
    if (area === 'CS') return key === 'cs' ? 'Acessar e gerenciar' : 'Acessar';
    return 'Acessar';
  };
  return (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Escolha a sessão</h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Bem-vindo, {user?.nome} {user?.sobrenome}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ key, title, icon: Icon, to }) => (
            <button
              key={key}
              onClick={() => navigate(to)}
              className="card-pronutrition w-full p-6 text-left transition-transform hover:scale-[1.01]"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <Icon size={28} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{subtitleFor(key)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SessionSelect;