import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, useAuthController } from "@/contexts/AuthContext";
import AcessoNegado from "./AcessoNegado";
import AcessoPendente from "./AcessoPendente";
import AuthErrorScreen from "./AuthErrorScreen";

const AuthLoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg-secondary)" }}>
    <div className="text-center">
      <div
        className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
        style={{ color: "var(--color-primary)" }}
      />
      <p className="mt-4" style={{ color: "var(--color-text-secondary)" }}>
        Carregando...
      </p>
    </div>
  </div>
);

export function RequireAuth({ children }) {
  const { user, loading, authError } = useAuth();
  const { retryAuth } = useAuthController();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user && authError?.scope === "session") {
    return <AuthErrorScreen user={null} message={authError.message} onRetry={retryAuth} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function RequireArea({ areas, children }) {
  const { user, area, loading, authError, refreshArea } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (authError?.scope === "area") {
    return <AuthErrorScreen user={user} message={authError.message} onRetry={refreshArea} />;
  }

  if (!area || !String(area).trim()) {
    return <AcessoPendente user={user} />;
  }

  if (!areas.includes(area)) {
    return <AcessoNegado user={user} />;
  }

  return children;
}
