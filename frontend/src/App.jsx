import { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";
import SessionSelect from "./components/SessionSelect";
import Pricing from "./components/Pricing";
import PricingDashboard from "./components/PricingDashboard";
import PricingAnalytics from "./components/PricingAnalytics";
import SimulationPage from "./components/SimulationPage";
import PreVendas from "./components/PreVendas";
import CS from "./components/CS";
import CatalogoPro from "./components/CatalogoPro";
import CombosFeiras from "./components/CombosFeiras";
import ForgotPassword from "./components/ForgotPassword";
import UpdatePassword from "./components/UpdatePassword";
import { Toaster } from "./components/ui/sonner";
import { supabase } from "@/lib/utils";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 1. Verificar preferência de "Lembrar de mim"
        const remember = localStorage.getItem('pronutrition_remember') === 'true';
        const sessionUser = sessionStorage.getItem('pronutrition_user');

        // 2. Verificar sessão real do Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Sessão válida no Supabase
          if (remember) {
            // Se "Lembrar" está ativo, mantemos logado
            setUser(session.user);
            // Atualizar localStorage se necessário
            if (!localStorage.getItem('pronutrition_user')) {
              localStorage.setItem('pronutrition_user', JSON.stringify(session.user));
            }
          } else {
            // Se "Lembrar" NÃO está ativo
            if (sessionUser) {
               // Se temos sessionStorage (mesma aba), mantemos logado
               setUser(session.user);
            } else {
               // Se não temos sessionStorage (nova aba/fechou navegador), forçamos logout
               // pois o Supabase persiste por padrão, mas o usuário escolheu não lembrar.
               await supabase.auth.signOut();
               setUser(null);
            }
          }
        } else {
          // Sem sessão Supabase válida
          setUser(null);
          // Limpar dados obsoletos
          localStorage.removeItem('pronutrition_user');
          localStorage.removeItem('pronutrition_token');
          sessionStorage.removeItem('pronutrition_user');
          sessionStorage.removeItem('pronutrition_token');
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listener para mudanças de estado (login/logout em outras abas ou expiração)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('pronutrition_user');
        localStorage.removeItem('pronutrition_token');
        // Não removemos 'pronutrition_remember' aqui automaticamente, 
        // pois o usuário pode querer ser lembrado no próximo login, 
        // mas se foi SIGNED_OUT explícito pelo botão de sair, o Login.jsx deve tratar isso.
        // Geralmente Logout explícito deve limpar tudo.
        sessionStorage.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" 
           style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"
               style={{ color: 'var(--color-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Toaster />
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/select" /> : <Login setUser={setUser} />} 
          />
          <Route 
            path="/cadastro" 
            element={user ? <Navigate to="/select" /> : <Cadastro setUser={setUser} />} 
          />
          <Route 
            path="/select" 
            element={user ? <SessionSelect user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/pricing" 
            element={user ? <Pricing user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/pricing/dashboard" 
            element={user ? <PricingDashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/pricing/analytics" 
            element={user ? <PricingAnalytics user={user} setUser={setUser} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/simulacao" 
            element={user ? <SimulationPage user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/new-business" 
            element={user ? <PreVendas user={user} setUser={setUser} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/business-development" 
            element={user ? <CS user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/catalogo-pro" 
            element={user ? <CatalogoPro user={user} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/combos-feiras-2026" 
            element={user ? <CombosFeiras user={user} /> : <Navigate to="/login" />} 
          />
          {/* Backwards compatibility or redirects */}
          <Route path="/pre-vendas/new-leads" element={<Navigate to="/new-business" replace />} />
          <Route path="/cs" element={<Navigate to="/business-development" replace />} />
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
      </BrowserRouter>
    </div>
  );
}

export default App;
