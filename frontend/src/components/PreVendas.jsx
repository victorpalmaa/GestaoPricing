import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Dashboard from './Dashboard';

const PreVendas = ({ user, setUser }) => {
  const navigate = useNavigate();
  const userArea = user?.area || user?.user_metadata?.area;
  const isSuper = userArea === 'Pricing';
  const canEdit = isSuper || userArea === 'Pré-vendas';
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
      <div className="max-w-[110rem] mx-auto px-6 py-2">
        <Dashboard user={user} setUser={setUser} permissions={{ canAdd: canEdit, canEdit: canEdit, canDelete: canEdit }} title="Dados inside sales" />
      </div>
    </div>
  );
};

export default PreVendas;