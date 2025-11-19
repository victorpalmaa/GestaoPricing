import React from 'react';
import { useNavigate } from 'react-router-dom';

const CS = ({ user }) => {
  const navigate = useNavigate();
  const canEdit = user?.area === 'CS';
  return (
    <div className="min-h-screen py-12 px-6" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>CS</h1>
          <button className="btn-secondary" onClick={() => navigate('/select')}>Voltar</button>
        </div>
        <div className="card-pronutrition p-6">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Tela de CS em implementação. {canEdit ? 'Você poderá editar nesta tela.' : 'Visualização habilitada.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CS;