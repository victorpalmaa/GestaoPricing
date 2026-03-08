import React from 'react';
import Header from './Header';

const CatalogoPro = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <Header
        user={user}
        title="Catálogo PRO"
        subtitle="Em desenvolvimento"
        showBack={false}
        logoRedirect="/select"
      />
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-2xl font-bold text-gray-500">
        Em desenvolvimento
      </div>
    </div>
  );
};

export default CatalogoPro;
