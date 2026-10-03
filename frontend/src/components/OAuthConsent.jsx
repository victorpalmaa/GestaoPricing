import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle2, Loader2 } from "lucide-react";

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-8">
    <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: "var(--color-primary)" }} />
    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
      Carregando detalhes da solicitação...
    </p>
  </div>
);

const ErrorView = ({ title, message, onRetry }) => (
  <div className="flex flex-col items-center text-center py-6">
    <div className="mb-4 p-4 rounded-full" style={{ backgroundColor: "#FEF2F2" }}>
      <ShieldAlert className="h-10 w-10" style={{ color: "var(--color-danger)" }} />
    </div>
    <CardTitle className="text-xl mb-2" style={{ color: "var(--color-text-primary)" }}>
      {title}
    </CardTitle>
    <CardDescription className="mb-6" style={{ color: "var(--color-text-secondary)" }}>
      {message}
    </CardDescription>
    {onRetry && (
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    )}
  </div>
);

const OAuthConsent = () => {
  const [searchParams] = useSearchParams();
  const authorizationId = searchParams.get("authorization_id");
  const { user, area, loading: authLoading } = useAuth();

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async (authId) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.auth.oauth.getAuthorizationDetails(authId);
      if (fetchError) {
        console.error("OAuth getAuthorizationDetails error:", fetchError);
        setError({
          type: "invalid",
          title: "Solicitação inválida ou expirada",
          message: "A solicitação de autorização não foi encontrada ou já expirou. Por favor, inicie o fluxo novamente.",
        });
        setDetails(null);
        return;
      }

      if (!data || !data.authorization_id) {
        if (data?.redirect_url) {
          window.location.assign(data.redirect_url);
          return;
        }
        setError({
          type: "invalid",
          title: "Solicitação inválida",
          message: "Não foi possível processar a solicitação de autorização.",
        });
        return;
      }

      setDetails(data);
    } catch (err) {
      console.error("OAuth fetch exception:", err);
      setError({
        type: "invalid",
        title: "Erro ao carregar solicitação",
        message: "Ocorreu um erro ao carregar os detalhes da autorização. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    if (!authorizationId) {
      setError({
        type: "missing_id",
        title: "Solicitação inválida",
        message: "O identificador de autorização (authorization_id) não foi informado na URL.",
      });
      setLoading(false);
      return;
    }

    fetchDetails(authorizationId);
  }, [authorizationId, authLoading, user]);

  const handleApprove = async () => {
    if (!authorizationId || actionLoading) return;
    setActionLoading(true);
    try {
      const { data, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId);
      if (approveError) {
        console.error("OAuth approve error:", approveError);
        setError({
          type: "invalid",
          title: "Erro ao autorizar",
          message: approveError.message || "Não foi possível concluir a autorização. Tente novamente.",
        });
        setActionLoading(false);
        return;
      }
      if (data?.redirect_url) {
        window.location.assign(data.redirect_url);
      }
    } catch (err) {
      console.error("OAuth approve exception:", err);
      setError({
        type: "invalid",
        title: "Erro ao autorizar",
        message: "Ocorreu um erro inesperado ao autorizar o acesso. Tente novamente.",
      });
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!authorizationId || actionLoading) return;
    setActionLoading(true);
    try {
      const { data, error: denyError } = await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (denyError) {
        console.error("OAuth deny error:", denyError);
        setError({
          type: "invalid",
          title: "Erro ao recusar",
          message: denyError.message || "Não foi possível recusar a autorização. Tente novamente.",
        });
        setActionLoading(false);
        return;
      }
      if (data?.redirect_url) {
        window.location.assign(data.redirect_url);
      }
    } catch (err) {
      console.error("OAuth deny exception:", err);
      setError({
        type: "invalid",
        title: "Erro ao recusar",
        message: "Ocorreu um erro inesperado ao recusar o acesso. Tente novamente.",
      });
      setActionLoading(false);
    }
  };

  const clientName = details?.client?.name || "Aplicativo externo";
  const redirectUri = details?.redirect_uri || "";
  const email = user?.email || "";
  const userArea = area || "Não definida";

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--color-bg-secondary)" }}
    >
      <div className="w-full max-w-lg">
        <Card className="card-pronutrition">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full" style={{ backgroundColor: "var(--color-primary-soft, #EFF6FF)" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: "var(--color-primary)" }} />
            </div>
            <CardTitle className="text-2xl" style={{ color: "var(--color-text-primary)" }}>
              Autorizar acesso
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading && <LoadingState />}

            {!loading && error && (
              <ErrorView
                title={error.title}
                message={error.message}
                onRetry={authorizationId ? () => fetchDetails(authorizationId) : null}
              />
            )}

            {!loading && !error && details && (
              <div className="space-y-5">
                <p className="text-base leading-relaxed" style={{ color: "var(--color-text-primary)" }}>
                  <strong>{clientName}</strong> quer acessar o Portal de Pricing com a sua conta.
                </p>

                <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "var(--color-bg-tertiary, #F8FAFC)" }}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Conectado como
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {email}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium mb-0.5" style={{ color: "var(--color-text-muted)" }}>
                      Área no portal
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {userArea}
                    </span>
                  </div>
                  <p className="text-xs pt-2" style={{ color: "var(--color-text-secondary)" }}>
                    As permissões serão as mesmas da sua área no portal: {userArea}
                  </p>
                </div>

                {redirectUri && (
                  <div className="pt-1">
                    <p className="text-[11px] break-all" style={{ color: "var(--color-text-muted)" }}>
                      Você será redirecionado para: {redirectUri}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {!loading && !error && details && (
            <CardFooter className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-3 sm:justify-end pt-2">
              <Button
                variant="outline"
                onClick={handleDeny}
                disabled={actionLoading}
                className="w-full sm:w-auto min-h-[44px]"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Recusar
              </Button>
              <Button
                variant="default"
                onClick={handleApprove}
                disabled={actionLoading}
                className="w-full sm:w-auto min-h-[44px] btn-primary"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Autorizar
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
};

export default OAuthConsent;
