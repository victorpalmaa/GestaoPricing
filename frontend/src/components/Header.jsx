import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Moon, 
  Sun, 
  Bell, 
  LogOut, 
  ArrowLeft, 
  CheckCircle,
  AlertCircle,
  FileText,
  Info
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from '@/lib/utils';
import { fetchNotifications, markNotificationAsRead } from '@/utils/notifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Header = ({ 
  user, 
  title, 
  subtitle, 
  showBack = false, 
  backPath = '/select',
  className = ''
}) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Apply theme on mount and change
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const loadNotifications = async () => {
    const data = await fetchNotifications();
    setNotifications(data);
    setUnreadCount(data.filter(n => !n.read).length);
  };

  useEffect(() => {
    loadNotifications();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('pronutrition_user');
    localStorage.removeItem('pronutrition_token');
    sessionStorage.clear();
    navigate('/login');
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markNotificationAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const userEmail = user?.email || user?.user_metadata?.email || 'usuario@pronutrition.com.br';
  // Tenta pegar nome e sobrenome do metadata, ou usa o nome completo, ou fallback para email
  const firstName = user?.user_metadata?.nome || user?.user_metadata?.first_name || '';
  const lastName = user?.user_metadata?.sobrenome || user?.user_metadata?.last_name || '';
  const fullName = firstName && lastName 
    ? `${firstName} ${lastName}` 
    : (user?.user_metadata?.name || user?.user_metadata?.full_name || userEmail.split('@')[0]);

  return (
    <header className={`bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 transition-colors duration-200 ${className}`}>
      <div className="flex items-center gap-4">
        {showBack && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(backPath)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full h-10 w-10"
            title="Voltar"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        )}
        
        <div className="flex items-center gap-4">
           {/* Logo - Added as requested */}
           <img 
            src="/logo-pronutrition-symbol.png" 
            alt="PRONUTRITION" 
            className="h-10 w-auto"
            onError={(e) => {
              e.target.style.display = 'none';
              // Fallback if image fails
            }}
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          title={`Mudar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-gray-900 dark:text-white">Notificações</p>
                <p className="text-xs leading-none text-gray-500 dark:text-gray-400">Você tem {unreadCount} novas mensagens</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((notif) => (
                  <DropdownMenuItem 
                    key={notif.id} 
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-3 focus:bg-gray-50 dark:focus:bg-gray-800"
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className={`mt-1 h-2 w-2 rounded-full ${notif.read ? 'bg-transparent' : 'bg-blue-500'}`} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900 dark:text-gray-100">
                          {notif.type === 'approval' && <CheckCircle className="inline h-3 w-3 mr-1 text-green-500" />}
                          {notif.type === 'lead' && <FileText className="inline h-3 w-3 mr-1 text-blue-500" />}
                          {notif.type === 'import' && <AlertCircle className="inline h-3 w-3 mr-1 text-yellow-500" />}
                          {notif.type === 'system' && <Info className="inline h-3 w-3 mr-1 text-gray-500" />}
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-12 flex items-center gap-3 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
               <div className="flex flex-col items-end hidden md:flex">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fullName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{userEmail}</span>
              </div>
              <Avatar className="h-9 w-9 border border-gray-200 dark:border-gray-700">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={fullName} />
                <AvatarFallback className="bg-primary/10 text-primary">{getInitials(fullName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-gray-900 dark:text-white">{fullName}</p>
                <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 cursor-pointer focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
