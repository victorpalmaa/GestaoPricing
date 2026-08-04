import React from "react";
import { AlertTriangle } from "lucide-react";

const EnvironmentConfigErrorScreen = ({ missingVars = [] }) => {
  const missingVarsText = missingVars.join(", ");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center transition-colors duration-200">
        <div className="flex items-center gap-4">
          <img
            src="/logo-pronutrition-symbol.png"
            alt="PRONUTRITION"
            className="h-10 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Configuração da aplicação
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Não foi possível inicializar o sistema
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-10 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Aplicação não configurada
            </h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              A aplicação não está configurada corretamente neste ambiente.
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Variável{missingVars.length > 1 ? "eis" : ""} ausente{missingVars.length > 1 ? "s" : ""}: {missingVarsText}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Procure o responsável pelo sistema para corrigir a configuração e tente novamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentConfigErrorScreen;
