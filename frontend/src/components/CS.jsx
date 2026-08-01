import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/utils';
import { 
  Info, 
  CalendarDays, 
  AlertTriangle,
  Filter,
  Clock,
  TrendingUp,
  TrendingDown,
  X,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  Target,
  CalendarClock,
  Pencil,
  AlertCircle,
  CheckCircle,
  Download,
  Trash2
} from 'lucide-react';
import Header from './Header';
import HistoryChartModal from './HistoryChartModal';
import SearchableSelect from './SearchableSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from '@/contexts/AuthContext';
import { getPermissionErrorMessage, isPermissionError } from '@/utils/permissionErrors';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  format, 
  addDays, 
  subDays,
  differenceInDays, 
  isSameMonth, 
  addMonths, 
  parseISO, 
  isAfter, 
  isBefore, 
  isValid,
  isThisWeek,
  isPast,
  isSameDay,
  startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateContractInfo, calculateGate, WORKFLOW_STATUS_OPTIONS } from '../utils/pricingUtils';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell,
  ReferenceLine
} from 'recharts';

const CS = ({ user }) => {
  const { area, isPricing: isPricingUser } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    client: '',
    sku: '',
    manager: '',
    category: '',
    subcategory: '',
    size: '',
    datasulCode: '',
    gate: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    communicationStatus: ''
  });
  
  // Estado para o modal de histórico
  const [selectedItem, setSelectedItem] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' or 'table'
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Estado para modal de edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [observation, setObservation] = useState('');
  const [dateEditModal, setDateEditModal] = useState({
    open: false,
    item: null,
    field: null,
    value: ''
  });
  const [savingDateEdit, setSavingDateEdit] = useState(false);

  const formatRowCurrency = (value, currency = 'BRL') => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '-';
    const currencyCode = currency === 'USD' ? 'USD' : 'BRL';
    return numericValue.toLocaleString('pt-BR', { style: 'currency', currency: currencyCode });
  };

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('pricing_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_history'
        },
        (payload) => {
          // Refresh data on any change
          loadContracts();
          
          // Optional: Show toast for external updates if needed, but might be noisy
          if (payload.eventType === 'INSERT') {
            toast.info('Novos dados de precificação recebidos.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Carregar dados
  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('pricing_history')
        .select(`
          *,
          clients (name)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      const parsePricingDate = (value) => {
        if (!value) return null;
        const raw = value instanceof Date ? value.toISOString() : value.toString();
        const parsed = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const parseNumericValue = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isNaN(value) ? null : value;
        const normalized = Number(value);
        return Number.isNaN(normalized) ? null : normalized;
      };

      const normalizeGroupText = (value) => (value || '').toString().trim().toUpperCase();

      const comparePricingRows = (a, b) => {
        const bDate = parsePricingDate(b.date);
        const aDate = parsePricingDate(a.date);
        const dateDiff = (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        if (dateDiff !== 0) return dateDiff;

        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        if (bUpdated !== aUpdated) return bUpdated - aUpdated;

        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        if (bCreated !== aCreated) return bCreated - aCreated;

        return String(b.id).localeCompare(String(a.id));
      };

      const groups = {};
      
      data.forEach(item => {
        if (!item.date || !item.client_id) return;
        const normalizedCode = normalizeGroupText(item.code);
        const normalizedSku = normalizeGroupText(item.sku);
        const referenceKey = normalizedCode || normalizedSku;
        if (!referenceKey) return;
        const key = `${item.client_id}-${referenceKey}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });

      const processedContracts = Object.values(groups).map(group => {
        const sortedGroup = [...group].sort(comparePricingRows);
        const currentFromFlag = sortedGroup.find(row => Boolean(row.is_current));
        const current = currentFromFlag || sortedGroup[0];
        const currentIndex = sortedGroup.findIndex(row => row.id === current.id);
        const referencePrevious = currentIndex >= 0 ? sortedGroup[currentIndex + 1] : null;

        // Calcular % Reajuste
        let readjustment_pct = 0;
        let previous_price = null;

        const previousGross = parseNumericValue(referencePrevious?.gross_price);
        const currentGross = parseNumericValue(current?.gross_price);

        if (previousGross !== null && previousGross > 0 && currentGross !== null) {
           previous_price = previousGross;
           readjustment_pct = ((currentGross - previousGross) / previousGross) * 100;
        }

        // Handle Supabase join result which might be object or array
        let clientName = 'Cliente Desconhecido';
        if (current.clients) {
          if (Array.isArray(current.clients)) {
            clientName = current.clients[0]?.name || clientName;
          } else if (typeof current.clients === 'object') {
            clientName = current.clients.name || clientName;
          }
        }

        return {
          ...current,
          gross_price: currentGross,
          net_price: parseNumericValue(current.net_price),
          margin_budget: parseNumericValue(current.margin_budget),
          client_name: clientName,
          readjustment_pct,
          previous_price
        };
      });
      
      setContracts(processedContracts);
      
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      if (field === 'dateFrom' || field === 'dateTo') {
        return { ...prev, [field]: value };
      }

      const newFilters = { ...prev, [field]: value };

      // Dependent filters clearing logic
      if (field === 'manager') {
        newFilters.client = '';
        newFilters.sku = '';
        newFilters.datasulCode = '';
      }
      if (field === 'client') {
        newFilters.sku = '';
        newFilters.datasulCode = '';
      }
      if (field === 'category') {
        newFilters.subcategory = '';
        newFilters.sku = '';
        newFilters.datasulCode = '';
      }
      if (field === 'subcategory') {
        newFilters.sku = '';
        newFilters.datasulCode = '';
      }

      return newFilters;
    });
  };

  // Generate Filter Options
  const managerOptions = useMemo(() => {
    const uniqueManagers = [...new Set(contracts.map(item => item.manager).filter(Boolean))].sort();
    return uniqueManagers.map(manager => ({ value: manager, label: manager }));
  }, [contracts]);

  const clientOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.manager) filtered = filtered.filter(item => item.manager === filters.manager);
    const uniqueClients = [...new Set(filtered.map(item => item.client_name))].sort();
    return uniqueClients.map(client => ({ value: client, label: client }));
  }, [contracts, filters.manager]);

  const categoryOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.client) {
      filtered = filtered.filter(item => item.client_name === filters.client);
    }
    const uniqueCategories = [...new Set(filtered.map(item => item.category).filter(Boolean))].sort();
    return uniqueCategories.map(cat => ({ value: cat, label: cat }));
  }, [contracts, filters.client]);

  const subcategoryOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.client) filtered = filtered.filter(item => item.client_name === filters.client);
    if (filters.category) filtered = filtered.filter(item => item.category === filters.category);
    
    const uniqueSubcategories = [...new Set(filtered.map(item => item.subcategory).filter(Boolean))].sort();
    return uniqueSubcategories.map(sub => ({ value: sub, label: sub }));
  }, [contracts, filters.client, filters.category]);

  const sizeOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.client) filtered = filtered.filter(item => item.client_name === filters.client);
    if (filters.category) filtered = filtered.filter(item => item.category === filters.category);
    if (filters.subcategory) filtered = filtered.filter(item => item.subcategory === filters.subcategory);

    const uniqueSizes = [...new Set(filtered.map(item => item.size).filter(Boolean))].sort();
    return uniqueSizes.map(size => ({ value: size, label: size }));
  }, [contracts, filters.client, filters.category, filters.subcategory]);

  const skuOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.manager) filtered = filtered.filter(item => item.manager === filters.manager);
    if (filters.client) filtered = filtered.filter(item => item.client_name === filters.client);
    if (filters.category) filtered = filtered.filter(item => item.category === filters.category);
    if (filters.subcategory) filtered = filtered.filter(item => item.subcategory === filters.subcategory);
    if (filters.size) filtered = filtered.filter(item => item.size === filters.size);

    const uniqueSkus = [...new Set(filtered.map(item => item.sku).filter(Boolean))].sort();
    return uniqueSkus.map(sku => ({ value: sku, label: sku }));
  }, [contracts, filters.manager, filters.client, filters.category, filters.subcategory, filters.size]);

  const codesFromSelectedSKU = useMemo(() => {
    if (!filters.sku) return [];
    let filtered = contracts;
    if (filters.manager) filtered = filtered.filter(item => item.manager === filters.manager);
    if (filters.client) filtered = filtered.filter(item => item.client_name === filters.client);
    if (filters.category) filtered = filtered.filter(item => item.category === filters.category);
    if (filters.subcategory) filtered = filtered.filter(item => item.subcategory === filters.subcategory);
    if (filters.size) filtered = filtered.filter(item => item.size === filters.size);

    return [...new Set(
      filtered
        .filter(item => item.sku === filters.sku && item.code)
        .map(item => item.code)
    )];
  }, [contracts, filters.manager, filters.client, filters.category, filters.subcategory, filters.size, filters.sku]);

  const datasulCodeOptions = useMemo(() => {
    let filtered = contracts;
    if (filters.client) filtered = filtered.filter(item => item.client_name === filters.client);
    if (filters.sku) {
      if (codesFromSelectedSKU.length > 0) {
        filtered = filtered.filter(item => item.code && codesFromSelectedSKU.includes(item.code));
      } else {
        filtered = filtered.filter(item => item.sku === filters.sku);
      }
    }

    const uniqueCodes = [...new Set(filtered.map(item => item.code).filter(Boolean))].sort();
    return uniqueCodes.map(code => ({ value: code, label: code }));
  }, [contracts, filters.client, filters.sku, codesFromSelectedSKU]);

  // Lógica dos Gates
  // calculateContractInfo agora é importada de ../utils/pricingUtils

  // Processamento dos dados com cálculos
  const processedData = useMemo(() => {
    return contracts.map(contract => {
      const info = calculateContractInfo(contract);
      
      // Financial Impact Calculation (Impacto = Preço Bruto * Volume)
      // Fallback para 0 se não houver dados
      const volume = Number(contract.volume) || 0;
      const price = Number(contract.gross_price) || 0;
      const financialImpact = volume * price;

      return {
        ...contract,
        ...info,
        financialImpact,
        communication_status: contract.communication_status || 'pending'
      };
    });
  }, [contracts]);

  // Filtragem
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const matchManager = !filters.manager || item.manager === filters.manager;
      const matchClient = !filters.client || item.client_name === filters.client;
      const matchSku = !filters.sku
        || (codesFromSelectedSKU.length > 0
          ? (item.code && codesFromSelectedSKU.includes(item.code))
          : item.sku === filters.sku);
      const matchCategory = !filters.category || item.category === filters.category;
      const matchSubcategory = !filters.subcategory || item.subcategory === filters.subcategory;
      const matchSize = !filters.size || item.size === filters.size;
      const matchCode = !filters.datasulCode || item.code === filters.datasulCode;
      const matchGate = !filters.gate || item.gate.toString() === filters.gate;
      const matchCommunication = !filters.communicationStatus || item.readjustment_status === filters.communicationStatus;
      
      let matchStatus = true;
      if (filters.status === 'critical') {
        matchStatus = item.status === 'critical';
      }

      let matchDate = true;
      if (item.next_validity_date) {
        const nextValDate = new Date(item.next_validity_date);
        if (filters.dateFrom) {
          const fromDate = parseISO(filters.dateFrom);
          if (isValid(fromDate)) {
            matchDate = matchDate && (isAfter(nextValDate, fromDate) || nextValDate.getTime() === fromDate.getTime());
          }
        }
        if (filters.dateTo) {
          const toDate = parseISO(filters.dateTo);
          if (isValid(toDate)) {
             // Add 1 day to include the end date or use isBefore/isEqual logic properly
             // Simply using isBefore(date, addDays(toDate, 1)) covers the whole day
             matchDate = matchDate && isBefore(nextValDate, addDays(toDate, 1));
          }
        }
      } else if (filters.dateFrom || filters.dateTo) {
        matchDate = false;
      }

      return matchManager && matchClient && matchSku && matchGate && matchCategory && matchSubcategory && matchSize && matchCode && matchDate && matchStatus && matchCommunication;
    });
  }, [processedData, filters, codesFromSelectedSKU]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        const key = sortConfig.key;

        if (key === 'communicationDate' || key === 'next_validity_date') {
          const aTime = key === 'communicationDate'
            ? (a.communicationDate ? new Date(a.communicationDate).getTime() : null)
            : (a.next_validity_date ? new Date(a.next_validity_date).getTime() : null);
          const bTime = key === 'communicationDate'
            ? (b.communicationDate ? new Date(b.communicationDate).getTime() : null)
            : (b.next_validity_date ? new Date(b.next_validity_date).getTime() : null);

          if (aTime === null && bTime === null) return 0;
          if (aTime === null) return 1;
          if (bTime === null) return -1;
          if (aTime < bTime) return -1 * direction;
          if (aTime > bTime) return 1 * direction;
          return 0;
        }

        const aValue = a[key];
        const bValue = b[key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue, 'pt-BR') * direction;
        }
        if (aValue < bValue) return -1 * direction;
        if (aValue > bValue) return 1 * direction;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    const defaultDirection = (key === 'communicationDate' || key === 'next_validity_date') ? 'desc' : 'asc';
    let direction = defaultDirection;
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    setSortConfig({ key, direction });
  };


  // Novos Cálculos para Visualizações Avançadas
  const advancedStats = useMemo(() => {
    // 1. Burndown Widget
    const today = startOfDay(new Date());
    const dueThisWeek = processedData.filter(i => 
      i.communicationDate && isThisWeek(i.communicationDate) && !isPast(i.communicationDate) && i.communication_status !== 'communicated'
    ).length;
    
    const overdue = processedData.filter(i => 
      i.communicationDate && isPast(i.communicationDate) && differenceInDays(today, i.communicationDate) > 0 && i.communication_status !== 'communicated'
    ).length;

    // 2. Timeline Chart (Next 60 days)
    const timelineMap = {};
    const startDate = subDays(today, 5); // Show a bit of history
    const endDate = addDays(today, 60);
    
    // Initialize days
    let currDate = startDate;
    while (isBefore(currDate, endDate) || isSameDay(currDate, endDate)) {
      const dateKey = format(currDate, 'yyyy-MM-dd');
      timelineMap[dateKey] = {
        date: dateKey,
        displayDate: format(currDate, 'dd/MM'),
        count: 0,
        financialValue: 0,
        overdue: 0,
        isPast: isBefore(currDate, today)
      };
      currDate = addDays(currDate, 1);
    }

    // Populate with data
    filteredData.forEach(item => {
      if (item.communicationDate) {
        const dateKey = format(item.communicationDate, 'yyyy-MM-dd');
        if (timelineMap[dateKey]) {
          timelineMap[dateKey].count++;
          timelineMap[dateKey].financialValue += (item.financialImpact || 0);
          if (isBefore(item.communicationDate, today)) {
             timelineMap[dateKey].overdue++;
          }
        }
      }
    });

    const timelineData = Object.values(timelineMap);

    // 3. Workload Heatmap
    const workloadMap = {};
    
    filteredData.forEach(item => {
      if (!item.manager) return;
      
      if (!workloadMap[item.manager]) {
        workloadMap[item.manager] = {
          manager: item.manager,
          gate1: 0,
          gate2: 0,
          gate3: 0,
          gate1Clients: [],
          gate2Clients: [],
          gate3Clients: []
        };
      }
      
      const entry = workloadMap[item.manager];
      if (item.gate === 1) {
        entry.gate1++;
        entry.gate1Clients.push(item.client_name);
      } else if (item.gate === 2) {
        entry.gate2++;
        entry.gate2Clients.push(item.client_name);
      } else if (item.gate === 3) {
        entry.gate3++;
        entry.gate3Clients.push(item.client_name);
      }
    });

    // Process top clients for tooltip
    const workloadData = Object.values(workloadMap).map(w => ({
      ...w,
      gate1Tooltip: [...new Set(w.gate1Clients)].slice(0, 3).join(', '),
      gate2Tooltip: [...new Set(w.gate2Clients)].slice(0, 3).join(', '),
      gate3Tooltip: [...new Set(w.gate3Clients)].slice(0, 3).join(', ')
    }));

    return {
      burndown: { dueThisWeek, overdue },
      timelineData,
      workloadData
    };
  }, [processedData, filteredData]);

  // KPIs e Dados para Gráficos
  const { kpis, chartData } = useMemo(() => {
    const totalContracts = filteredData.length;
    
    // Distribuição por Gate (Moved up for reuse in Card 1)
    const gate1Count = filteredData.filter(i => i.gate === 1).length;
    const gate2Count = filteredData.filter(i => i.gate === 2).length;
    const gate3Count = filteredData.filter(i => i.gate === 3).length;

    const gateData = [
      { name: 'Gate 1', value: gate1Count, color: '#64D020' }, // Green
      { name: 'Gate 2', value: gate2Count, color: '#1AC6FC' }, // Blue
      { name: 'Gate 3', value: gate3Count, color: '#845AFA' }, // Purple
    ].filter(i => i.value > 0);

    // Critical Contracts Logic
    // Status 'critical' already handles: daysRemaining <= 30 && !isNewContract && !communicated
    const criticalContractsItems = filteredData.filter(i => i.status === 'critical');
    const criticalContracts = criticalContractsItems.length;
    const criticalFinancialImpact = criticalContractsItems.reduce((acc, curr) => acc + (curr.financialImpact || 0), 0);
    
    // Next Gate Logic (Planning)
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    let currentGate = 1;
    if (currentMonth >= 2 && currentMonth <= 5) currentGate = 2;
    if (currentMonth >= 6 && currentMonth <= 9) currentGate = 3;
    
    // Próximo Gate cíclico: 1->2->3->1
    const nextGate = (currentGate % 3) + 1; 
    const nextGateSkus = filteredData.filter(i => i.gate === nextGate).length;
    
    // Determinar mês de vigência do próximo gate
    let nextGateStartMonth = 'Novembro'; // Gate 1 Start
    if (nextGate === 2) nextGateStartMonth = 'Março';
    if (nextGate === 3) nextGateStartMonth = 'Julho';

    const nextMonthReajust = filteredData.filter(i => i.next_validity_date && isSameMonth(new Date(i.next_validity_date), addMonths(new Date(), 1))).length;

    // Distribuição por Status
    const statusData = [
      { name: 'Crítico', value: criticalContracts, color: '#EF4444' }, // Red
      { name: 'Em dia', value: totalContracts - criticalContracts, color: '#64D020' }, // Green
    ].filter(i => i.value > 0);

    // Contratos por Mês (Próximos 12 meses)
    const monthlyData = {};
    filteredData.forEach(item => {
      if (item.next_validity_date) {
        const date = new Date(item.next_validity_date);
        // Use a sortable key format YYYY-MM for sorting, but display MMM/yy
        const sortKey = format(date, 'yyyy-MM');
        const displayKey = format(date, 'MMM/yy', { locale: ptBR });
        
        if (!monthlyData[sortKey]) {
          monthlyData[sortKey] = { name: displayKey, value: 0, sortKey };
        }
        monthlyData[sortKey].value++;
      }
    });

    // Ordenar cronologicamente
    const monthlyChartData = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ name, value }) => ({ name, value }));

    return { 
      kpis: { 
        totalContracts, 
        criticalContracts, 
        nextMonthReajust, 
        criticalFinancialImpact,
        gate1Count,
        gate2Count,
        gate3Count,
        nextGate,
        nextGateSkus,
        nextGateStartMonth
      },
      chartData: { gateData, statusData, monthlyChartData }
    };
  }, [filteredData]);

  const handleStatusChange = useCallback(async (item, newStatus) => {
    const previousStatus = item.readjustment_status;

    try {
      // Optimistic update
      setContracts(currentContracts => 
        currentContracts.map(c => 
          c.id === item.id ? { ...c, readjustment_status: newStatus } : c
        )
      );

      const { error } = await supabase
        .from('pricing_history')
        .update({ readjustment_status: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success(`Status atualizado para: ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode alterar o status deste reajuste.')
          : 'Erro ao atualizar status. As alterações foram revertidas.'
      );
      
      // Revert to previous status
      setContracts(currentContracts => 
        currentContracts.map(c => 
          c.id === item.id ? { ...c, readjustment_status: previousStatus } : c
        )
      );
    }
  }, []);

  const canManageContractFields = isPricingUser || area === 'CS';
  const canDeleteContracts = isPricingUser;

  const handleUpdateField = async (item, field, value) => {
    try {
      console.log(`Tentando atualizar ${field} para ${value} no item:`, item);

      // Verificação básica
      if (!item || !item.id) {
        throw new Error('Item inválido ou sem ID');
      }

      // Preparar query base
      let query = supabase.from('pricing_history').update({ [field]: value });
      
      // Se for atualização de gestor, aplica para todos os registros desse cliente
      // MAS, cuidado: item.client_id pode não existir se não foi selecionado na query original
      // Vamos verificar se client_id existe antes de usar
      if (field === 'manager' && item.client_id) {
         query = query.eq('client_id', item.client_id);
      } else {
         // Fallback seguro: atualizar apenas o registro específico pelo ID
         query = query.eq('id', item.id);
      }

      const { data, error } = await query.select(); // Adicionado .select() para confirmar a atualização e ver retorno

      if (error) {
        console.error('Erro Supabase:', error);
        throw error;
      }

      console.log('Atualização bem-sucedida:', data);
      
      toast.success(`${field === 'manager' ? 'Gestor' : 'Gate'} atualizado com sucesso!`);
      
      // Atualização otimista local
      setContracts(prev => prev.map(c => {
        if (field === 'manager' && item.client_id) {
            // Atualiza todos os registros desse cliente
            return c.client_id === item.client_id ? { ...c, [field]: value } : c;
        }
        return c.id === item.id ? { ...c, [field]: value } : c;
      }));

    } catch (error) {
      console.error('Erro detalhado ao atualizar:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode alterar este campo neste registro.')
          : `Erro ao atualizar dados: ${error.message || 'Erro desconhecido'}`
      );
    }
  };

  const handleDeleteContract = async (item) => {
    if (!canDeleteContracts || !item || !item.id) return;

    try {
      const { error } = await supabase
        .from('pricing_history')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast.success('Preço excluído com sucesso!');
      
      // Remove do estado local
      setContracts(prev => prev.filter(c => c.id !== item.id));
      setDeleteConfirmOpen(false);
      setItemToDelete(null);

    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode excluir este registro.')
          : `Erro ao excluir: ${error.message || 'Erro desconhecido'}`
      );
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'SKU', 'Cliente', 'Gestor', 'Categoria', 'Subcategoria', 
      'Preço Atual', 'Data Último Preço', 'Gate', 'Data Contrato', 'Prox. Vigência', 
      'Data Comunicação', 'Status', '% Reajuste'
    ];
    
    const rows = filteredData.map(item => [
      item.sku,
      item.client_name,
      item.manager,
      item.category,
      item.subcategory,
      (item.gross_price || 0).toString().replace('.', ','),
      item.last_price_date ? format(new Date(item.last_price_date), 'dd/MM/yyyy') : '-',
      item.gate,
      format(new Date(item.date), 'dd/MM/yyyy'),
      item.next_validity_date ? format(new Date(item.next_validity_date), 'dd/MM/yyyy') : '-',
      item.communicationDate ? format(new Date(item.communicationDate), 'dd/MM/yyyy') : '-',
      item.readjustment_status || 'Em Análise',
      (item.readjustment_pct || 0).toFixed(2).replace('.', ',') + '%'
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `cs_action_list_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  const handleRowClick = (item) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  };

  const handleEditClick = (e, item) => {
    e.stopPropagation(); // Evita abrir o modal de histórico
    setEditingItem(item);
    setObservation(item.observation || '');
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const handleSaveObservation = async () => {
    if (!editingItem) return;

    try {
      // Salvando no Supabase
      const { error } = await supabase
        .from('pricing_history')
        .update({ obs: observation })
        .eq('id', editingItem.id);
      
      if (error) throw error;

      // Atualizando estado localmente para feedback imediato
      const updatedContracts = contracts.map(c => 
        c.id === editingItem.id ? { ...c, observation } : c
      );
      setContracts(updatedContracts);
      
      toast.success('Observação salva com sucesso!');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode editar a observação deste registro.')
          : 'Erro ao salvar observação'
      );
    }
  };

  const handleOpenDateEdit = (event, item, field) => {
    event.stopPropagation();
    if (!isPricingUser) return;

    const currentValue = field === 'communicationDate' ? item.communicationDate : item.next_validity_date;
    const normalizedValue = currentValue ? format(new Date(currentValue), 'yyyy-MM-dd') : '';

    setDateEditModal({
      open: true,
      item,
      field,
      value: normalizedValue
    });
  };

  const handleSaveDateEdit = async () => {
    if (!dateEditModal.item || !dateEditModal.field || !dateEditModal.value) {
      toast.error('Selecione uma data válida.');
      return;
    }

    const selectedDate = parseISO(dateEditModal.value);
    if (!isValid(selectedDate)) {
      toast.error('Data inválida.');
      return;
    }

    const targetNextValidity = dateEditModal.field === 'communicationDate'
      ? addDays(selectedDate, 30)
      : selectedDate;

    const fallbackBaseDate = new Date();
    const currentBaseDate = dateEditModal.item.date
      ? new Date(`${dateEditModal.item.date}T12:00:00`)
      : fallbackBaseDate;
    const safeBaseDate = isValid(currentBaseDate) ? currentBaseDate : fallbackBaseDate;

    const updatedBaseDate = new Date(safeBaseDate);
    updatedBaseDate.setMonth(targetNextValidity.getMonth(), targetNextValidity.getDate());

    if (!isValid(updatedBaseDate)) {
      toast.error('Não foi possível aplicar a data selecionada.');
      return;
    }

    const payload = {
      date: format(updatedBaseDate, 'yyyy-MM-dd'),
      month: format(updatedBaseDate, 'MMM/yy', { locale: ptBR }),
      gate: calculateGate(updatedBaseDate.getMonth())
    };

    try {
      setSavingDateEdit(true);
      const { error } = await supabase
        .from('pricing_history')
        .update(payload)
        .eq('id', dateEditModal.item.id);

      if (error) throw error;

      setContracts(prev => prev.map(contract => (
        contract.id === dateEditModal.item.id ? { ...contract, ...payload } : contract
      )));

      toast.success('Data atualizada com sucesso.');
      setDateEditModal({ open: false, item: null, field: null, value: '' });
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode alterar as datas deste registro.')
          : 'Erro ao atualizar data.'
      );
    } finally {
      setSavingDateEdit(false);
    }
  };

  // Helper para abrir modal com SKUs do gráfico
  const handleChartClick = (data, type) => {
    if (!data) return;
    
    let filteredSkus = [];
    let title = '';

    if (type === 'timeline') {
      // Filtrar por data
      const clickedDate = data.date; // formato yyyy-MM-dd
      if (!clickedDate) return;
      
      filteredSkus = filteredData.filter(item => 
        item.communicationDate && format(item.communicationDate, 'yyyy-MM-dd') === clickedDate
      );
      title = `SKUs para comunicar em ${data.displayDate || clickedDate}`;
    } else if (type === 'gate') {
      // Filtrar por gate
      const name = data.name || data.payload?.name;
      if (!name) return;

      const gateNum = parseInt(name.replace('Gate ', ''));
      filteredSkus = filteredData.filter(item => item.gate === gateNum);
      title = `SKUs do Gate ${gateNum}`;
    }

    // Modal simples
    setModalClientFilter(''); // Resetar filtro de cliente ao abrir
    setModalData({ isOpen: true, title, items: filteredSkus });
  };

  const handleWorkloadClick = (manager, gate) => {
    const filteredSkus = filteredData.filter(item => item.manager === manager && item.gate === gate);
    const title = `SKUs de ${manager} - Gate ${gate}`;
    setModalClientFilter('');
    setModalData({ isOpen: true, title, items: filteredSkus });
  };

  // Estado para o modal de detalhes
  const [modalData, setModalData] = useState({ isOpen: false, title: '', items: [] });
  const [modalClientFilter, setModalClientFilter] = useState('');

  // Filter items in modal based on selected client
  const modalFilteredItems = useMemo(() => {
    if (!modalClientFilter) return modalData.items;
    return modalData.items.filter(item => item.client_name === modalClientFilter);
  }, [modalData.items, modalClientFilter]);

  // Get unique clients for modal dropdown
  const modalClientOptions = useMemo(() => {
    const clients = [...new Set(modalData.items.map(item => item.client_name))].sort();
    return clients;
  }, [modalData.items]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle="Dados Business Development" 
        showBack={false} 
        logoRedirect="/select"
      />
      
        {/* Modal de Detalhes do Gráfico */}
        {modalData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-blue-500" />
                  {modalData.title}
                </h3>
                <button 
                  onClick={() => setModalData({ ...modalData, isOpen: false })}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Filtro de Cliente no Modal */}
              <div className="w-full md:w-1/2">
                <select
                  value={modalClientFilter}
                  onChange={(e) => setModalClientFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer"
                >
                  <option value="">Todos os Clientes ({modalData.items.length} SKUs)</option>
                  {modalClientOptions.map(client => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {modalFilteredItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modalFilteredItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      item.gate === 1 ? 'bg-green-50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' :
                      item.gate === 2 ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' :
                      'bg-purple-50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/30'
                    }`}
                      onClick={() => {
                        setSelectedItem(item);
                        setIsHistoryModalOpen(true);
                      }}
                      title="Ver histórico detalhado"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{item.sku}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold flex items-center justify-center ${
                          item.gate === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          item.gate === 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>Gate {item.gate}</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p>Cliente: <span className="text-gray-900 dark:text-gray-200">{item.client_name}</span></p>
                        <p>Gestor: <span className="text-gray-900 dark:text-gray-200">{item.manager || '-'}</span></p>
                        <p>Preço Atual: <span className="text-gray-900 dark:text-gray-200">
                          {formatRowCurrency(item.gross_price, item.currency)}
                        </span>
                        {item.last_price_date && (
                          <span className="text-xs text-gray-500 ml-2">
                             ({format(new Date(item.last_price_date), 'dd/MM/yy')})
                          </span>
                        )}
                        </p>
                        <p>Comunicação: <span className={`${
                          item.daysRemaining < 0 ? 'text-red-600 font-medium' : 'text-gray-900 dark:text-gray-200'
                        }`}>
                          {item.communicationDate ? format(item.communicationDate, 'dd/MM/yyyy') : '-'}
                        </span></p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Nenhum item encontrado para esta seleção.
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl flex justify-end">
              <button
                onClick={() => setModalData({ ...modalData, isOpen: false })}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto mt-8 px-6 pb-12">
        
        {/* Widget de Burn-down (Gestão por Exceção) */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-lg p-6 mb-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`p-4 rounded-xl transition-colors ${
              advancedStats.burndown.overdue > 0 
                ? 'bg-red-50 text-[#EF4444] dark:bg-red-900/10' 
                : 'bg-green-50 text-[#64D020] dark:bg-green-900/10'
            }`}>
              <Flame className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-1">Radar de Urgência</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  <strong className="text-gray-900 dark:text-white">{advancedStats.burndown.dueThisWeek}</strong> para comunicar esta semana
                </span>
                <span className="w-px h-4 bg-gray-200 dark:bg-gray-700"></span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${advancedStats.burndown.overdue > 0 ? 'bg-[#EF4444]' : 'bg-green-500'}`}></span>
                  <strong className={`${advancedStats.burndown.overdue > 0 ? 'text-[#EF4444]' : 'text-green-500'}`}>
                    {advancedStats.burndown.overdue}
                  </strong> em atraso
                </span>
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'critical' ? '' : 'critical' }))}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 border ${
              filters.status === 'critical' 
                ? 'bg-[#EF4444] text-white border-[#EF4444] shadow-lg shadow-red-500/20' 
                : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Target className="w-5 h-5" />
            {filters.status === 'critical' ? 'Remover Foco' : 'Focar no Crítico'}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Panorama da Carteira */}
          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Contratos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{kpis.totalContracts}</h3>
              </div>
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <LayoutGrid className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            
            {/* Visual Distribution Bar */}
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {kpis.totalContracts > 0 && (
                  <>
                    <div style={{ width: `${(kpis.gate1Count / kpis.totalContracts) * 100}%` }} className="bg-[#64D020]" />
                    <div style={{ width: `${(kpis.gate2Count / kpis.totalContracts) * 100}%` }} className="bg-[#1AC6FC]" />
                    <div style={{ width: `${(kpis.gate3Count / kpis.totalContracts) * 100}%` }} className="bg-[#845AFA]" />
                  </>
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#64D020]"></span>G1: {kpis.gate1Count}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1AC6FC]"></span>G2: {kpis.gate2Count}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#845AFA]"></span>G3: {kpis.gate3Count}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Radar de Urgência */}
          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between relative overflow-hidden">
             {/* Red Accent Border */}
             <div className="absolute top-0 left-0 w-1 h-full bg-[#EF4444]"></div>
             
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Próximos 30 Dias (Comunicação)</p>
                <h3 className="text-2xl font-bold text-[#EF4444] mt-2">{kpis.criticalContracts}</h3>
                <p className="text-xs text-[#EF4444] mt-1 font-medium bg-[#EF4444]/10 px-2 py-1 rounded inline-block">
                  Impacto: {kpis.criticalFinancialImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-[#EF4444]/10 dark:bg-[#EF4444]/20 animate-pulse">
                <AlertCircle className="w-6 h-6 text-[#EF4444]" />
              </div>
            </div>
          </div>

          {/* Card 3: Próximo Ciclo */}
          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Próximo Gate de Reajuste</p>
                <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">{kpis.nextGateSkus} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">SKUs no Gate {kpis.nextGate}</span></h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Vigência prevista para {kpis.nextGateStartMonth}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Ações */}
        <div className="bg-white dark:bg-[#0a0a0a] p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex items-center justify-between mb-4">
            {/* Header dos Filtros */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filtros
                </h3>
              </div>
              
              {(filters.manager || filters.client || filters.sku || filters.datasulCode || filters.gate || filters.dateFrom || filters.dateTo || filters.communicationStatus) && (
                <button 
                  onClick={() => setFilters({
                    manager: '', client: '', sku: '', category: '', subcategory: '', size: '', datasulCode: '', gate: '', dateFrom: '', dateTo: '', communicationStatus: ''
                  })}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-full transition-colors"
                >
                  <X size={14} />
                  Limpar Filtros
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Exportar Lista de Ação"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'dashboard' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  title="Visualização em Dashboard"
                >
                  <LayoutDashboard size={20} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  title="Visualização em Tabela"
                >
                  <TableIcon size={20} />
                </button>
              </div>
            </div>
          </div>

            {/* Grid de Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gestor</label>
                <SearchableSelect
                  options={managerOptions}
                  value={filters.manager}
                  onChange={(value) => handleFilterChange('manager', value)}
                  placeholder="Todos os gestores"
                  searchPlaceholder="Buscar gestor..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">SKU</label>
                <SearchableSelect
                  options={skuOptions}
                  value={filters.sku}
                  onChange={(value) => handleFilterChange('sku', value)}
                  placeholder="Todos os SKUs"
                  searchPlaceholder="Buscar SKU..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
                <SearchableSelect
                  options={clientOptions}
                  value={filters.client}
                  onChange={(value) => handleFilterChange('client', value)}
                  placeholder="Todos os clientes"
                  searchPlaceholder="Buscar cliente..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período (Vigência)</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none h-[42px] focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none h-[42px] focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gate</label>
                <div className="relative">
                  <select
                    value={filters.gate}
                    onChange={(e) => handleFilterChange('gate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 outline-none h-[42px] transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todos Gates</option>
                    <option value="1">Gate 1</option>
                    <option value="2">Gate 2</option>
                    <option value="3">Gate 3</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status do Reajuste</label>
                <div className="relative">
                  <select
                    value={filters.communicationStatus}
                    onChange={(e) => handleFilterChange('communicationStatus', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 outline-none h-[42px] transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todos Status</option>
                    <option value="Em Análise">Em Análise</option>
                    <option value="Comunicado">Comunicado</option>
                    <option value="Em Negociação">Em Negociação</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Implementado">Implementado</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Botão de Regras de Gate (Popover) */}
              <div className="flex items-end pb-1">
                 <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors h-[32px]">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Regras de Gate
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 bg-white dark:bg-[#171717] border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                      <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-500" />
                        Cronograma Operacional
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Ciclo de reajuste anual baseado no mês de aniversário.
                      </p>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {/* Gate 1 */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5"></div>
                          <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1"></div>
                        </div>
                        <div className="flex-1 pb-2">
                          <h5 className="font-bold text-sm text-green-700 dark:text-green-400 mb-1">Gate 1 (Verde)</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded border border-green-100 dark:border-green-900/20">
                              <span className="font-semibold block mb-0.5">Análise</span>
                              Novembro, Dezembro, Janeiro, Fevereiro
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                              <span className="font-semibold block mb-0.5">Comunicação</span>
                              30 dias antes
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gate 2 */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5"></div>
                          <div className="w-0.5 h-full bg-gray-100 dark:bg-gray-800 my-1"></div>
                        </div>
                        <div className="flex-1 pb-2">
                          <h5 className="font-bold text-sm text-blue-700 dark:text-blue-400 mb-1">Gate 2 (Azul)</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded border border-blue-100 dark:border-blue-900/20">
                              <span className="font-semibold block mb-0.5">Análise</span>
                              Março, Abril, Maio, Junho
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                              <span className="font-semibold block mb-0.5">Comunicação</span>
                              30 dias antes
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Gate 3 */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1.5"></div>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-sm text-purple-700 dark:text-purple-400 mb-1">Gate 3 (Roxo)</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-2 rounded border border-purple-100 dark:border-purple-900/20">
                              <span className="font-semibold block mb-0.5">Análise</span>
                              Julho, Agosto, Setembro, Outubro
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                              <span className="font-semibold block mb-0.5">Comunicação</span>
                              30 dias antes
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Comunicação obrigatória 30 dias antes da vigência.</span>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
        </div>

        {/* Conteúdo: Dashboard ou Tabela */}
        {viewMode === 'dashboard' ? (
          <div className="space-y-6">
            
            {/* 1. Gate + Matriz de Carga de Trabalho (Topo) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gráfico de Gates */}
              <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Distribuição por Gate</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart className="cursor-pointer">
                      <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                          <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                          <feFlood floodColor="rgba(0,0,0,0.3)" result="color" />
                          <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
                          <feComposite in="SourceGraphic" in2="shadow" operator="over" />
                        </filter>
                      </defs>
                      <Pie
                        data={chartData.gateData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        filter="url(#shadow)"
                        onClick={(data) => handleChartClick(data, 'gate')}
                        isAnimationActive={true}
                      >
                        {chartData.gateData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke="rgba(255,255,255,0.2)" 
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '12px', 
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          color: '#374151'
                        }}
                        itemStyle={{ color: '#374151' }}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Matriz de Carga de Trabalho (Heatmap) */}
              <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Distribuição de Carteira</h3>
                  <div className="text-xs text-gray-500">Volume de SKUs por Gestor/Gate</div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 font-medium text-gray-500">Gestor</th>
                        <th className="text-center py-2 font-medium text-[#64D020]">Gate 1</th>
                        <th className="text-center py-2 font-medium text-[#1AC6FC]">Gate 2</th>
                        <th className="text-center py-2 font-medium text-[#845AFA]">Gate 3</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {advancedStats.workloadData.map((item) => (
                        <tr key={item.manager} className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="py-3 font-medium text-gray-700 dark:text-gray-300">{item.manager}</td>
                          
                          {/* Gate 1 Cell */}
                          <td className="p-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    onClick={() => handleWorkloadClick(item.manager, 1)}
                                    className="h-full w-full min-h-[32px] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 cursor-pointer"
                                    style={{ 
                                      backgroundColor: `rgba(100, 208, 32, ${Math.min(0.1 + (item.gate1 / 20), 0.9)})`,
                                      color: item.gate1 > 10 ? '#fff' : '#14532d'
                                    }}
                                  >
                                    {item.gate1 > 0 ? item.gate1 : '-'}
                                  </div>
                                </TooltipTrigger>
                                {item.gate1 > 0 && (
                                  <TooltipContent>
                                    <div className="font-semibold mb-1">Principais Clientes:</div>
                                    <div className="text-xs">{item.gate1Tooltip}</div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </td>

                          {/* Gate 2 Cell */}
                          <td className="p-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    onClick={() => handleWorkloadClick(item.manager, 2)}
                                    className="h-full w-full min-h-[32px] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 cursor-pointer"
                                    style={{ 
                                      backgroundColor: `rgba(26, 198, 252, ${Math.min(0.1 + (item.gate2 / 20), 0.9)})`,
                                      color: item.gate2 > 10 ? '#fff' : '#0c4a6e'
                                    }}
                                  >
                                    {item.gate2 > 0 ? item.gate2 : '-'}
                                  </div>
                                </TooltipTrigger>
                                {item.gate2 > 0 && (
                                  <TooltipContent>
                                    <div className="font-semibold mb-1">Principais Clientes:</div>
                                    <div className="text-xs">{item.gate2Tooltip}</div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </td>

                          {/* Gate 3 Cell */}
                          <td className="p-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    onClick={() => handleWorkloadClick(item.manager, 3)}
                                    className="h-full w-full min-h-[32px] rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 cursor-pointer"
                                    style={{ 
                                      backgroundColor: `rgba(132, 90, 250, ${Math.min(0.1 + (item.gate3 / 20), 0.9)})`,
                                      color: item.gate3 > 10 ? '#fff' : '#4c1d95'
                                    }}
                                  >
                                    {item.gate3 > 0 ? item.gate3 : '-'}
                                  </div>
                                </TooltipTrigger>
                                {item.gate3 > 0 && (
                                  <TooltipContent>
                                    <div className="font-semibold mb-1">Principais Clientes:</div>
                                    <div className="text-xs">{item.gate3Tooltip}</div>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {advancedStats.workloadData.length === 0 && (
                     <div className="text-center text-gray-500 py-8">Nenhum dado para exibir</div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Timeline Chart (Gantt Simplificado) (Meio) */}
            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-500" />
                  Timeline de Comunicações (Próximos 60 Dias)
                </h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-[#EF4444] rounded-sm"></span>
                    <span className="text-gray-500">Atrasado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded-sm"></span>
                    <span className="text-gray-500">Futuro</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart 
                    data={advancedStats.timelineData} 
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    onClick={(data) => {
                      if (data && data.activePayload && data.activePayload.length > 0) {
                        handleChartClick(data.activePayload[0].payload, 'timeline');
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <defs>
                      <filter id="timelineShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                        <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                        <feFlood floodColor="rgba(0,0,0,0.3)" result="color" />
                        <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
                        <feComposite in="SourceGraphic" in2="shadow" operator="over" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="displayDate" 
                      tick={{ fill: '#666', fontSize: 10 }} 
                      interval={6}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#666', fontSize: 11 }} 
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '12px', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        color: '#374151'
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      formatter={(value, name, props) => {
                        const financialValue = props.payload.financialValue;
                        return [
                          <div key="val" className="flex flex-col gap-1">
                            <span>{value} SKUs</span>
                            <span className="text-xs font-medium text-gray-500">
                              Impacto: {financialValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>,
                          name === 'count' ? 'Quantidade' : name
                        ];
                      }}
                    />
                    <ReferenceLine x={format(new Date(), 'dd/MM')} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Hoje', fill: '#EF4444', fontSize: 12, position: 'top' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} filter="url(#timelineShadow)" isAnimationActive={true}>
                      {advancedStats.timelineData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isPast ? '#EF4444' : '#3B82F6'} 
                          opacity={entry.isPast ? 0.8 : 1}
                        />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Status + Reajustes (Fim) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gráfico de Status */}
              <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Status dos Contratos</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <defs>
                        <filter id="statusShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                          <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                          <feFlood floodColor="rgba(0,0,0,0.3)" result="color" />
                          <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
                          <feComposite in="SourceGraphic" in2="shadow" operator="over" />
                        </filter>
                      </defs>
                      <Pie
                        data={chartData.statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={100}
                        dataKey="value"
                        stroke="none"
                        filter="url(#statusShadow)"
                        isAnimationActive={true}
                      >
                        {chartData.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico de Reajustes Mensais */}
              <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Previsão de Reajustes (12 Meses)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData.monthlyChartData}>
                      <defs>
                        <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
                          <feOffset in="blur" dx="2" dy="2" result="offsetBlur" />
                          <feFlood floodColor="rgba(132, 90, 250, 0.3)" result="color" />
                          <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
                          <feComposite in="SourceGraphic" in2="shadow" operator="over" />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666' }} />
                      <YAxis stroke="#666" tick={{ fill: '#666' }} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      />
                      <Bar 
                        dataKey="value" 
                        name="Contratos" 
                        fill="#845AFA" 
                        radius={[4, 4, 0, 0]} 
                        filter="url(#barShadow)"
                        isAnimationActive={true}
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detalhamento de SKUs e Clientes */}
            {(filters.gate || filters.manager) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-[400px]">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                    <span>Clientes na Seleção</span>
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      {[...new Set(filteredData.map(i => i.client_name))].length} clientes
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {[...new Set(filteredData.map(i => i.client_name))].sort().map((client, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                        {client}
                      </div>
                    ))}
                    {filteredData.length === 0 && (
                       <p className="text-gray-500 text-center py-4">Nenhum cliente encontrado</p>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-[400px]">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                    <span>SKUs na Seleção</span>
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      {[...new Set(filteredData.map(i => i.sku))].length} SKUs
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {[...new Set(filteredData.map(i => i.sku))].sort().map((sku, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => {
                          const item = filteredData.find(i => i.sku === sku);
                          if (item) {
                            setSelectedItem(item);
                            setIsHistoryModalOpen(true);
                          }
                        }}
                      >
                        <span>{sku}</span>
                        <span className="text-xs text-gray-400">
                           {filteredData.find(i => i.sku === sku)?.client_name}
                        </span>
                      </div>
                    ))}
                    {filteredData.length === 0 && (
                       <p className="text-gray-500 text-center py-4">Nenhum SKU encontrado</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-20 text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/95 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold text-center w-[180px]">Status do Reajuste</th>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Gestor</th>
                  <th className="px-6 py-4 font-semibold">Código</th>
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold text-center">Gate</th>
                  <th className="px-6 py-4 font-semibold">Último Preço</th>
                  <th
                    className="px-6 py-4 font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => requestSort('communicationDate')}
                  >
                    Próx. Comunicação
                    {sortConfig.key === 'communicationDate' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th
                    className="px-6 py-4 font-semibold cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => requestSort('next_validity_date')}
                  >
                    Próx. Vigência
                    {sortConfig.key === 'next_validity_date' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-4 font-semibold text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
                    onClick={() => requestSort('readjustment_pct')}
                  >
                    % Reajuste
                    {sortConfig.key === 'readjustment_pct' && (
                      <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-4 font-semibold text-center w-[50px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-8 text-center text-gray-500">
                      Carregando dados...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-8 text-center text-gray-500">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item) => (
                    <tr 
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="bg-white dark:bg-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={item.readjustment_status || 'Em Análise'}
                          onValueChange={(value) => handleStatusChange(item, value)}
                        >
                          <SelectTrigger className={`w-[160px] h-8 text-xs font-medium border-0 focus:ring-0 focus:ring-offset-0 ${WORKFLOW_STATUS_OPTIONS.find(opt => opt.value === (item.readjustment_status || 'Em Análise'))?.color || 'bg-gray-100 text-gray-700'}`}>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKFLOW_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></div>
                                  {option.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {item.client_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300" onClick={(e) => e.stopPropagation()}>
                        {canManageContractFields ? (
                          <Select
                            value={item.manager || ''}
                            onValueChange={(value) => handleUpdateField(item, 'manager', value)}
                          >
                            <SelectTrigger className="w-full min-w-[120px] h-8 text-xs font-medium border-0 focus:ring-0 focus:ring-offset-0 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              {managerOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          item.manager || '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.code}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {canManageContractFields ? (
                          <Select
                            value={item.gate ? item.gate.toString() : '1'}
                            onValueChange={(value) => handleUpdateField(item, 'gate', parseInt(value))}
                          >
                            <SelectTrigger className={`w-14 h-8 text-xs font-bold border-0 focus:ring-0 justify-center mx-auto rounded-full
                              ${item.gate === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                                item.gate === 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                              <span>G{item.gate}</span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1" className="text-xs font-medium text-green-600">Gate 1</SelectItem>
                              <SelectItem value="2" className="text-xs font-medium text-blue-600">Gate 2</SelectItem>
                              <SelectItem value="3" className="text-xs font-medium text-purple-600">Gate 3</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                            ${item.gate === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                              item.gate === 2 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                              'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            G{item.gate}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatRowCurrency(item.gross_price, item.currency)}
                          </span>
                          {item.last_price_date && (
                             <span className="text-xs text-gray-500">
                               {format(new Date(item.last_price_date), 'dd/MM/yyyy')}
                             </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300" onClick={(e) => e.stopPropagation()}>
                        {isPricingUser ? (
                          <button
                            onClick={(e) => handleOpenDateEdit(e, item, 'communicationDate')}
                            className="inline-flex items-center rounded px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {item.communicationDate ? format(new Date(item.communicationDate), 'dd/MM/yyyy') : '-'}
                          </button>
                        ) : (
                          item.communicationDate ? format(new Date(item.communicationDate), 'dd/MM/yyyy') : '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300" onClick={(e) => e.stopPropagation()}>
                        {isPricingUser ? (
                          <button
                            onClick={(e) => handleOpenDateEdit(e, item, 'next_validity_date')}
                            className="inline-flex items-center rounded px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            {item.next_validity_date ? format(new Date(item.next_validity_date), 'dd/MM/yyyy') : '-'}
                          </button>
                        ) : (
                          item.next_validity_date ? format(new Date(item.next_validity_date), 'dd/MM/yyyy') : '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        <div className={`flex items-center justify-end gap-1 ${
                            item.readjustment_pct > 0 ? 'text-green-600 dark:text-green-400' : 
                            item.readjustment_pct < 0 ? 'text-red-600 dark:text-red-400' : 
                            'text-gray-500'
                        }`}>
                            {item.readjustment_pct > 0 ? <TrendingUp size={14} /> : 
                             item.readjustment_pct < 0 ? <TrendingDown size={14} /> : null}
                            {item.readjustment_pct ? item.readjustment_pct.toFixed(2) : '0.00'}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => handleEditClick(e, item)}
                            className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Editar observação"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {canDeleteContracts && (
                            <button
                              onClick={(e) => handleDeleteClick(e, item)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Excluir preço"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Modal de Histórico */}
      <HistoryChartModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        sku={selectedItem?.sku}
        code={selectedItem?.code}
        clientId={selectedItem?.client_id}
        clientName={selectedItem?.client_name}
        readjustmentStatus={selectedItem?.readjustment_status}
        onStatusChange={(newStatus) => selectedItem && handleStatusChange(selectedItem, newStatus)}
      />

      <Dialog
        open={dateEditModal.open}
        onOpenChange={(open) => {
          if (savingDateEdit) return;
          if (!open) {
            setDateEditModal({ open: false, item: null, field: null, value: '' });
          } else {
            setDateEditModal(prev => ({ ...prev, open: true }));
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-[#171717] dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Editar {dateEditModal.field === 'communicationDate' ? 'Próx. Comunicação' : 'Próx. Vigência'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dateEditModal.item?.client_name} - {dateEditModal.item?.sku}
            </p>
            <input
              type="date"
              value={dateEditModal.value}
              onChange={(e) => setDateEditModal(prev => ({ ...prev, value: e.target.value }))}
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setDateEditModal({ open: false, item: null, field: null, value: '' })}
              disabled={savingDateEdit}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 h-10 px-4 py-2 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDateEdit}
              disabled={savingDateEdit || !dateEditModal.value}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:opacity-50"
            >
              {savingDateEdit ? 'Salvando...' : 'Salvar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white dark:bg-[#171717] dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o registro de preço para o SKU 
              <span className="font-semibold text-gray-900 dark:text-white"> {itemToDelete?.sku} </span>
              do cliente 
              <span className="font-semibold text-gray-900 dark:text-white"> {itemToDelete?.client_name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0 hover:bg-gray-200 dark:hover:bg-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleDeleteContract(itemToDelete)}
              className="bg-red-600 text-white hover:bg-red-700 border-0"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#171717] dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Editar/Observar Reajuste</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none text-gray-900 dark:text-white">{editingItem?.client_name} - {editingItem?.sku}</h4>
              <p className="text-sm text-gray-500">
                Próxima Vigência: {editingItem?.next_validity_date ? format(new Date(editingItem.next_validity_date), 'dd/MM/yyyy') : '-'}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="obs" className="text-sm font-medium text-gray-900 dark:text-white">
                Observações
              </label>
              <textarea
                id="obs"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 text-gray-900 dark:text-white"
                placeholder="Adicione notas sobre este contrato..."
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleSaveObservation}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CS;
