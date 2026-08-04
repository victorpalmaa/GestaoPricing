import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  LogOut,
  Moon,
  RefreshCcw,
  Sun,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTIVITY_BADGE_POLL_INTERVAL_MS = 60 * 1000;
const ACTIVITY_PAGE_SIZE = 20;
const ACTIVITY_PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
];

const getActivityPeriodStart = (period) => {
  const now = new Date();

  switch (period) {
    case 'today':
      return startOfDay(now);
    case '30d':
      return subDays(now, 30);
    case '7d':
    default:
      return subDays(now, 7);
  }
};

const formatActivityTimestamp = (value) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  if (isToday(parsed)) {
    return formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR });
  }

  if (isYesterday(parsed)) {
    return `ontem às ${format(parsed, 'HH:mm')}`;
  }

  return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const Header = ({
  user,
  title,
  subtitle,
  showBack = false,
  backPath = '/select',
  className = '',
  logoRedirect = null
}) => {
  const navigate = useNavigate();
  const { isPricing } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [unreadCount, setUnreadCount] = useState(null);
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const [activityPeriod, setActivityPeriod] = useState('7d');
  const [activities, setActivities] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [nextActivityOffset, setNextActivityOffset] = useState(0);
  const [highlightedActivityIds, setHighlightedActivityIds] = useState([]);
  const pollIntervalRef = useRef(null);
  const highlightRemainingRef = useRef(0);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const clearBadgePolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const loadUnreadActivityCount = useCallback(async () => {
    if (!isPricing) {
      setUnreadCount(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('unread_activity_count');

      if (error) throw error;

      const normalizedCount = Number(data);
      setUnreadCount(Number.isFinite(normalizedCount) ? normalizedCount : 0);
    } catch (error) {
      console.error('Erro ao carregar contagem de atividades não lidas:', error);
      setUnreadCount(null);
    }
  }, [isPricing]);

  const startBadgePolling = useCallback(() => {
    if (!isPricing || document.visibilityState !== 'visible') {
      return;
    }

    clearBadgePolling();
    pollIntervalRef.current = window.setInterval(() => {
      void loadUnreadActivityCount();
    }, ACTIVITY_BADGE_POLL_INTERVAL_MS);
  }, [clearBadgePolling, isPricing, loadUnreadActivityCount]);

  useEffect(() => {
    if (!isPricing) {
      clearBadgePolling();
      setUnreadCount(null);
      return undefined;
    }

    void loadUnreadActivityCount();
    startBadgePolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadActivityCount();
        startBadgePolling();
        return;
      }

      clearBadgePolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearBadgePolling();
    };
  }, [clearBadgePolling, isPricing, loadUnreadActivityCount, startBadgePolling]);

  const fetchActivities = useCallback(async ({ reset = false } = {}) => {
    if (!isPricing) {
      return;
    }

    const offset = reset ? 0 : nextActivityOffset;
    const periodStart = getActivityPeriodStart(activityPeriod);

    if (reset) {
      setLoadingActivities(true);
      setActivityError('');
    } else {
      setLoadingMoreActivities(true);
      setActivityError('');
    }

    try {
      let query = supabase
        .from('activity_log')
        .select('id, summary, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + ACTIVITY_PAGE_SIZE - 1);

      if (periodStart) {
        query = query.gte('created_at', periodStart.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = data || [];
      const idsToHighlight = rows
        .slice(0, Math.max(0, highlightRemainingRef.current))
        .map((row) => row.id);

      if (highlightRemainingRef.current > 0) {
        highlightRemainingRef.current = Math.max(0, highlightRemainingRef.current - idsToHighlight.length);
      }

      if (reset) {
        setActivities(rows);
        setNextActivityOffset(rows.length);
        setHasMoreActivities(rows.length === ACTIVITY_PAGE_SIZE);
        setHighlightedActivityIds(idsToHighlight);
      } else {
        setActivities((prev) => [...prev, ...rows]);
        setNextActivityOffset((prev) => prev + rows.length);
        setHasMoreActivities(rows.length === ACTIVITY_PAGE_SIZE);
        setHighlightedActivityIds((prev) => [...prev, ...idsToHighlight]);
      }
    } catch (error) {
      console.error('Erro ao carregar activity_log:', error);
      setActivityError(
        reset
          ? 'Não foi possível carregar o log de atividades.'
          : 'Não foi possível carregar mais atividades.'
      );

      if (reset) {
        setActivities([]);
        setNextActivityOffset(0);
        setHasMoreActivities(false);
        setHighlightedActivityIds([]);
      }
    } finally {
      setLoadingActivities(false);
      setLoadingMoreActivities(false);
    }
  }, [activityPeriod, isPricing, nextActivityOffset]);

  useEffect(() => {
    if (!activityMenuOpen || !isPricing) {
      return;
    }

    void fetchActivities({ reset: true });
  }, [activityMenuOpen, activityPeriod, fetchActivities, isPricing]);

  const handleActivityMenuOpenChange = useCallback(async (open) => {
    setActivityMenuOpen(open);

    if (!open || !isPricing) {
      highlightRemainingRef.current = 0;
      setHighlightedActivityIds([]);
      return;
    }

    highlightRemainingRef.current = typeof unreadCount === 'number' ? unreadCount : 0;
    setHighlightedActivityIds([]);
    setUnreadCount(0);

    try {
      const { error } = await supabase.rpc('mark_activity_read');
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao marcar atividades como lidas:', error);
    }
  }, [isPricing, unreadCount]);

  const handleActivityPeriodChange = useCallback((period) => {
    if (period === activityPeriod) {
      return;
    }

    highlightRemainingRef.current = 0;
    setHighlightedActivityIds([]);
    setActivityPeriod(period);
  }, [activityPeriod]);

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

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const userEmail = user?.email || user?.user_metadata?.email || 'usuario@pronutrition.com.br';
  const firstName = user?.user_metadata?.nome || user?.user_metadata?.first_name || '';
  const lastName = user?.user_metadata?.sobrenome || user?.user_metadata?.last_name || '';
  const fullName = firstName && lastName
    ? `${firstName} ${lastName}`
    : (user?.user_metadata?.name || user?.user_metadata?.full_name || userEmail.split('@')[0]);
  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount;

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
          <div
            className={`flex items-center ${logoRedirect ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={() => logoRedirect && navigate(logoRedirect)}
          >
            <img
              src="/logo-pronutrition-symbol.png"
              alt="PRONUTRITION"
              className="h-10 w-auto"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          title={`Mudar para modo ${theme === 'light' ? 'escuro' : 'claro'}`}
        >
          {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        {isPricing && (
          <DropdownMenu open={activityMenuOpen} onOpenChange={handleActivityMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <Bell className="h-5 w-5" />
                {typeof unreadCount === 'number' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    {badgeLabel}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="w-[26rem] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-0"
            >
              <div className="p-4">
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-gray-900 dark:text-white">Log de atividades</p>
                    <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                      {typeof unreadCount === 'number' && unreadCount > 0
                        ? `${badgeLabel} atividade${unreadCount > 1 ? 's' : ''} não lida${unreadCount > 1 ? 's' : ''}`
                        : 'Atividades recentes registradas automaticamente pelo banco'}
                    </p>
                  </div>
                </DropdownMenuLabel>

                <div className="mt-4 flex gap-2">
                  {ACTIVITY_PERIOD_OPTIONS.map((option) => {
                    const isSelected = activityPeriod === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleActivityPeriodChange(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <DropdownMenuSeparator className="bg-gray-100 dark:bg-gray-800 m-0" />

              <div className="max-h-[28rem] overflow-y-auto">
                {loadingActivities ? (
                  <div className="p-6 text-center">
                    <RefreshCcw className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Carregando atividades...</p>
                  </div>
                ) : activityError && activities.length === 0 ? (
                  <div className="p-4">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Não foi possível carregar o log de atividades.</p>
                          <p className="mt-1 text-xs opacity-90">
                            Tente novamente para recuperar os eventos mais recentes.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-900/20"
                            onClick={() => void fetchActivities({ reset: true })}
                          >
                            Tentar novamente
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhuma atividade encontrada para o período selecionado.
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {activities.map((activity) => {
                        const isHighlighted = highlightedActivityIds.includes(activity.id);

                        return (
                          <div
                            key={activity.id}
                            className={`px-4 py-3 transition-colors ${
                              isHighlighted
                                ? 'bg-blue-50/70 dark:bg-blue-950/20'
                                : 'bg-transparent'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1.5 h-2 w-2 rounded-full ${isHighlighted ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm leading-5 text-gray-900 dark:text-gray-100 break-words">
                                  {activity.summary}
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {formatActivityTimestamp(activity.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {activityError && activities.length > 0 && (
                      <div className="px-4 pt-4">
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                          {activityError}
                        </div>
                      </div>
                    )}

                    <div className="p-4">
                      {hasMoreActivities ? (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={loadingMoreActivities}
                          onClick={() => void fetchActivities({ reset: false })}
                        >
                          {loadingMoreActivities ? 'Carregando...' : 'Carregar mais'}
                        </Button>
                      ) : (
                        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                          Fim das atividades para o período selecionado.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

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
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
