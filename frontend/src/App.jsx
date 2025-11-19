import { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Cadastro from "./components/Cadastro";
import Dashboard from "./components/Dashboard";
import SessionSelect from "./components/SessionSelect";
import Pricing from "./components/Pricing";
import PreVendas from "./components/PreVendas";
import CS from "./components/CS";
import ForgotPassword from "./components/ForgotPassword";
import UpdatePassword from "./components/UpdatePassword";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage ou sessionStorage
    const savedUser = localStorage.getItem('pronutrition_user') || sessionStorage.getItem('pronutrition_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Erro ao carregar usuário:', e);
        localStorage.removeItem('pronutrition_user');
      }
    }
    setLoading(false);
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
            path="/pre-vendas/new-leads" 
            element={user ? <PreVendas user={user} setUser={setUser} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/cs" 
            element={user ? <CS user={user} /> : <Navigate to="/login" />} 
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
      </BrowserRouter>
    </div>
  );
}

export default App;
