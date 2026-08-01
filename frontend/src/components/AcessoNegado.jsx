import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Header from "./Header";
import { Button } from "./ui/button";

const AcessoNegado = ({ user }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title="Acesso negado"
        subtitle="Permissão insuficiente para este módulo"
        showBack
        backPath="/select"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-10 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Acesso negado
            </h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              A área da sua conta não tem permissão para acessar este módulo. Se você acredita
              que isso está incorreto, procure a área de Pricing.
            </p>

            <div className="mt-8">
              <Button onClick={() => navigate("/select")} className="px-6">
                Voltar para Sessões
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcessoNegado;
