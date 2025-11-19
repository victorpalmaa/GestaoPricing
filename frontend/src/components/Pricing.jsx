import React from 'react';
import { useNavigate } from 'react-router-dom';
const Pricing = ({ user }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Pricing</h1>
          <button className="btn-secondary" onClick={() => navigate('/select')}>Voltar</button>
        </div>
        <div className="card-pronutrition p-6">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tela de Pricing em implementação. Visualização habilitada e edição será adicionada em breve.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;