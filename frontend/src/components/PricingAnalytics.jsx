import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, cn } from '@/lib/utils';
import { ArrowLeft, TrendingUp, DollarSign, Users, Package, BarChart3, Calendar, Filter, Search, Check, ChevronsUpDown, X, Scale } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
    
    if (clientParam) setSelectedClient(clientParam);
    if (skuParam) setSelectedSKU(skuParam);
  }, [searchParams]);

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
          clients!inner(name)
        `)
        .order('date', { ascending: true });

      if (dateRange.start) {
        query = query.gte('date', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('date', dateRange.end);
      }

      // Removidos filtros de cliente/SKU daqui para permitir filtragem dinâmica em memória
      
      const { data: pricingData } = await query;
      setPricingData(pricingData || []);

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

  // Filtrar dados localmente com base nas seleções
  const filteredPricingData = useMemo(() => {
    let data = pricingData || [];
    
    if (selectedClient) {
      data = data.filter(item => item.client_id === selectedClient);
    }

    if (selectedSKU) {
      data = data.filter(item => item.sku === selectedSKU);
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
  }, [pricingData, selectedClient, selectedSKU, selectedCategory, selectedSubcategory, selectedSize, datasulCode]);

  // Processar dados para gráficos
  const chartData = useMemo(() => {
    const safePricingData = filteredPricingData;
    
    // Evolução de preços e margem por dia
    const dailyData = {};
    safePricingData.forEach(item => {
      const date = item.date;
      if (!dailyData[date]) {
        dailyData[date] = { date, totalPrice: 0, totalMargin: 0, count: 0, prices: [] };
      }
      const netPrice = Number(item.net_price || 0);
      const margin = Number(item.margin_budget || 0);
      
      dailyData[date].totalPrice += netPrice;
      dailyData[date].totalMargin += margin;
      dailyData[date].count += 1;
      dailyData[date].prices.push(netPrice);
    });

    const evolutionData = Object.values(dailyData)
      .map(day => ({
        date: day.date,
        formattedDate: format(new Date(day.date), 'MMM/yy', { locale: ptBR }),
        avgPrice: day.count > 0 ? parseFloat((day.totalPrice / day.count).toFixed(2)) : 0,
        avgMargin: day.count > 0 ? parseFloat((day.totalMargin / day.count).toFixed(1)) : 0,
        totalPrice: parseFloat(day.totalPrice.toFixed(2)),
        count: day.count
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Distribuição por cliente
    const clientData = {};
    safePricingData.forEach(item => {
      const clientName = item.clients?.name || 'Desconhecido';
      if (!clientData[clientName]) {
        clientData[clientName] = { name: clientName, total: 0, count: 0, avgPrice: 0 };
      }
      clientData[clientName].total += Number(item.net_price || 0);
      clientData[clientName].count += 1;
    });

    Object.values(clientData).forEach(client => {
      client.avgPrice = client.count > 0 ? parseFloat((client.total / client.count).toFixed(2)) : 0;
    });

    const topClients = Object.values(clientData)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Performance por SKU
    const skuData = {};
    safePricingData.forEach(item => {
      if (!skuData[item.sku]) {
        skuData[item.sku] = { sku: item.sku, total: 0, count: 0, avgPrice: 0, avgMargin: 0, marginTotal: 0 };
      }
      skuData[item.sku].total += Number(item.net_price || 0);
      skuData[item.sku].count += 1;
      skuData[item.sku].marginTotal += Number(item.margin_budget || 0);
    });

    Object.values(skuData).forEach(sku => {
      sku.avgPrice = sku.count > 0 ? parseFloat((sku.total / sku.count).toFixed(2)) : 0;
      sku.avgMargin = sku.count > 0 ? parseFloat((sku.marginTotal / sku.count).toFixed(1)) : 0;
    });

    const topSKUs = Object.values(skuData)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Margem por período
    const marginData = Object.values(dailyData).map(day => ({
      date: format(new Date(day.date), 'MMM/yy', { locale: ptBR }),
      avgMargin: day.count > 0 ? parseFloat((day.prices.reduce((sum, price, i) => {
        const item = safePricingData.find(item => item.date === day.date && item.net_price === price);
        return sum + (item?.margin_budget || 0);
      }, 0) / day.count).toFixed(1)) : 0
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
      evolutionData,
      topClients,
      topSKUs,
      marginData,
      totalRevenue: safePricingData.reduce((sum, item) => sum + Number(item.net_price || 0), 0),
      totalRecords: safePricingData.length,
      lastPriceDate: safePricingData.length > 0 ? format(new Date(Math.max(...safePricingData.map(d => new Date(d.date)))), 'dd/MM/yyyy') : '-',
      avgPrice: safePricingData.length > 0 ? (safePricingData.reduce((sum, item) => sum + Number(item.net_price || 0), 0) / safePricingData.length).toFixed(2) : 0,
      avgMargin: safePricingData.length > 0 ? (safePricingData.reduce((sum, item) => sum + Number(item.margin_budget || 0), 0) / safePricingData.length).toFixed(1) : 0,
      currencySymbol,
      benchmarkData
    };
  }, [filteredPricingData, pricingData, selectedCategory, selectedClient, clients]);

  // Cores para gráficos
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" style={{ color: 'var(--color-primary)' }}></div>
          <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Carregando analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Botão Voltar */}
      <div className="bg-white border-b border-gray-200">
         <div className="max-w-[110rem] mx-auto px-6 py-2 flex justify-end">
            <button 
              onClick={() => navigate('/pricing/dashboard')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>
         </div>
      </div>

      {/* Header padronizado */}
      <header className="">
        <div className="max-w-[110rem] mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/logo-pronutrition-symbol.png" 
                alt="PRONUTRITION" 
                className="h-20"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                PN
              </div>
              <div>
                <h2 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Pricing Analytics
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Dashboard de Análises e Inteligência de Dados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.nome || user?.user_metadata?.nome} {user?.sobrenome || user?.user_metadata?.sobrenome}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {user?.area || user?.user_metadata?.area}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="bg-white rounded-lg p-6 shadow-sm mb-6 card-pronutrition hover-lift">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
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
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
              >
                <X size={14} />
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Código Datasul
              </label>
              <input
                type="text"
                value={datasulCode}
                onChange={(e) => {
                  setDatasulCode(e.target.value);
                  // Não limpa outros filtros
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Filtrar por código..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
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
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Data Inicial
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Data Final
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Data do último preço vigente</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {chartData.lastPriceDate}
                </p>
              </div>
              <Calendar className="text-blue-500" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Preço Médio</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {chartData.currencySymbol} {chartData.avgPrice}
                </p>
              </div>
              <TrendingUp className="text-yellow-500" size={32} />
            </div>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Margem Média</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {chartData.avgMargin}%
                </p>
              </div>
              <BarChart3 className="text-purple-500" size={32} />
            </div>
          </div>
        </div>

        {/* Benchmarking Interno Card */}
        {chartData.benchmarkData && (
          <div className="bg-white rounded-lg p-6 shadow-sm mb-8 card-pronutrition hover-lift">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Scale size={20} className="text-blue-600" />
              Benchmarking Interno de Margens
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Média da Categoria ({selectedCategory || 'Todas'})</p>
                <p className="text-2xl font-bold text-gray-800">{chartData.benchmarkData.categoryAvg.toFixed(1)}%</p>
              </div>
              
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Média {chartData.benchmarkData.clientName}</p>
                <p className="text-2xl font-bold text-gray-800">{chartData.benchmarkData.clientAvg.toFixed(1)}%</p>
              </div>

              <div className={`p-4 rounded-lg border ${chartData.benchmarkData.diff >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-sm mb-1 ${chartData.benchmarkData.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Diferencial Competitivo
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${chartData.benchmarkData.diff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {chartData.benchmarkData.diff > 0 ? '+' : ''}{chartData.benchmarkData.diff.toFixed(1)}%
                  </span>
                  <span className={`text-sm px-2 py-1 rounded-full ${chartData.benchmarkData.diff >= 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
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
          <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <TrendingUp size={20} />
              {selectedSKU ? `Evolução de Preço - ${selectedSKU}` : 'Evolução do Preço Médio'}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.evolutionData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="formattedDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    tickFormatter={(value) => `${chartData.currencySymbol} ${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${chartData.currencySymbol} ${Number(value).toFixed(2)}`, 'Preço']}
                    labelStyle={{ color: '#374151', marginBottom: '0.5rem' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="avgPrice" 
                    stroke="var(--color-primary)" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                    name="Preço"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Margem */}
          <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <BarChart3 size={20} />
              {selectedSKU ? `Evolução de Margem - ${selectedSKU}` : 'Evolução da Margem Média'}
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.evolutionData}>
                  <defs>
                    <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="formattedDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    dy={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#6B7280', fontSize: 12 }} 
                    tickFormatter={(value) => `${value}%`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Margem']}
                    labelStyle={{ color: '#374151', marginBottom: '0.5rem' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="avgMargin" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorMargin)" 
                    name="Margem"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
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