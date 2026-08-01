import React from "react";
import { AlertTriangle } from "lucide-react";
import Header from "./Header";
import { Button } from "./ui/button";

const AuthErrorScreen = ({ user, message, onRetry }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={user}
        title="Falha ao carregar acesso"
        subtitle="Não foi possível validar suas permissões agora"
        showBack={Boolean(user)}
        backPath="/select"
      />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-10 shadow-sm">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Falha ao carregar acesso
            </h1>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {message || "Não foi possível validar seu acesso agora. Tente novamente em instantes."}
            </p>

            <div className="mt-8">
              <Button onClick={onRetry} className="px-6">
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthErrorScreen;
