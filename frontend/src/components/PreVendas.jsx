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
    <Dashboard 
      user={user} 
      setUser={setUser} 
      permissions={{ canAdd: canEdit, canEdit: canEdit, canDelete: canEdit }} 
      title="Dados inside sales" 
    />
  );
};

export default PreVendas;