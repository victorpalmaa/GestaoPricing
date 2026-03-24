import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ClipboardList, Users, Calculator } from 'lucide-react';
import Header from './Header';

const SessionSelect = ({ user }) => {
  const navigate = useNavigate();
  const cards = [
    { key: 'pricing-dashboard', title: 'Pricing', icon: Briefcase, to: '/pricing/dashboard' },
    { key: 'pre-vendas', title: 'New Business', icon: ClipboardList, to: '/new-business' },
    { key: 'cs', title: 'Business Dev', icon: Users, to: '/business-development' },
    { key: 'simulacao', title: 'Simulador de Preços', icon: Calculator, to: '/simulacao' },
    { key: 'catalogo-pro', title: 'Catálogo PRO', icon: Calculator, to: '/catalogo-pro' },
  ];
  
  const subtitleFor = (key) => {
    const area = user?.area || user?.user_metadata?.area;
    if (key === 'simulacao') return 'Cálculo e Análise';
    if (key === 'catalogo-pro') return 'Em desenvolvimento';
    if (area === 'Pricing') return 'Acessar e gerenciar';
    if (area === 'Pré-vendas') return key === 'pre-vendas' ? 'Acessar e gerenciar' : 'Acessar';
    if (area === 'CS') return (key === 'cs' || key === 'pre-vendas') ? 'Acessar e gerenciar' : 'Acessar';
    return 'Acessar';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header 
        user={user} 
        title="Sessões" 
        subtitle="Menu Principal" 
        showBack={false} 
      />
      
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Bem-vindo, {user?.nome || user?.user_metadata?.nome}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Selecione o módulo que deseja acessar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(({ key, title, icon: Icon, to }) => (
            <button
              key={key}
              onClick={() => navigate(to)}
              className="w-full p-6 text-left bg-white dark:bg-[#0a0a0a] dark:border-gray-800 border border-transparent shadow-sm rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-blue-600 dark:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                  <Icon size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{subtitleFor(key)}</p>
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
