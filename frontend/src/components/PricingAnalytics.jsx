import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, cn } from '@/lib/utils';
import { ArrowLeft, TrendingUp, DollarSign, Users, Package, BarChart3, Calendar, Filter, Search, Check, ChevronsUpDown, X, Scale } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SearchableSelect from './SearchableSelect';
import Header from './Header';
import { filterChangedHistoryPoints } from '../utils/pricingUtils';

const PricingAnalytics = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [pricingData, setPricingData] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedSKU, setSelectedSKU] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [datasulCode, setDatasulCode] = useState('');
  
  // No longer needed
  // const [searchTerm, setSearchTerm] = useState('');
  // const [activeSearch, setActiveSearch] = useState('');

  const userArea = user?.area || user?.user_metadata?.area;
  const isSuper = userArea === 'Pricing';
  const canEdit = isSuper || userArea === 'Pricing';

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const skuParam = searchParams.get('sku');
    const clientParam = searchParams.get('client');
    const codeParam = searchParams.get('code');
    
    if (clientParam) setSelectedClient(clientParam);
    if (skuParam) setSelectedSKU(skuParam);
    if (codeParam) setDatasulCode(codeParam);
  }, [searchParams]);

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('pricing_analytics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_history'
        },
        (payload) => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange]); // Only reload when date range changes

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      setClients(clientsData || []);

      // Carregar dados de pricing sem filtros de cliente/SKU (filtragem em memória)
      let query = supabase
        .from('pricing_history')
        .select(`
          *,
          clients(name)
        `)
        .order('date', { ascending: true });

      if (dateRange.start) {
        query = query.gte('date', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('date', dateRange.end);
      }

      // Removidos filtros de cliente/SKU daqui para permitir filtragem dinâmica em memória
      
      const { data: pricingDataRaw, error: pricingError } = await query;
      if (pricingError) throw pricingError;
      
      // Aplicar lógica de normalização de categorias (mesma do Dashboard)
      const enrichedData = (pricingDataRaw || []).map(item => {
        let category = item.category;
        let subcategory = item.subcategory;
        
        const validCategories = ['Pó', 'Cápsula', 'Gel', 'Pastilha'];
        if (!validCategories.includes(category)) {
          const checkStr = String(subcategory || category || '').toLowerCase();
          
          if (checkStr.includes('creatina') || checkStr.includes('colágeno') || checkStr.includes('glutamina') || checkStr.includes('proteína') || checkStr.includes('whey') || checkStr.includes('pre-workout')) {
             category = 'Pó';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('gel')) {
             category = 'Gel';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('cápsula') || checkStr.includes('capsula') || checkStr.includes('softgel')) {
             category = 'Cápsula';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('pastilha') || checkStr.includes('gummy')) {
             category = 'Pastilha';
             if (!subcategory && item.category) subcategory = item.category;
          }
        }
        return { ...item, category, subcategory };
      });

      setPricingData(enrichedData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Opções para os selects
  const clientOptions = useMemo(() => {
    return clients.map(c => ({ label: c.name, value: c.id }));
  }, [clients]);

  const skuOptions = useMemo(() => {
    // Filtrar dados baseados no cliente selecionado, se houver
    let data = pricingData;
    if (selectedClient) {
      data = data.filter(item => item.client_id === selectedClient);
    }
    if (selectedCategory) {
      data = data.filter(item => item.category === selectedCategory);
    }
    if (selectedSubcategory) {
      data = data.filter(item => item.subcategory === selectedSubcategory);
    }
    if (selectedSize) {
      data = data.filter(item => item.size === selectedSize);
    }
    // Extrair SKUs únicos dos dados filtrados
    const uniqueSKUs = [...new Set(data.map(item => item.sku))].sort();
    return uniqueSKUs.map(sku => ({ label: sku, value: sku }));
  }, [pricingData, selectedClient, selectedCategory, selectedSubcategory, selectedSize]);

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(pricingData.map(item => item.category).filter(Boolean))].sort();
    return categories.map(c => ({ label: c, value: c }));
  }, [pricingData]);

  const subcategoryOptions = useMemo(() => {
    let data = pricingData;
    if (selectedCategory) {
      data = data.filter(item => item.category === selectedCategory);
    }
    const subcategories = [...new Set(data.map(item => item.subcategory).filter(Boolean))].sort();
    return subcategories.map(s => ({ label: s, value: s }));
  }, [pricingData, selectedCategory]);

  const sizeOptions = useMemo(() => {
    const sizes = [...new Set(pricingData.map(item => item.size).filter(Boolean))].sort();
    return sizes.map(s => ({ label: s, value: s }));
  }, [pricingData]);

  const codesFromSelectedSKU = useMemo(() => {
    if (!selectedSKU) return [];
    const matches = (pricingData || []).filter(item => {
      if (item.sku !== selectedSKU) return false;
      if (!item.code) return false;
      if (selectedClient && item.client_id !== selectedClient) return false;
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedSubcategory && item.subcategory !== selectedSubcategory) return false;
      if (selectedSize && item.size !== selectedSize) return false;
      return true;
    });

    return [...new Set(matches.map(m => m.code))];
  }, [pricingData, selectedClient, selectedSKU, selectedCategory, selectedSubcategory, selectedSize]);

  // Filtrar dados localmente com base nas seleções
  const filteredPricingData = useMemo(() => {
    let data = pricingData || [];
    
    if (selectedClient) {
      data = data.filter(item => item.client_id === selectedClient);
    }

    if (selectedSKU) {
      if (codesFromSelectedSKU.length > 0) {
        data = data.filter(item => item.code && codesFromSelectedSKU.includes(item.code));
      } else {
        data = data.filter(item => item.sku === selectedSKU);
      }
    }

    if (selectedCategory) {
      data = data.filter(item => item.category === selectedCategory);
    }

    if (selectedSubcategory) {
      data = data.filter(item => item.subcategory === selectedSubcategory);
    }

    if (selectedSize) {
      data = data.filter(item => item.size === selectedSize);
    }

    if (datasulCode) {
      data = data.filter(item => item.code && item.code.includes(datasulCode));
    }
    
    return data;
  }, [pricingData, selectedClient, selectedSKU, selectedCategory, selectedSubcategory, selectedSize, datasulCode, codesFromSelectedSKU]);

  const parseMonthLabelToDate = (monthLabel) => {
    if (!monthLabel || typeof monthLabel !== 'string') return null;
    const normalized = monthLabel.trim().toLowerCase();
    const [rawMonth, rawYear] = normalized.split('/');
    if (!rawMonth || !rawYear) return null;

    const monthMap = {
      jan: 0,
      fev: 1,
      mar: 2,
      abr: 3,
      mai: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      set: 8,
      sep: 8,
      out: 9,
      nov: 10,
      dez: 11
    };

    const monthIndex = monthMap[rawMonth.slice(0, 3)];
    if (monthIndex === undefined) return null;

    const parsedYear = Number(rawYear);
    if (Number.isNaN(parsedYear)) return null;

    const year = rawYear.length === 2 ? 2000 + parsedYear : parsedYear;
    return new Date(year, monthIndex, 1);
  };

  // Processar dados para gráficos
  const chartData = useMemo(() => {
    const safePricingData = filteredPricingData;
    
    // Evolução de preços e margem por mês (coluna "month"/"Mês")
    const monthlyData = {};
    safePricingData.forEach(item => {
      const monthLabel = (item.month && String(item.month).trim())
        || (item.date ? format(new Date(`${item.date}T12:00:00`), 'MMM/yy', { locale: ptBR }) : '');

      if (!monthLabel) return;

      if (!monthlyData[monthLabel]) {
        monthlyData[monthLabel] = {
          month: monthLabel,
          totalPrice: 0,
          totalGrossPrice: 0,
          totalMargin: 0,
          count: 0,
          sortDate: null
        };
      }

      const netPrice = Number(item.net_price || 0);
      const grossPrice = Number(item.gross_price || 0);
      const margin = Number(item.margin_budget || 0);
      
      monthlyData[monthLabel].totalPrice += netPrice;
      monthlyData[monthLabel].totalGrossPrice += grossPrice;
      monthlyData[monthLabel].totalMargin += margin;
      monthlyData[monthLabel].count += 1;

      const monthSortDate = item.date
        ? new Date(`${item.date}T12:00:00`)
        : parseMonthLabelToDate(monthLabel);

      if (
        monthSortDate instanceof Date
        && !Number.isNaN(monthSortDate.getTime())
        && (!monthlyData[monthLabel].sortDate || monthSortDate < monthlyData[monthLabel].sortDate)
      ) {
        monthlyData[monthLabel].sortDate = monthSortDate;
      }
    });

    const evolutionData = Object.values(monthlyData)
      .map(monthItem => ({
        month: monthItem.month,
        avgPrice: monthItem.count > 0 ? parseFloat((monthItem.totalGrossPrice / monthItem.count).toFixed(2)) : 0,
        avgMargin: monthItem.count > 0 ? parseFloat((monthItem.totalMargin / monthItem.count).toFixed(1)) : 0,
        totalPrice: parseFloat(monthItem.totalPrice.toFixed(2)),
        count: monthItem.count,
        sortDate: monthItem.sortDate || parseMonthLabelToDate(monthItem.month)
      }))
      .sort((a, b) => {
        const aTime = a.sortDate instanceof Date && !Number.isNaN(a.sortDate.getTime()) ? a.sortDate.getTime() : 0;
        const bTime = b.sortDate instanceof Date && !Number.isNaN(b.sortDate.getTime()) ? b.sortDate.getTime() : 0;
        return aTime - bTime;
      });
    const filteredEvolutionData = filterChangedHistoryPoints(evolutionData, {
      dateField: 'sortDate',
      priceField: 'avgPrice',
      marginField: 'avgMargin'
    });

    // Distribuição por cliente
    const clientData = {};
    safePricingData.forEach(item => {
      const clientName = item.clients?.name || 'Desconhecido';
      if (!clientData[clientName]) {
        clientData[clientName] = { name: clientName, total: 0, totalGross: 0, count: 0, avgPrice: 0 };
      }
      clientData[clientName].total += Number(item.net_price || 0);
      clientData[clientName].totalGross += Number(item.gross_price || 0);
      clientData[clientName].count += 1;
    });

    Object.values(clientData).forEach(client => {
      client.avgPrice = client.count > 0 ? parseFloat((client.totalGross / client.count).toFixed(2)) : 0;
    });

    const topClients = Object.values(clientData)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Performance por SKU
    const skuData = {};
    safePricingData.forEach(item => {
      if (!skuData[item.sku]) {
        skuData[item.sku] = { sku: item.sku, total: 0, totalGross: 0, count: 0, avgPrice: 0, avgMargin: 0, marginTotal: 0 };
      }
      skuData[item.sku].total += Number(item.net_price || 0);
      skuData[item.sku].totalGross += Number(item.gross_price || 0);
      skuData[item.sku].count += 1;
      skuData[item.sku].marginTotal += Number(item.margin_budget || 0);
    });

    Object.values(skuData).forEach(sku => {
      sku.avgPrice = sku.count > 0 ? parseFloat((sku.totalGross / sku.count).toFixed(2)) : 0;
      sku.avgMargin = sku.count > 0 ? parseFloat((sku.marginTotal / sku.count).toFixed(1)) : 0;
    });

    const topSKUs = Object.values(skuData)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Margem por período
    const marginData = filteredEvolutionData.map(monthItem => ({
      date: monthItem.month,
      avgMargin: monthItem.avgMargin
    }));

    // Determinar moeda principal (baseada na maioria ou no primeiro item)
    // Se houver mix, idealmente deveria separar, mas para o card de média geral, vamos assumir a do primeiro item filtrado ou padrão
    const currentCurrency = safePricingData.length > 0 ? safePricingData[0].currency : 'BRL';
    const currencySymbol = currentCurrency === 'USD' ? '$' : 'R$';

    // Benchmarking Interno
    let benchmarkData = null;
    if (selectedCategory) {
      // 1. Média Geral da Categoria (Market Average)
      const categoryItems = pricingData.filter(item => item.category === selectedCategory);
      const categoryAvgMargin = categoryItems.length > 0 
        ? categoryItems.reduce((sum, item) => sum + (Number(item.margin_budget) || 0), 0) / categoryItems.length 
        : 0;

      // 2. Média do Cliente Selecionado na Categoria (Client Average)
      let clientAvgMargin = 0;
      let clientName = 'Cliente';
      
      if (selectedClient) {
        const clientItems = categoryItems.filter(item => item.client_id === selectedClient);
        clientAvgMargin = clientItems.length > 0
          ? clientItems.reduce((sum, item) => sum + (Number(item.margin_budget) || 0), 0) / clientItems.length
          : 0;
        clientName = clients.find(c => c.id === selectedClient)?.name || 'Cliente';
      } else {
        // Se não tiver cliente selecionado, usa a média filtrada atual (que pode ser de um subconjunto ou tudo)
        clientAvgMargin = safePricingData.length > 0
          ? safePricingData.reduce((sum, item) => sum + (Number(item.margin_budget) || 0), 0) / safePricingData.length
          : 0;
        clientName = 'Seleção Atual';
      }

      benchmarkData = {
        categoryAvg: categoryAvgMargin,
        clientAvg: clientAvgMargin,
        diff: clientAvgMargin - categoryAvgMargin,
        clientName
      };
    }

    return {
      evolutionData: filteredEvolutionData,
      topClients,
      topSKUs,
      marginData,
      totalRevenue: safePricingData.reduce((sum, item) => sum + Number(item.net_price || 0), 0),
      totalRecords: safePricingData.length,
      // Use pricingData (unfiltered by local filters) for global counts within the loaded date range
      totalSKUs: new Set(pricingData.map(item => item.code).filter(Boolean)).size,
      totalClients: new Set(pricingData.map(item => item.client_id)).size,
      lastPriceDate: filteredEvolutionData.length > 0 ? filteredEvolutionData[filteredEvolutionData.length - 1].month : '-',
      avgPrice: safePricingData.length > 0 ? (safePricingData.reduce((sum, item) => sum + Number(item.gross_price || 0), 0) / safePricingData.length).toFixed(2) : 0,
      avgMargin: safePricingData.length > 0 ? (safePricingData.reduce((sum, item) => sum + Number(item.margin_budget || 0), 0) / safePricingData.length).toFixed(1) : 0,
      currencySymbol,
      benchmarkData,
      skuFromCode: datasulCode ? (safePricingData.find(item => item.code && item.code.includes(datasulCode))?.sku || '-') : null
    };
  }, [filteredPricingData, pricingData, selectedCategory, selectedClient, clients, datasulCode]);

  // Cores para gráficos
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const showPointAnnotations = Boolean(selectedSKU);

  const createPointLabelRenderer = (formatValue) => {
    return ({ x, y, value, index }) => {
      if (!showPointAnnotations) return null;
      if (!Array.isArray(chartData?.evolutionData) || chartData.evolutionData.length === 0) return null;
      if (value === null || value === undefined) return null;
      if (typeof x !== 'number' || typeof y !== 'number') return null;

      const total = chartData.evolutionData.length;
      let dx = 0;
      let textAnchor = 'middle';
      if (index === 0) {
        dx = 10;
        textAnchor = 'start';
      } else if (index === total - 1) {
        dx = -10;
        textAnchor = 'end';
      }

      const labelY = Math.max(12, y - 10);

      return (
        <text
          x={x + dx}
          y={labelY}
          fill="#9CA3AF"
          fontSize={10}
          fontWeight={500}
          textAnchor={textAnchor}
        >
          {formatValue(value)}
        </text>
      );
    };
  };

  const renderPricePointLabel = useMemo(
    () => createPointLabelRenderer((v) => `${chartData.currencySymbol} ${Number(v).toFixed(2)}`),
    [chartData, showPointAnnotations]
  );

  const renderMarginPointLabel = useMemo(
    () => createPointLabelRenderer((v) => `${Number(v).toFixed(1)}%`),
    [chartData, showPointAnnotations]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#171717] transition-colors duration-200">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-primary dark:text-primary"></div>
          <p className="mt-4 text-gray-500 dark:text-gray-400">Carregando analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717] transition-colors duration-200">
      <Header 
        user={user} 
        title="Pricing Analytics" 
        subtitle="Dashboard de Análises e Inteligência de Dados" 
        showBack={true} 
        backPath="/pricing/dashboard"
      />

      {/* Filtros */}
      <div className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm mb-6 card-pronutrition hover-lift transition-colors duration-200">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <Filter size={20} />
              Filtros de Análise
            </h3>
            {(selectedClient || selectedSKU || selectedCategory || selectedSubcategory || selectedSize || datasulCode || dateRange.start || dateRange.end) && (
              <button
                onClick={() => {
                  setSelectedClient('');
                  setSelectedSKU('');
                  setSelectedCategory('');
                  setSelectedSubcategory('');
                  setSelectedSize('');
                  setDatasulCode('');
                  setDateRange({ start: '', end: '' });
                }}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-full transition-colors"
              >
                <X size={14} />
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                SKU
              </label>
              <SearchableSelect
                options={skuOptions}
                value={selectedSKU}
                onChange={(value) => {
                  setSelectedSKU(value);
                  // Não limpa outros filtros ao selecionar SKU
                }}
                placeholder="Todos os SKUs"
                searchPlaceholder="Buscar SKU..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Cliente
              </label>
              <SearchableSelect
                options={clientOptions}
                value={selectedClient}
                onChange={(value) => {
                  setSelectedClient(value);
                  setSelectedSKU(''); // Limpa SKU ao mudar cliente
                }}
                placeholder="Todos os Clientes"
                searchPlaceholder="Buscar cliente..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Código Datasul
              </label>
              <input
                type="text"
                value={datasulCode}
                onChange={(e) => {
                  setDatasulCode(e.target.value);
                  // Não limpa outros filtros
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Filtrar por código..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Categoria
              </label>
              <SearchableSelect
                options={categoryOptions}
                value={selectedCategory}
                onChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedSubcategory(''); // Limpa subcategoria ao mudar categoria
                }}
                placeholder="Todas"
                searchPlaceholder="Buscar..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Subcategoria
              </label>
              <SearchableSelect
                options={subcategoryOptions}
                value={selectedSubcategory}
                onChange={(value) => {
                  setSelectedSubcategory(value);
                  // Não limpa outros filtros
                }}
                placeholder="Todas"
                searchPlaceholder="Buscar..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Tamanho
              </label>
              <SearchableSelect
                options={sizeOptions}
                value={selectedSize}
                onChange={(value) => {
                  setSelectedSize(value);
                  // Não limpa outros filtros
                }}
                placeholder="Todos"
                searchPlaceholder="Buscar..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Data Inicial
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Data Final
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8`}>
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-4 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <Calendar className="text-blue-500 mb-1" size={38} />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-0.5">Data do último preço vigente</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chartData.lastPriceDate}
                </p>
              </div>
            </div>
          </div>

          {datasulCode && (
            <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-4 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
              <div className="flex flex-col items-center justify-center text-center gap-2">
                <Package className="text-indigo-500 mb-1" size={38} />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-0.5">SKU</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {chartData.skuFromCode}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-4 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <TrendingUp className="text-yellow-500 mb-1" size={38} />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-0.5">Preço Médio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chartData.currencySymbol} {chartData.avgPrice}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-4 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <BarChart3 className="text-purple-500 mb-1" size={38} />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-0.5">Margem Média</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {chartData.avgMargin}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benchmarking Interno Card */}
        {chartData.benchmarkData && (
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm mb-8 card-pronutrition hover-lift transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Scale size={20} className="text-blue-600" />
              Benchmarking Interno de Margens
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Média da Categoria ({selectedCategory || 'Todas'})</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{chartData.benchmarkData.categoryAvg.toFixed(1)}%</p>
              </div>
              
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Média {chartData.benchmarkData.clientName}</p>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{chartData.benchmarkData.clientAvg.toFixed(1)}%</p>
              </div>

              <div className={`p-4 rounded-lg border ${chartData.benchmarkData.diff >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900'}`}>
                <p className={`text-sm mb-1 ${chartData.benchmarkData.diff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  Diferencial Competitivo
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${chartData.benchmarkData.diff >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {chartData.benchmarkData.diff > 0 ? '+' : ''}{chartData.benchmarkData.diff.toFixed(1)}%
                  </span>
                  <span className={`text-sm px-2 py-1 rounded-full ${chartData.benchmarkData.diff >= 0 ? 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200' : 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}>
                    {chartData.benchmarkData.diff >= 0 ? 'Acima da Média' : 'Abaixo da Média'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gráficos de Evolução */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Gráfico de Preço */}
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <TrendingUp size={20} />
              {selectedSKU ? `Evolução de Preço - ${selectedSKU}` : 'Evolução do Preço Médio'}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.evolutionData} margin={{ top: 24, right: 44, left: 36, bottom: 16 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="shadowPrice" height="200%">
                      <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="var(--color-primary)" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} strokeOpacity={0} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                    dy={10}
                    interval="preserveStartEnd"
                    padding={{ left: 10, right: 18 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                    tickFormatter={(value) => `${chartData.currencySymbol} ${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderRadius: '8px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                    formatter={(value) => [`${chartData.currencySymbol} ${Number(value).toFixed(2)}`, 'Preço']}
                    labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="avgPrice" 
                    stroke="var(--color-primary)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                    filter="url(#shadowPrice)"
                    name="Preço"
                    dot={showPointAnnotations ? { r: 3, strokeWidth: 2, stroke: 'var(--color-primary)', fill: 'var(--color-bg-card)' } : false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  >
                    {showPointAnnotations && (
                      <LabelList
                        dataKey="avgPrice"
                        content={renderPricePointLabel}
                      />
                    )}
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Margem */}
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <BarChart3 size={20} />
              {selectedSKU ? `Evolução de Margem - ${selectedSKU}` : 'Evolução da Margem Média'}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.evolutionData} margin={{ top: 24, right: 44, left: 36, bottom: 16 }}>
                  <defs>
                    <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="shadowMargin" height="200%">
                      <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#10B981" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={false} strokeOpacity={0} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                    dy={10}
                    interval="preserveStartEnd"
                    padding={{ left: 10, right: 18 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                    tickFormatter={(value) => `${value}%`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderRadius: '8px', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margem']}
                    labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="avgMargin" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorMargin)" 
                    filter="url(#shadowMargin)"
                    name="Margem"
                    dot={showPointAnnotations ? { r: 3, strokeWidth: 2, stroke: '#10B981', fill: 'var(--color-bg-card)' } : false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  >
                    {showPointAnnotations && (
                      <LabelList
                        dataKey="avgMargin"
                        content={renderMarginPointLabel}
                      />
                    )}
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>



      </div>
    </div>
  );
};

export default PricingAnalytics;
