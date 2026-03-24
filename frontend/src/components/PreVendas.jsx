import React from 'react';
import Dashboard from './Dashboard';

const PreVendas = ({ user, setUser }) => {
  const rawArea = user?.area || user?.user_metadata?.area;
  const normalizedArea = String(rawArea || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');

  const canManageNewBusiness = normalizedArea === 'pricing'
    || normalizedArea === 'prevendas'
    || normalizedArea === 'presales'
    || normalizedArea === 'cs'
    || normalizedArea === 'clientsuccess'
    || normalizedArea === 'businessdev'
    || normalizedArea === 'businessdevelopment';
  return (
    <Dashboard 
      user={user} 
      setUser={setUser} 
      permissions={{ canAdd: canManageNewBusiness, canEdit: canManageNewBusiness, canDelete: canManageNewBusiness }} 
      title="Dados New Business" 
    />
  );
};

export default PreVendas;
