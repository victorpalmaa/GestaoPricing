import React from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';

const PreVendas = ({ user, setUser }) => {
  const navigate = useNavigate();
  const userArea = user?.area || user?.user_metadata?.area;
  const isSuper = userArea === 'Pricing';
  const canEdit = isSuper || userArea === 'Pré-vendas';
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-[110rem] mx-auto px-6 py-2">
        <div className="flex justify-end items-center mb-2">
          <button 
            onClick={() => navigate('/select')}
            className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
          >
            Voltar
          </button>
        </div>
        <Dashboard user={user} setUser={setUser} permissions={{ canAdd: canEdit, canEdit: canEdit, canDelete: canEdit }} title="Pré-sales" />
      </div>
    </div>
  );
};

export default PreVendas;