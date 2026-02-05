import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { LogOut, ArrowLeft } from 'lucide-react';
import Header from './Header';

const CS = ({ user }) => {
  const navigate = useNavigate();
  const userArea = user?.area || user?.user_metadata?.area;
  const canEdit = userArea === 'CS';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717] transition-colors duration-200">
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle="Dados CS" 
        showBack={false} 
        logoRedirect="/select"
      />

      <div className="max-w-4xl mx-auto mt-8 px-6">
        <div className="card-pronutrition p-6 dark:bg-[#0a0a0a] dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tela de CS em implementação. Visualização em breve
          </p>
        </div>
      </div>
    </div>
  );
};

export default CS;
