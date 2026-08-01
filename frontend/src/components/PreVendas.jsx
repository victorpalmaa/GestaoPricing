import React from 'react';
import Dashboard from './Dashboard';
import { useRoutePermissions } from '@/lib/permissions';

const PreVendas = ({ user, setUser }) => {
  const { canWrite: canManageNewBusiness } = useRoutePermissions('/new-business');

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
