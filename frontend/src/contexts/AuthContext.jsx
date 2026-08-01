import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/utils";

const AuthContext = createContext(null);
const AREA_RETRY_DELAYS_MS = [300, 700, 1500];
const AREA_NETWORK_ERROR_MESSAGE = "Não foi possível carregar as permissões da sua conta. Verifique a conexão e tente novamente.";
const SESSION_NETWORK_ERROR_MESSAGE = "Não foi possível validar sua sessão agora. Verifique a conexão e tente novamente.";

const isNetworkError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("fetch");
};

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [area, setArea] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [areaResolved, setAreaResolved] = useState(false);
  const areaCacheRef = useRef(new Map());
  const requestIdRef = useRef(0);

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem("pronutrition_user");
    localStorage.removeItem("pronutrition_token");
    sessionStorage.removeItem("pronutrition_user");
    sessionStorage.removeItem("pronutrition_token");
  }, []);

  const fetchAreaWithRetry = useCallback(async (userId, requestId) => {
    let lastError = null;

    for (let attempt = 0; attempt < AREA_RETRY_DELAYS_MS.length; attempt += 1) {
      const { data, error } = await supabase
        .from("users")
        .select("area")
        .eq("id", userId)
        .maybeSingle();

      if (requestId !== requestIdRef.current) {
        return { cancelled: true };
      }

      if (!error) {
        return { area: data?.area ?? null };
      }

      lastError = error;
      console.error(`Erro ao carregar área do usuário (tentativa ${attempt + 1}):`, error);

      if (!isNetworkError(error)) {
        break;
      }

      if (attempt < AREA_RETRY_DELAYS_MS.length - 1) {
        await wait(AREA_RETRY_DELAYS_MS[attempt]);
      }
    }

    return { error: lastError };
  }, []);

  const resolveUserArea = useCallback(async (nextUser, options = {}) => {
    const requestId = ++requestIdRef.current;
    const { forceRefresh = false } = options;

    setUser(nextUser);

    if (!nextUser) {
      setArea(null);
      setAuthError(null);
      setAreaResolved(true);
      return;
    }

    setArea(null);
    setAreaResolved(false);
    setAuthError((currentError) => (
      currentError?.scope === "session" ? currentError : null
    ));

    if (!forceRefresh && areaCacheRef.current.has(nextUser.id)) {
      setArea(areaCacheRef.current.get(nextUser.id) ?? null);
      setAreaResolved(true);
      return;
    }

    const result = await fetchAreaWithRetry(nextUser.id, requestId);

    if (result.cancelled || requestId !== requestIdRef.current) {
      return;
    }

    if (result.error) {
      setArea(null);
      setAreaResolved(true);
      setAuthError({
        scope: "area",
        message: isNetworkError(result.error)
          ? AREA_NETWORK_ERROR_MESSAGE
          : "Não foi possível carregar a área da sua conta. Tente novamente.",
      });
      return;
    }

    const nextArea = result.area ?? null;
    areaCacheRef.current.set(nextUser.id, nextArea);
    setArea(nextArea);
    setAuthError(null);
    setAreaResolved(true);
  }, [fetchAreaWithRetry]);

  const syncSession = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      setArea(null);
      setAuthError(null);
      setSessionResolved(true);
      setAreaResolved(true);
      return;
    }

    try {
      setAuthError(null);
      const remember = localStorage.getItem("pronutrition_remember") === "true";
      const persistedSessionUser = sessionStorage.getItem("pronutrition_user");
      const { data: { session } } = await supabase.auth.getSession();

      let nextUser = null;

      if (session?.user) {
        if (remember || persistedSessionUser) {
          nextUser = session.user;

          if (remember && !localStorage.getItem("pronutrition_user")) {
            localStorage.setItem("pronutrition_user", JSON.stringify(session.user));
          }
        } else {
          await supabase.auth.signOut();
          clearStoredSession();
        }
      } else {
        clearStoredSession();
      }

      await resolveUserArea(nextUser);
    } catch (error) {
      console.error("Erro ao verificar sessão:", error);
      setAuthError({
        scope: "session",
        message: isNetworkError(error)
          ? SESSION_NETWORK_ERROR_MESSAGE
            : "Não foi possível verificar sua sessão agora. Tente novamente.",
      });
      setSessionResolved(true);
      setAreaResolved(true);
    } finally {
      setSessionResolved(true);
    }
  }, [clearStoredSession, resolveUserArea]);

  const setAuthUser = useCallback(async (nextUser) => {
    setSessionResolved(true);
    setAuthError(null);

    if (!nextUser) {
      areaCacheRef.current.clear();
      clearStoredSession();
    }

    await resolveUserArea(nextUser);
  }, [clearStoredSession, resolveUserArea]);

  const refreshArea = useCallback(async () => {
    if (!user) {
      return;
    }

    areaCacheRef.current.delete(user.id);
    await resolveUserArea(user, { forceRefresh: true });
  }, [resolveUserArea, user]);

  const retryAuth = useCallback(async () => {
    setSessionResolved(false);
    setAreaResolved(false);
    setAuthError(null);
    await syncSession();
  }, [syncSession]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      await syncSession();
    };

    initialize();

    if (!supabase) {
      return undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "SIGNED_OUT") {
        areaCacheRef.current.clear();
        clearStoredSession();
        setAuthError(null);
      }

      void resolveUserArea(session?.user ?? null);
      setSessionResolved(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearStoredSession, resolveUserArea, syncSession]);

  const value = useMemo(() => ({
    user,
    area,
    authError,
    isPricing: area === "Pricing",
    loading: !sessionResolved || Boolean(user && !areaResolved),
    refreshArea,
    setAuthUser,
    retryAuth,
  }), [area, areaResolved, authError, refreshArea, retryAuth, sessionResolved, setAuthUser, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return useMemo(() => ({
    user: context.user,
    area: context.area,
    authError: context.authError,
    isPricing: context.isPricing,
    loading: context.loading,
    refreshArea: context.refreshArea,
  }), [context.area, context.authError, context.isPricing, context.loading, context.refreshArea, context.user]);
}

export function useAuthController() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthController deve ser usado dentro de AuthProvider");
  }

  return useMemo(() => ({
    setAuthUser: context.setAuthUser,
    retryAuth: context.retryAuth,
  }), [context.retryAuth, context.setAuthUser]);
}
