import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";
import SessionSelect from "./components/SessionSelect";
import PricingDashboard from "./components/PricingDashboard";
import PricingAnalytics from "./components/PricingAnalytics";
import SimulationPage from "./components/SimulationPage";
import PreVendas from "./components/PreVendas";
import CS from "./components/CS";
import CatalogoPro from "./components/CatalogoPro";
import Combos2026 from "./components/Combos2026";
import ForgotPassword from "./components/ForgotPassword";
import UpdatePassword from "./components/UpdatePassword";
import OAuthConsent from "./components/OAuthConsent";
import { RequireAuth, RequireArea } from "./components/RouteGuards";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth, useAuthController } from "@/contexts/AuthContext";
import { getAllowedAreasForRoute } from "@/lib/permissions";
import EnvironmentConfigErrorScreen from "./components/EnvironmentConfigErrorScreen";
import { hasSupabaseConfig, missingSupabaseEnvVars } from "@/lib/utils";

function AppRoutes() {
  const { user } = useAuth();
  const { setAuthUser } = useAuthController();

  return (
    <>
      <Toaster />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/select" /> : <Login setUser={setAuthUser} />}
        />
        <Route
          path="/cadastro"
          element={user ? <Navigate to="/select" /> : <Cadastro setUser={setAuthUser} />}
        />
        <Route
          path="/oauth/consent"
          element={(
            <RequireAuth preserveRedirect={true}>
              <RequireArea areas={getAllowedAreasForRoute("/oauth/consent")}>
                <OAuthConsent />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/select"
          element={(
            <RequireAuth>
              <SessionSelect user={user} />
            </RequireAuth>
          )}
        />
        <Route
          path="/pricing/dashboard"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/pricing/dashboard")}>
                <PricingDashboard user={user} setUser={setAuthUser} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/pricing/analytics"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/pricing/analytics")}>
                <PricingAnalytics user={user} setUser={setAuthUser} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/simulacao"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/simulacao")}>
                <SimulationPage user={user} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/new-business"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/new-business")}>
                <PreVendas user={user} setUser={setAuthUser} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/business-development"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/business-development")}>
                <CS user={user} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/catalogo-pro"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/catalogo-pro")}>
                <CatalogoPro user={user} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/combos-2026"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/combos-2026")}>
                <Combos2026 user={user} />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/combos-feiras-2026"
          element={<Navigate to="/combos-2026" replace />}
        />
        {/* Backwards compatibility or redirects */}
        <Route
          path="/pre-vendas/new-leads"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/pre-vendas/new-leads")}>
                <Navigate to="/new-business" replace />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/cs"
          element={(
            <RequireAuth>
              <RequireArea areas={getAllowedAreasForRoute("/cs")}>
                <Navigate to="/business-development" replace />
              </RequireArea>
            </RequireAuth>
          )}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route
          path="/update-password"
          element={<UpdatePassword />}
        />
        <Route
          path="/"
          element={<Navigate to={user ? "/select" : "/login"} />}
        />
      </Routes>
    </>
  );
}

function App() {
  if (!hasSupabaseConfig) {
    return <EnvironmentConfigErrorScreen missingVars={missingSupabaseEnvVars} />;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
