import React from 'react';
import Header from './Header';

const CombosFeiras = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title="Combos Catálogo 2026"
        subtitle="Atualizações em breve"
        showBack
        backPath="/select"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Combos Catálogo 2026
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Esta página está em preparação para receber os combos do catálogo.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111111] p-10 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Combos serao disponibilizados em breve
            </h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Estamos preparando os combos e as condicoes comerciais para 2026. Assim que o
              conteudo estiver liberado, ele sera publicado nesta pagina.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombosFeiras;
