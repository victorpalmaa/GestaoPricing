import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Download, Upload, TrendingUp, DollarSign, Users, Package, Settings, BarChart3, LogOut, ArrowLeft, Edit2, Trash2, Briefcase, Filter, Search, Check, ChevronsUpDown, X, Clock, ShieldCheck, AlertCircle, Tag } from 'lucide-react';
import * as XLSX from 'xlsx';
import ClientAliasManager from './ClientAliasManager';
import Header from './Header';
import { toast } from 'sonner';
import { logExport } from '@/utils/activityLog';
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { calculateGate, WORKFLOW_STATUS_OPTIONS } from '../utils/pricingUtils';
import { useRoutePermissions } from '@/lib/permissions';
import {
  lerArquivoPonta,
  prepararLote,
} from '../services/retailPriceImport';
import {
  resumirLote,
  chaveCodigo,
  chaveAlias,
  normalizarNomeSite,
  VINCULO_STATUS,
} from '../utils/retailMatching';
import {
  calculateMarkup,
  formatMarkup,
  MARKUP_STATUS,
  resolveMarkupTier,
} from '../utils/markup';

const TIER_PALETTE = {
  alto:  { fg: '#32AB10', bg: 'rgba(50,171,16,0.12)',  border: 'rgba(50,171,16,0.45)',  bar: '#32AB10' },
  medio: { fg: '#35BCFF', bg: 'rgba(53,188,255,0.12)', border: 'rgba(53,188,255,0.45)', bar: '#35BCFF' },
  baixo: { fg: '#845AFA', bg: 'rgba(132,90,250,0.12)', border: 'rgba(132,90,250,0.45)', bar: '#845AFA' },
};

const COR_ROXO_PONTA = '#845AFA';
const COR_VERDE_PRO = '#32AB10';
const COR_ROXO_COMPLEMENTAR_BOTAO = '#974F98';

const getTierColor = (tier) => TIER_PALETTE[tier] || TIER_PALETTE.medio;

const PricingDashboard = ({ user }) => {
  const { canWrite } = useRoutePermissions('/pricing/dashboard');
  const navigate = useNavigate();
  const [pricingData, setPricingData] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientAliases, setClientAliases] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    client: '',
    sku: '',
    category: '',
    subcategory: '',
    size: '',
    dateFrom: '',
    dateTo: '',
    datasulCode: ''
  });
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);
  const [basePriceId, setBasePriceId] = useState('');

  // Prepare options for base price selection
  const basePriceOptions = useMemo(() => {
    return pricingData.map(p => ({
      value: p.id,
      label: `${p.sku} - ${p.clients?.name || 'Sem cliente'} - ${p.month || '-'} - ${p.currency === 'USD' ? '$' : 'R$'} ${(parsePriceNumber(p.net_price) ?? 0).toFixed(2)}`
    }));
  }, [pricingData]);

  const handleBasePriceChange = (value) => {
    setBasePriceId(value);
    const selectedPrice = pricingData.find(p => p.id === value);
    if (selectedPrice) {
      setNewPriceForm(prev => ({
        ...prev,
        client_id: selectedPrice.client_id,
        sku: selectedPrice.sku,
        net_price: selectedPrice.net_price,
        gross_price: selectedPrice.gross_price || '',
        margin_budget: selectedPrice.margin_budget || '',
        size: selectedPrice.size || '',
        manager: selectedPrice.manager || '',
        code: selectedPrice.code || '',
        category: selectedPrice.category || '',
        subcategory: selectedPrice.subcategory || '',
        month: selectedPrice.date ? selectedPrice.date.split('T')[0] : '', // Use date for month input to ensure it's populated
        date: new Date().toISOString().split('T')[0], // Keep current date for new entry
        obs: selectedPrice.obs || '',
        currency: selectedPrice.currency || 'BRL'
      }));
    }
  };
  const [showImportModal, setShowImportModal] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [newPriceForm, setNewPriceForm] = useState({
    client_id: '',
    sku: '',
    net_price: '',
    gross_price: '',
    margin_budget: '',
    size: '',
    manager: '',
    code: '',
    category: '',
    subcategory: '',
    month: '',
    date: new Date().toISOString().split('T')[0],
    obs: '',
    currency: 'BRL'
  });
  const [showAliasManager, setShowAliasManager] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [retailConferenciaAtiva, setRetailConferenciaAtiva] = useState(false);
  const [retailLinhasPreparadas, setRetailLinhasPreparadas] = useState([]);
  const [retailResumo, setRetailResumo] = useState(null);
  const [retailErrosEstruturais, setRetailErrosEstruturais] = useState([]);
  const [retailCodigosManuais, setRetailCodigosManuais] = useState({});
  const [retailCommitando, setRetailCommitando] = useState(false);
  const [retailConflitos, setRetailConflitos] = useState([]);
  const [retailVerificandoConflitos, setRetailVerificandoConflitos] = useState(false);
  const [retailSkuAliases, setRetailSkuAliases] = useState([]);
  const [retailArquivoNome, setRetailArquivoNome] = useState(null);
  const [retailPrecosPorSku, setRetailPrecosPorSku] = useState(new Map());

  const CATEGORY_OPTIONS = ['Pó', 'Gel', 'Pastilha', 'Cápsula', 'Goma', 'Softgel'];
  const SUBCATEGORY_OPTIONS = ['Goma', 'Cápsula', 'Colágeno', 'Creatina', 'Gel', 'Glutamina', 'Outros', 'Pastilha', 'Proteína'];

  const isSuper = canWrite;
  const canEdit = canWrite;

  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const [retailDetailOpen, setRetailDetailOpen] = useState(false);
  const [retailDetailSkuId, setRetailDetailSkuId] = useState(null);

  const fecharRetailDetail = useCallback(() => {
    setRetailDetailOpen(false);
    setRetailDetailSkuId(null);
  }, []);

  useEffect(() => {
    if (!retailDetailOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        fecharRetailDetail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [retailDetailOpen, fecharRetailDetail]);

  const abrirRetailDetailSeOk = (item) => {
    const info = markupPorLinha.get(item.id);
    if (!info || !info.resultado || info.resultado.status !== MARKUP_STATUS.OK) return;
    setRetailDetailSkuId(item.id);
    setRetailDetailOpen(true);
  };

  const formatCurrencyLocal = (valor, currency) => {
    try {
      const c = currency && String(currency).trim().toUpperCase() === 'USD' ? 'USD' : 'BRL';
      const locale = c === 'USD' ? 'en-US' : 'pt-BR';
      return Number(valor).toLocaleString(locale, {
        style: 'currency',
        currency: c,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return `R$ ${Number(valor).toFixed(2)}`;
    }
  };

  const parsePricingDate = (value) => {
    if (!value) return null;
    const raw = value instanceof Date ? value.toISOString() : value.toString();
    const parsed = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  function parsePriceNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isNaN(value) ? null : value;
    if (typeof value !== 'string') return null;
    if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
      const direct = Number(value.trim());
      return Number.isNaN(direct) ? null : direct;
    }
    let normalized = value.replace(/[R$\s]/g, '').trim();
    if (!normalized) return null;
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const getGroupKey = (clientId, code) => `${clientId}::${(code || '').toString().trim()}`;

  const comparePricingRows = (a, b) => {
    if (Boolean(a.is_current) !== Boolean(b.is_current)) {
      return Boolean(b.is_current) - Boolean(a.is_current);
    }
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

  const setCurrentPriceForSku = async ({ clientId, code, currentId }) => {
    const { error: clearError } = await supabase
      .from('pricing_history')
      .update({ is_current: false })
      .eq('client_id', clientId)
      .eq('code', code)
      .neq('id', currentId);

    if (clearError) throw clearError;

    const { error: setError } = await supabase
      .from('pricing_history')
      .update({ is_current: true })
      .eq('id', currentId);

    if (setError) throw setError;
  };

  const safePricingData = pricingData || [];
  const safeClients = clients || [];

  // Opções para os selects
  const clientOptions = useMemo(() => {
    return safeClients.map(c => ({ 
      label: c.name, 
      value: c.id,
      keywords: clientAliases[c.id] || ''
    }));
  }, [safeClients, clientAliases]);

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(safePricingData.map(item => item.category).filter(Boolean))].sort();
    return categories.map(c => ({ label: c, value: c }));
  }, [safePricingData]);

  const subcategoryOptions = useMemo(() => {
    let data = safePricingData;
    if (filters.category) {
      data = data.filter(item => item.category === filters.category);
    }
    const subcategories = [...new Set(data.map(item => item.subcategory).filter(Boolean))].sort();
    return subcategories.map(s => ({ label: s, value: s }));
  }, [safePricingData, filters.category]);

  // Sidebar Fix (Sticky Header) - Implemented via CSS in Header or Table
  // Ensuring the table header is sticky

  
  const sizeOptions = useMemo(() => {
    const sizes = [...new Set(safePricingData.map(item => item.size).filter(Boolean))].sort();
    return sizes.map(s => ({ label: s, value: s }));
  }, [safePricingData]);

  const skuOptions = useMemo(() => {
    // Filtrar dados baseados no cliente selecionado, se houver
    let data = safePricingData;
    if (filters.client) {
      data = data.filter(item => item.client_id === filters.client);
    }
    if (filters.category) {
      data = data.filter(item => item.category === filters.category);
    }
    if (filters.subcategory) {
      data = data.filter(item => item.subcategory === filters.subcategory);
    }
    if (filters.size) {
      data = data.filter(item => item.size === filters.size);
    }
    // Extrair SKUs únicos dos dados filtrados
    const uniqueSKUs = [...new Set(data.map(item => item.sku))].sort();
    return uniqueSKUs.map(sku => ({ label: sku, value: sku }));
  }, [safePricingData, filters.client, filters.category, filters.subcategory, filters.size]);

  const codesFromSelectedSKU = useMemo(() => {
    if (!filters.sku) return [];
    const matches = (safePricingData || []).filter(item => {
      if (item.sku !== filters.sku) return false;
      if (!item.code) return false;
      if (filters.client && item.client_id !== filters.client) return false;
      return true;
    });
    return [...new Set(matches.map(item => item.code))];
  }, [safePricingData, filters.sku, filters.client]);

  useEffect(() => {
    loadData();
  }, [filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    const channel = supabase
      .channel('pricing_dashboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pricing_history'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!retailConferenciaAtiva) return;
    if (!linhasAposCorrecaoManual || linhasAposCorrecaoManual.length === 0) {
      setRetailConflitos([]);
      return;
    }
    let cancelado = false;
    const run = async () => {
      const { precoRows } = montarPrecoRows();
      if (cancelado) return;
      if (precoRows.length === 0) {
        setRetailConflitos([]);
        return;
      }
      await verificarConflitosRetail(precoRows);
    };
    run();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailConferenciaAtiva, retailLinhasPreparadas, retailCodigosManuais]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Carregar aliases para busca
      const { data: aliasesData } = await supabase
        .from('client_aliases')
        .select('client_id, alias_name');

      const aliasMap = {};
      if (aliasesData) {
        aliasesData.forEach(a => {
          if (!aliasMap[a.client_id]) {
            aliasMap[a.client_id] = [];
          }
          aliasMap[a.client_id].push(a.alias_name);
        });
      }
      
      // Converter para string para busca
      const aliasStringMap = {};
      Object.keys(aliasMap).forEach(key => {
        aliasStringMap[key] = aliasMap[key].join(' ');
      });
      
      setClientAliases(aliasStringMap);

      // Carregar aliases de SKU de ponta (usados na importação de preços de ponta)
      try {
        const { data: retailAliasesData } = await supabase
          .from('retail_sku_aliases')
          .select('client_id, nome_site, datasul_code');
        setRetailSkuAliases(retailAliasesData || []);
      } catch (e) {
        // Pode falhar se a migration ainda não rodou; deixar array vazio.
        setRetailSkuAliases([]);
      }

      // Carregar histórico de preços com joins e filtro de data
      let query = supabase
        .from('pricing_history')
        .select(`
          id,
          client_id,
          sku,
          date,
          currency,
          created_at,
          is_current,
          size,
          manager,
          code,
          net_price,
          gross_price,
          margin_budget,
          month,
          category,
          subcategory,
          obs,
          readjustment_status,
          last_price_date,
          gate,
          clients!inner(name)
        `)
        .order('date', { ascending: false });

      // Aplicar filtros de data no servidor
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      const { data: pricingDataRaw, error: pricingError } = await query;

      if (pricingError) throw pricingError;

      const groupedRows = new Map();
      (pricingDataRaw || []).forEach(item => {
        const key = getGroupKey(item.client_id, item.code);
        if (!groupedRows.has(key)) {
          groupedRows.set(key, []);
        }
        groupedRows.get(key).push(item);
      });

      const currentIdMap = new Map();
      groupedRows.forEach((rows, key) => {
        const flaggedCurrent = rows.find(row => row.is_current);
        if (flaggedCurrent?.id) {
          currentIdMap.set(key, flaggedCurrent.id);
          return;
        }
        const sortedRows = [...rows].sort(comparePricingRows);
        if (sortedRows[0]?.id) {
          currentIdMap.set(key, sortedRows[0].id);
        }
      });

      const enrichedData = (pricingDataRaw || []).map(item => {
        // Derivar Categoria e Subcategoria corretamente
        let category = item.category;
        let subcategory = item.subcategory;
        const normalizedNetPrice = parsePriceNumber(item.net_price);
        const normalizedGrossPrice = parsePriceNumber(item.gross_price);
        
        // Garantir que o mês esteja preenchido para visualização
        let month = item.month;
        if (!month && item.date) {
          try {
             // Ajuste de fuso horário simples para visualização correta do mês
             const dateObj = new Date(item.date);
             // Adicionar offset de fuso se necessário ou usar UTC
             const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
             const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
             month = format(dateObj, 'MMM/yy', { locale: ptBR });
          } catch (e) {
             console.error('Erro ao formatar data para mês:', e);
          }
        }
        
        // Se a categoria não for uma das padrão, tentar derivar
        const validCategories = ['Pó', 'Gel', 'Goma', 'Cápsula', 'Pastilha', 'Softgel'];
        if (!validCategories.includes(category)) {
          const checkStr = (subcategory || category || '').toLowerCase();
          
          if (checkStr.includes('creatina') || checkStr.includes('colágeno') || checkStr.includes('glutamina') || checkStr.includes('proteína') || checkStr.includes('whey') || checkStr.includes('pre-workout')) {
             category = 'Pó';
             // Se subcategoria estava vazia, usa o valor que estava em categoria
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('softgel')) {
             category = 'Softgel';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('gel')) {
             category = 'Gel';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('cápsula') || checkStr.includes('capsula')) {
             category = 'Cápsula';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('goma') || checkStr.includes('gummy')) {
             category = 'Goma';
             if (!subcategory && item.category) subcategory = item.category;
          } else if (checkStr.includes('pastilha')) {
             category = 'Pastilha';
             if (!subcategory && item.category) subcategory = item.category;
          }
        }

        return {
          ...item,
          db_net_price: item.net_price,
          db_gross_price: item.gross_price,
          net_price: normalizedNetPrice,
          gross_price: normalizedGrossPrice,
          category,
          subcategory,
          month,
          isCurrent: item.id === currentIdMap.get(getGroupKey(item.client_id, item.code))
        };
      });

      setPricingData(enrichedData);

      try {
        const { data: retailPrecos, error: retailPrecosError } = await supabase
          .from('client_retail_prices')
          .select('client_id, datasul_code, retail_price, currency, collected_at')
          .order('collected_at', { ascending: false });
        if (retailPrecosError) {
          setRetailPrecosPorSku(new Map());
        } else {
          const m = new Map();
          for (const r of retailPrecos || []) {
            if (!r.client_id || !r.datasul_code) continue;
            const chave = `${r.client_id}|${String(r.datasul_code).trim().toUpperCase()}`;
            if (!m.has(chave)) {
              m.set(chave, {
                retail_price: r.retail_price,
                currency: r.currency,
                collected_at: r.collected_at,
              });
            }
          }
          setRetailPrecosPorSku(m);
        }
      } catch (e) {
        setRetailPrecosPorSku(new Map());
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      // Se for filtro de data, apenas atualiza
      if (field === 'dateFrom' || field === 'dateTo') {
        return { ...prev, [field]: value };
      }

      // Lógica de limpeza dependente
      const newFilters = { ...prev, [field]: value };

      // Se mudou o cliente, limpa o SKU (pois o SKU pode não pertencer ao novo cliente)
      if (field === 'client') {
        newFilters.sku = '';
      }

      // Se mudou a categoria, limpa a subcategoria
      if (field === 'category') {
        newFilters.subcategory = '';
      }

      // Nota: Ao mudar SKU ou Subcategoria, NÃO limpamos os filtros "pais" (Cliente ou Categoria)
      // pois a seleção deve ser refinada, não resetada.
      
      return newFilters;
    });
  };

  const filteredData = safePricingData.filter(item => {
    const matchesClient = !filters.client || item.client_id === filters.client;
    const matchesSku = !filters.sku
      || (codesFromSelectedSKU.length > 0
        ? (item.code && codesFromSelectedSKU.includes(item.code))
        : item.sku === filters.sku);
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesSubcategory = !filters.subcategory || item.subcategory === filters.subcategory;
    const matchesSize = !filters.size || item.size === filters.size;
    const matchesDatasul = !filters.datasulCode || (item.code && item.code.includes(filters.datasulCode));
    const matchesDateFrom = !filters.dateFrom || new Date(item.date) >= new Date(filters.dateFrom);
    const matchesDateTo = !filters.dateTo || new Date(item.date) <= new Date(filters.dateTo);
    
    return matchesClient && matchesSku && matchesCategory && matchesSubcategory && matchesSize && matchesDatasul && matchesDateFrom && matchesDateTo;
  });

  const markupPorLinha = useMemo(() => {
    const m = new Map();
    for (const item of safePricingData) {
      if (!item.id) continue;
      const semPonta = {
        status: MARKUP_STATUS.SEM_PONTA,
        markup: null,
        tier: null,
        moeda: null,
        detalhe: null,
      };
      const semPontaEntrada = {
        resultado: semPonta,
        ponta: null,
        markupNumeric: null,
        coletaData: null,
        proMaisRecente: false,
        linhaHistorica: !item.isCurrent,
      };
      if (!item.isCurrent) {
        m.set(item.id, semPontaEntrada);
        continue;
      }
      const chave = (item.client_id && item.code)
        ? `${item.client_id}|${String(item.code).trim().toUpperCase()}`
        : null;
      const ponta = chave ? retailPrecosPorSku.get(chave) : undefined;
      const precoPro = item.gross_price;
      const moedaPro = item.currency || 'BRL';
      const precoPonta = ponta ? ponta.retail_price : null;
      const moedaPonta = ponta ? ponta.currency : undefined;
      const resultado = calculateMarkup({
        precoPro,
        moedaPro,
        precoPonta,
        moedaPonta,
      });
      const coletaData = ponta && ponta.collected_at ? new Date(ponta.collected_at) : null;
      const proData = item.date ? new Date(item.date) : null;
      let proMaisRecente = false;
      if (coletaData && proData && !Number.isNaN(coletaData.getTime()) && !Number.isNaN(proData.getTime())) {
        proMaisRecente = proData.getTime() > coletaData.getTime();
      }
      m.set(item.id, {
        resultado,
        ponta,
        markupNumeric: (resultado.status === MARKUP_STATUS.OK && Number.isFinite(resultado.markup)) ? resultado.markup : null,
        coletaData,
        proMaisRecente,
        linhaHistorica: false,
      });
    }
    return m;
  }, [safePricingData, retailPrecosPorSku]);

  const markupPorCliente = useMemo(() => {
    const byClient = new Map();
    for (const item of safePricingData) {
      if (!item.isCurrent) continue;
      const clientId = item.client_id;
      if (!clientId) continue;
      const info = markupPorLinha.get(item.id);
      if (!info || !info.resultado || info.resultado.status !== MARKUP_STATUS.OK) continue;
      if (!byClient.has(clientId)) byClient.set(clientId, []);
      byClient.get(clientId).push({
        id: item.id,
        sku: item.sku,
        code: item.code,
        markup: info.resultado.markup,
        tier: resolveMarkupTier(info.resultado.markup),
      });
    }
    return byClient;
  }, [safePricingData, markupPorLinha]);

  const skuAtualDetail = useMemo(() => {
    if (!retailDetailOpen || !retailDetailSkuId) return null;
    return safePricingData.find((i) => i.id === retailDetailSkuId) || null;
  }, [retailDetailOpen, retailDetailSkuId, safePricingData]);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData;
    const data = [...filteredData];
    const sinal = sortDirection === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      if (sortKey === 'markup_ponta') {
        const ma = markupPorLinha.get(a.id);
        const mb = markupPorLinha.get(b.id);
        const temA = ma && ma.markupNumeric != null;
        const temB = mb && mb.markupNumeric != null;
        if (!temA && !temB) return 0;
        if (!temA) return 1;
        if (!temB) return -1;
        return (ma.markupNumeric - mb.markupNumeric) * sinal;
      }
      return 0;
    });
    return data;
  }, [filteredData, sortKey, sortDirection, markupPorLinha]);

  const handleExportExcel = async () => {
    try {
      const dataToExport = filteredData.map(item => ({
        'Cliente': item.clients?.name || '',
        'Tamanho': item.size || '',
        'Gestora': item.manager || '',
        'Código': item.code || '',
        'SKU': item.sku,
        'Preço liquido': item.net_price,
        'Preço bruto': item.gross_price || '',
        'Moeda': item.currency || 'BRL',
        'Margem (Orçada)': item.margin_budget ? `${item.margin_budget}%` : '',
        'Mês': item.month || (item.date ? format(new Date(item.date), 'MMM/yy', { locale: ptBR }) : ''),
        'Categoria': item.category || '',
        'Subcategoria': item.subcategory || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pricing Data");
      XLSX.writeFile(wb, "pricing_data.xlsx");
      await logExport('pricing_history', dataToExport.length, {
        format: 'xlsx',
        file_name: 'pricing_data.xlsx',
      });
      toast.success('Exportação concluída com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar Excel');
    }
  };



  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          // cellDates: true força o Excel a converter células de data para objetos Date nativos do JS
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Normalizar headers (chaves) para minúsculas e sem acentos/espaços extras para facilitar comparação
          const normalizeKey = (key) => key.toString().trim().toLowerCase();
          
          // Função auxiliar para parsear números (aceita formato BR 1.234,56 ou US 1234.56)
          const parseNumber = (value) => {
            if (typeof value === 'number') return value;
            if (!value) return 0;
            let str = value.toString().trim();
            // Remover R$, $, espaços
            str = str.replace(/[R$\s]/g, '');
            // Se tiver vírgula e ponto, assume formato BR (1.000,00) -> remove ponto, troca vírgula por ponto
            if (str.includes(',') && str.includes('.')) {
              return parseFloat(str.replace(/\./g, '').replace(',', '.'));
            }
            // Se só tiver vírgula, troca por ponto (1000,00 -> 1000.00)
            if (str.includes(',')) {
              return parseFloat(str.replace(',', '.'));
            }
            return parseFloat(str);
          };

          const normalizedData = jsonData.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
              // Mapeamento flexível de colunas
              const normKey = normalizeKey(key);
              if (normKey.includes('cliente')) newRow['client'] = row[key];
              else if (normKey.includes('sku')) newRow['sku'] = row[key];
              else if (normKey.includes('preço liquido') || normKey.includes('preco liquido') || normKey === 'net_price') newRow['net_price'] = row[key];
              else if (normKey.includes('preço bruto') || normKey.includes('preco bruto') || normKey === 'gross_price') newRow['gross_price'] = row[key];
              else if (normKey.includes('moeda')) newRow['currency'] = row[key];
              else if (normKey.includes('margem')) newRow['margin_budget'] = row[key];
              else if (normKey.includes('mês') || normKey.includes('mes')) newRow['month'] = row[key];
              else if (normKey.includes('data')) newRow['date'] = row[key];
              else if (normKey.includes('tamanho')) newRow['size'] = row[key];
              else if (normKey.includes('gestora')) newRow['manager'] = row[key];
              else if (normKey.includes('código') || normKey.includes('codigo')) newRow['code'] = row[key];
              else if (normKey.includes('categoria')) newRow['category'] = row[key];
              else if (normKey.includes('subcategoria')) newRow['subcategory'] = row[key];
              else if (normKey.includes('observações') || normKey.includes('observacoes') || normKey.includes('obs')) newRow['obs'] = row[key];
            });
            return newRow;
          });

          // Validar colunas necessárias
          const firstRow = normalizedData[0];
          if (!firstRow) {
            toast.error('O arquivo parece estar vazio.');
            return;
          }

          // Verificar se campos obrigatórios existem na primeira linha mapeada
          const missingFields = [];
          if (!('client' in firstRow)) missingFields.push('Cliente');
          if (!('sku' in firstRow)) missingFields.push('SKU');
          if (!('code' in firstRow)) missingFields.push('Código');
          if (!('net_price' in firstRow)) missingFields.push('Preço Liquido');
          // Mês ou Data deve existir
          if (!('month' in firstRow) && !('date' in firstRow)) missingFields.push('Mês ou Data');

          if (missingFields.length > 0) {
            toast.error(`Colunas obrigatórias não identificadas: ${missingFields.join(', ')}. Verifique os nomes das colunas.`);
            return;
          }

          // Processar dados
          const processedData = [];
          let successCount = 0;
          let errorCount = 0;

          // Carregar cache de clientes e aliases para evitar N+1 queries
          const { data: allAliases } = await supabase.from('client_aliases').select('alias_name, client_id');
          const { data: allClients } = await supabase.from('clients').select('id, name');
          
          const aliasMap = new Map(allAliases?.map(a => [a.alias_name.toLowerCase(), a.client_id]));
          const clientMap = new Map(allClients?.map(c => [c.name.toLowerCase(), c.id]));

          for (const row of normalizedData) {
            // Normalizar nome do cliente
            const clientNameRaw = row['client']?.toString().trim();
            if (!clientNameRaw) continue;
            const clientNameLower = clientNameRaw.toLowerCase();

            // Validar SKU
            const sku = row['sku']?.toString().trim();
            if (!sku) {
              errorCount++;
              continue;
            }

            // Validar Código (obrigatório + formato Datasul \d{4}\.\d{4}\.\d{4})
            const codigoRegex = /^\d{4}\.\d{4}\.\d{4}$/;
            const code = row['code']?.toString().trim();
            if (!code || !codigoRegex.test(code)) {
              console.warn(`Código Datasul inválido ou ausente para ${clientNameRaw} - ${sku}: ${row['code'] || '(vazio)'}. Esperado: 0000.0000.0000`);
              errorCount++;
              continue;
            }

            // Validar valores numéricos com parser robusto
            const netPrice = parseNumber(row['net_price']);
            const grossPrice = parseNumber(row['gross_price']);
            let marginBudget = parseNumber(row['margin_budget']);
            
            // Correção automática para porcentagens vindas do Excel
            // Se o valor for menor ou igual a 1 (ex: 0.3), assume que é decimal e multiplica por 100 para virar 30(%)
            // Exceto se for exatamente 0 ou negativo (pode ser margem zero ou negativa, mas 0.3 é claramente 30%)
            // Se o usuário digitou 30 no Excel, vem 30. Se digitou 30%, vem 0.3.
            if (marginBudget !== null && !isNaN(marginBudget)) {
               if (Math.abs(marginBudget) <= 1 && marginBudget !== 0) {
                 marginBudget = marginBudget * 100;
               }
            }
            
            if (isNaN(netPrice) || netPrice <= 0) {
              console.warn(`Preço inválido para ${clientNameRaw} - ${sku}: ${row['net_price']}`);
              errorCount++;
              continue;
            }
            
            // Validar/Gerar data
            let date = new Date();
            const monthVal = row['month'];
            let monthStr = null;
            
            // Se monthVal já for um objeto Date (graças ao cellDates: true)
            if (monthVal instanceof Date && !isNaN(monthVal)) {
               date = monthVal;
               // Gerar string do mês a partir da data se não veio como texto
               monthStr = format(date, 'MMM/yy', { locale: ptBR });
            } 
            else if (typeof monthVal === 'string') {
               monthStr = monthVal.trim();
               if (monthStr) {
                 const months = {
                   'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                   'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
                   'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
                   'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
                 };
                 
                 const parts = monthStr.toLowerCase().split(/[-/ .]/);
                 if (parts.length >= 2) {
                   const monthPart = parts[0].substring(0, 3); // pegar 3 primeiras letras
                   let monthIndex = -1;
                   Object.keys(months).forEach(m => {
                      if (monthPart.includes(m)) monthIndex = months[m];
                   });
  
                   const yearPart = parts[1];
                   let year = parseInt(yearPart.replace(/\D/g, '')); // remover não-números
                   if (year < 100) year += 2000;
                   
                   if (monthIndex !== -1 && !isNaN(year)) {
                     date = new Date(year, monthIndex, 1);
                   }
                 } else if (parts.length === 1) {
                   // Caso seja apenas o nome do mês (ex: "Janeiro"), assume o ano atual
                   const monthPart = parts[0].substring(0, 3);
                   let monthIndex = -1;
                   Object.keys(months).forEach(m => {
                      if (monthPart.includes(m)) monthIndex = months[m];
                   });
                   
                   if (monthIndex !== -1) {
                     date = new Date(new Date().getFullYear(), monthIndex, 1);
                     // Atualiza monthStr para o formato padrão
                     monthStr = format(date, 'MMM/yy', { locale: ptBR });
                   }
                 }
               }
            } else if (row['date']) {
               // Fallback para coluna Date se Mês falhar ou não existir
               if (row['date'] instanceof Date && !isNaN(row['date'])) {
                  date = row['date'];
               } else if (typeof row['date'] === 'number') {
                  // Excel date serial conversion (caso cellDates não tenha pego)
                  date = new Date(Math.round((row['date'] - 25569) * 86400 * 1000));
               } else {
                  const parsedDate = new Date(row['date']);
                  if (!isNaN(parsedDate.getTime())) {
                    date = parsedDate;
                  }
               }
            }

            // Normalizar Moeda
            let currency = 'BRL';
            const currencyStr = row['currency']?.toString().trim().toUpperCase();
            if (currencyStr && (currencyStr.includes('DÓLAR') || currencyStr.includes('DOLAR') || currencyStr.includes('USD') || currencyStr.includes('$'))) {
              currency = 'USD';
            }

            // Resolver Client ID usando mapas em memória
            let clientId = aliasMap.get(clientNameLower);
            
            if (!clientId) {
              clientId = clientMap.get(clientNameLower);
              
              if (!clientId) {
                // Criar novo cliente se não existir (opcional, pode ser perigoso se for erro de digitação)
                // Aqui mantemos o comportamento original de criar
                try {
                    const { data: newClient, error: createError } = await supabase
                      .from('clients')
                      .insert({ name: clientNameRaw })
                      .select('id')
                      .single();
                    
                    if (!createError && newClient) {
                        clientId = newClient.id;
                        clientMap.set(clientNameLower, clientId); // Atualizar cache local
                    } else {
                        console.error('Erro ao criar cliente:', clientNameRaw, createError);
                        errorCount++;
                        continue;
                    }
                } catch (e) {
                    console.error('Exceção ao criar cliente:', e);
                    errorCount++;
                    continue;
                }
              }
            }

            processedData.push({
              client_id: clientId,
              sku: sku.toUpperCase(),
              net_price: netPrice,
              gross_price: isNaN(grossPrice) ? null : grossPrice,
              margin_budget: isNaN(marginBudget) ? null : marginBudget,
              size: row['size']?.toString().trim() || null,
              manager: row['manager']?.toString().trim() || null,
              code: code,
              category: row['category']?.toString().trim() || null,
              subcategory: row['subcategory']?.toString().trim() || null,
              month: monthStr || null,
              date: date.toISOString().split('T')[0],
              obs: row['obs']?.toString().trim() || null,
              currency: currency,
              gate: calculateGate(date.getMonth()),
              readjustment_status: 'Em Análise',
              communication_status: 'pending'
            });
            successCount++;
          }

          if (processedData.length === 0) {
            toast.warning(`Nenhum registro válido encontrado. ${errorCount} linhas ignoradas por erro ou dados faltantes.`);
            return;
          }

          // Inserir dados no banco
          const { error } = await supabase
            .from('pricing_history')
            .insert(processedData);

          if (error) throw error;

          if (errorCount > 0) {
             toast.success(`Importação parcial: ${successCount} registros importados, ${errorCount} ignorados.`);
          } else {
             toast.success(`Importação realizada com sucesso! ${successCount} registros importados.`);
          }
          
          setShowImportModal(false);
          setImportFile(null);
          loadData(); // Recarregar dados

        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          toast.error('Erro ao processar arquivo: ' + error.message);
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      console.error('Erro ao importar Excel:', error);
      toast.error('Erro ao importar Excel: ' + error.message);
    }
  };

  const handleNewPriceSubmit = async (e) => {
    e.preventDefault();
    
    // Validação de campos obrigatórios
    if (!newPriceForm.client_id || !newPriceForm.sku || !newPriceForm.code || !newPriceForm.net_price || !newPriceForm.date) {
      toast.error('Por favor, preencha todos os campos obrigatórios (incluindo Código Datasul).');
      return;
    }

    // Validação de formato do code (Datasul: \d{4}\.\d{4}\.\d{4})
    const codigoRegex = /^\d{4}\.\d{4}\.\d{4}$/;
    const codeNormalizado = String(newPriceForm.code || '').trim();
    if (!codigoRegex.test(codeNormalizado)) {
      toast.error('Código Datasul inválido. Formato esperado: 0000.0000.0000');
      return;
    }

    // Validação de valores numéricos
    const netPrice = parseFloat(newPriceForm.net_price);
    const grossPrice = newPriceForm.gross_price ? parseFloat(newPriceForm.gross_price) : null;
    const marginBudget = newPriceForm.margin_budget ? parseFloat(newPriceForm.margin_budget) : null;
    
    if (isNaN(netPrice) || netPrice <= 0) {
      toast.error('Preço líquido deve ser um número positivo.');
      return;
    }
    
    try {
      const priceData = {
        client_id: newPriceForm.client_id,
        sku: newPriceForm.sku.trim().toUpperCase(),
        net_price: netPrice,
        gross_price: grossPrice,
        margin_budget: marginBudget,
        size: newPriceForm.size?.trim() || null,
        manager: newPriceForm.manager?.trim() || null,
        code: codeNormalizado,
        category: newPriceForm.category?.trim() || null,
        subcategory: newPriceForm.subcategory?.trim() || null,
        month: newPriceForm.month ? (() => {
          const [y, m, d] = newPriceForm.month.split('-');
          return format(new Date(y, m - 1, d), 'MMM/yy', { locale: ptBR });
        })() : null,
        date: newPriceForm.date,
        obs: newPriceForm.obs?.trim() || null,
        currency: newPriceForm.currency || 'BRL',
        gate: (() => {
          let monthIndex;
          if (newPriceForm.month) {
            const [y, m, d] = newPriceForm.month.split('-').map(Number);
            monthIndex = m - 1;
          } else if (newPriceForm.date) {
            const [y, m, d] = newPriceForm.date.split('-').map(Number);
            monthIndex = m - 1;
          } else {
            return null;
          }
          return calculateGate(monthIndex);
        })(),
        // Default CS workflow status for new entries
        ...(!editingId && {
          readjustment_status: 'Em Análise',
          communication_status: 'pending'
        })
      };

      let error;
      let savedRowId = editingId;
      
      if (editingId) {
        const { error: updateError } = await supabase
          .from('pricing_history')
          .update(priceData)
          .eq('id', editingId);
        error = updateError;
      } else {
        const { data: insertedRow, error: insertError } = await supabase
          .from('pricing_history')
          .insert(priceData)
          .select('id')
          .single();
        error = insertError;
        savedRowId = insertedRow?.id || null;
      }

      if (error) throw error;

      // Regra de vigência: novo preço cadastrado para o mesmo code/cliente vira o atual.
      if (!editingId && savedRowId) {
        await setCurrentPriceForSku({
          clientId: priceData.client_id,
          code: priceData.code,
          currentId: savedRowId
        });
      }

      toast.success(editingId ? 'Preço atualizado com sucesso!' : 'Preço cadastrado com sucesso!');
      setShowNewPriceModal(false);
      setEditingId(null);
      setNewPriceForm({
        client_id: '',
        sku: '',
        net_price: '',
        gross_price: '',
        margin_budget: '',
        size: '',
        manager: '',
        code: '',
        category: '',
        subcategory: '',
        month: '',
        date: new Date().toISOString().split('T')[0],
        obs: ''
      });
      loadData(); // Recarregar dados

    } catch (error) {
      console.error('Erro ao salvar preço:', error);
      toast.error('Erro ao salvar preço: ' + error.message);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNewPriceForm({
      client_id: item.client_id,
      sku: item.sku,
      net_price: item.net_price,
      gross_price: item.gross_price || '',
      margin_budget: item.margin_budget || '',
      size: item.size || '',
      manager: item.manager || '',
      code: item.code || '',
      category: item.category || '',
      subcategory: item.subcategory || '',
      month: item.date ? item.date.split('T')[0] : '', // Use date to populate month input
      date: item.date.split('T')[0],
      obs: item.obs || '',
      currency: item.currency || 'BRL'
    });
    setShowNewPriceModal(true);
  };

  const handleDeleteClick = (item) => {
    if (!isSuper) {
        toast.error('Apenas usuários do time de Pricing podem excluir registros.');
        return;
    }
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('pricing_history')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast.success('Registro excluído com sucesso!');
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  // ====== Importação de preços de ponta ======

  const montarMapasImportacao = () => {
    const codigosDaBase = new Set();
    for (const item of safePricingData) {
      if (item.client_id && item.code) {
        codigosDaBase.add(chaveCodigo(item.client_id, item.code));
      }
    }
    const aliases = new Map();
    for (const a of retailSkuAliases) {
      if (a.client_id && a.nome_site && a.datasul_code) {
        aliases.set(chaveAlias(a.client_id, a.nome_site), a.datasul_code);
      }
    }
    const clientesPorNome = new Map();
    for (const c of safeClients) {
      if (c.id && c.name) {
        clientesPorNome.set(normalizarNomeSite(c.name), c.id);
      }
    }
    return { codigosDaBase, aliases, clientesPorNome };
  };

  const skusPorCliente = useMemo(() => {
    const m = new Map();
    for (const item of safePricingData) {
      if (!item.client_id || !item.code) continue;
      if (!m.has(item.client_id)) m.set(item.client_id, new Map());
      const inner = m.get(item.client_id);
      if (!inner.has(item.code)) {
        inner.set(item.code, {
          code: item.code,
          sku: item.sku,
          category: item.category || '',
          subcategory: item.subcategory || '',
        });
      }
    }
    return m;
  }, [safePricingData]);

  const linhasAposCorrecaoManual = useMemo(() => {
    return retailLinhasPreparadas.map((linha, idx) => {
      const manual = retailCodigosManuais[idx];
      if (!manual) return { ...linha, _resolvidoManualmente: false };
      const vinculoAtual = linha.vinculo;
      if (vinculoAtual && vinculoAtual.status !== 'pendente') {
        return { ...linha, _resolvidoManualmente: false };
      }
      if (linha.errosLinha && linha.errosLinha.length > 0) {
        return { ...linha, _resolvidoManualmente: false };
      }
      const novoVinculo = {
        status: VINCULO_STATUS.POR_CODIGO,
        datasulCode: manual.trim().toUpperCase(),
        motivo: null,
        origem: 'manual',
      };
      return {
        ...linha,
        vinculo: novoVinculo,
        _resolvidoManualmente: true,
        _codigoManualOriginal: manual,
      };
    });
  }, [retailLinhasPreparadas, retailCodigosManuais]);

  const resumoAposCorrecao = useMemo(() => {
    if (retailLinhasPreparadas.length === 0) return retailResumo;
    let total = 0;
    let porCodigo = 0;
    let porAlias = 0;
    let pendentes = 0;
    let invalidos = 0;
    let errosLinhaCount = 0;
    for (const linha of linhasAposCorrecaoManual) {
      const temErro = linha.errosLinha && linha.errosLinha.length > 0;
      if (temErro) errosLinhaCount++;
      const v = linha.vinculo;
      const linhaValida = v && typeof v === 'object' && 'status' in v;
      if (!linhaValida) {
        invalidos++;
        total++;
        continue;
      }
      total++;
      if (v.status === VINCULO_STATUS.POR_CODIGO) {
        porCodigo++;
      } else if (v.status === VINCULO_STATUS.POR_ALIAS) {
        porAlias++;
      } else if (v.status === VINCULO_STATUS.PENDENTE) {
        if (temErro) {
          // Linha pendente COM erro não entra em "Sem vínculo" — a categoria
          // "Sem vínculo" só conta pendentes SEM erro (os com select resolvível).
        } else {
          pendentes++;
        }
      } else {
        invalidos++;
      }
    }
    return {
      total,
      porCodigo,
      porAlias,
      pendentes,
      invalidos,
      podeCommitar: total > 0 && pendentes === 0 && invalidos === 0 && errosLinhaCount === 0,
      errosLinhaCount,
    };
  }, [linhasAposCorrecaoManual, retailLinhasPreparadas.length, retailResumo]);

  const podeCommitarAposCorrecao = () => {
    if (!resumoAposCorrecao) return false;
    const temErroLinha = resumoAposCorrecao.errosLinhaCount > 0;
    const resumo = resumoAposCorrecao;
    const temConflito = retailConflitos && retailConflitos.length > 0;
    if (retailVerificandoConflitos) return false;
    return (
      !temErroLinha &&
      !temConflito &&
      resumo.total > 0 &&
      resumo.pendentes === 0 &&
      (resumo.invalidos === 0 || resumo.invalidos == null)
    );
  };

  const montarPrecoRows = () => {
    const userId = user?.id || null;
    const precoRows = [];
    const aliasRows = [];
    for (let idx = 0; idx < linhasAposCorrecaoManual.length; idx++) {
      const linha = linhasAposCorrecaoManual[idx];
      if (linha.errosLinha && linha.errosLinha.length > 0) {
        continue;
      }
      const v = linha.vinculo;
      if (!v || v.status === 'pendente') continue;
      if (!v.datasulCode) continue;
      if (!linha.clientId) continue;
      if (!(linha.precoPonta != null && Number.isFinite(linha.precoPonta))) continue;
      if (!linha.dataColeta) continue;
      const row = {
        client_id: linha.clientId,
        datasul_code: String(v.datasulCode).trim().toUpperCase(),
        nome_site: String(linha.nomeSite || '').trim(),
        retail_price: linha.precoPonta,
        currency: linha.moeda || 'BRL',
        collected_at: linha.dataColeta,
        source: linha.fonte,
        created_by: userId,
        _idxOriginal: idx,
      };
      precoRows.push(row);
      if (linha._resolvidoManualmente) {
        aliasRows.push({
          client_id: linha.clientId,
          nome_site: String(linha.nomeSite || '').trim(),
          datasul_code: String(v.datasulCode).trim().toUpperCase(),
          created_by: userId,
        });
      }
    }
    return { precoRows, aliasRows };
  };

  const verificarConflitosRetail = async (precoRows) => {
    if (!precoRows || precoRows.length === 0) {
      setRetailConflitos([]);
      return [];
    }
    try {
      setRetailVerificandoConflitos(true);
      const clientIds = [...new Set(precoRows.map((r) => r.client_id))];
      const datasulCodes = [...new Set(precoRows.map((r) => r.datasul_code))];
      const collectedAts = [...new Set(precoRows.map((r) => r.collected_at))];
      const { data, error } = await supabase
        .from('client_retail_prices')
        .select('client_id, datasul_code, collected_at')
        .in('client_id', clientIds)
        .in('datasul_code', datasulCodes)
        .in('collected_at', collectedAts);
      if (error) {
        console.warn('verificarConflitosRetail: query falhou, seguindo sem pré-check', error);
        setRetailConflitos([]);
        return [];
      }
      const jaExistem = new Set(
        (data || []).map(
          (d) => `${d.client_id}|${String(d.datasul_code || '').trim().toUpperCase()}|${d.collected_at}`,
        ),
      );
      const conflitos = [];
      for (const r of precoRows) {
        const chave = `${r.client_id}|${r.datasul_code}|${r.collected_at}`;
        if (jaExistem.has(chave)) {
          const idx = r._idxOriginal;
          const prep = retailLinhasPreparadas[idx] || {};
          conflitos.push({
            linhaArquivo: prep.linhaArquivo || (idx + 2),
            cliente: prep.clienteNome || '',
            codigo: r.datasul_code,
            data: r.collected_at,
          });
        }
      }
      setRetailConflitos(conflitos);
      return conflitos;
    } catch (e) {
      console.warn('verificarConflitosRetail: exceção', e);
      setRetailConflitos([]);
      return [];
    } finally {
      setRetailVerificandoConflitos(false);
    }
  };

  const abrirConferenciaRetail = () => {
    setRetailConferenciaAtiva(true);
    setRetailLinhasPreparadas([]);
    setRetailResumo(null);
    setRetailErrosEstruturais([]);
    setRetailCodigosManuais({});
    setRetailConflitos([]);
    setRetailCommitando(false);
    setRetailArquivoNome(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await processarArquivoRetail(file);
      }
      document.body.removeChild(input);
    };
    document.body.appendChild(input);
    setTimeout(() => input.click(), 0);
  };

  const cancelarConferenciaRetail = () => {
    setRetailConferenciaAtiva(false);
    setRetailLinhasPreparadas([]);
    setRetailResumo(null);
    setRetailErrosEstruturais([]);
    setRetailCodigosManuais({});
    setRetailConflitos([]);
    setRetailCommitando(false);
    setRetailArquivoNome(null);
  };

  const temVinculosManuaisPendentes = useMemo(() => {
    return retailCodigosManuais && typeof retailCodigosManuais === 'object'
      && Object.keys(retailCodigosManuais).length > 0;
  }, [retailCodigosManuais]);

  const tentarSairConferencia = useCallback(() => {
    if (!retailConferenciaAtiva) return;
    if (temVinculosManuaisPendentes) {
      const ok = window.confirm(
        'Você tem vínculos resolvidos manualmente que ainda não foram gravados. ' +
        'Sair agora vai perdê-los.\n\nDeseja realmente sair da conferência?'
      );
      if (!ok) return;
    }
    cancelarConferenciaRetail();
  }, [retailConferenciaAtiva, temVinculosManuaisPendentes, cancelarConferenciaRetail]);

  const processarArquivoRetail = async (file) => {
    try {
      setRetailArquivoNome(file.name);
      const { linhas, erros } = await lerArquivoPonta(file);
      if (erros && erros.length > 0) {
        setRetailLinhasPreparadas([]);
        setRetailResumo(null);
        setRetailErrosEstruturais(erros);
        return;
      }
      setRetailErrosEstruturais([]);
      const { codigosDaBase, aliases, clientesPorNome } = montarMapasImportacao();
      const preparadas = prepararLote({
        linhas,
        codigosDaBase,
        aliases,
        clientesPorNome,
      });
      setRetailLinhasPreparadas(preparadas);
      setRetailCodigosManuais({});
      const resultadosVinculo = preparadas.map((l) => l.vinculo);
      const resumoInicial = resumirLote(resultadosVinculo);
      setRetailResumo(resumoInicial);
      setRetailConflitos([]);
      if (preparadas.length === 0) {
        setRetailErrosEstruturais(['Nenhuma linha de dados foi lida do arquivo.']);
      }
    } catch (e) {
      console.error(e);
      setRetailErrosEstruturais([
        `Erro ao processar arquivo: ${e && e.message ? e.message : String(e)}`,
      ]);
    }
  };

  const handleSelecionarSkuManual = (idx, novoCodigo) => {
    setRetailCodigosManuais((prev) => {
      const next = { ...prev };
      if (!novoCodigo || String(novoCodigo).trim() === '') {
        delete next[idx];
      } else {
        next[idx] = String(novoCodigo).trim();
      }
      return next;
    });
  };

  const confirmarImportacaoRetail = async () => {
    if (!podeCommitarAposCorrecao()) return;
    try {
      setRetailCommitando(true);
      const { precoRows, aliasRows } = montarPrecoRows();

      if (precoRows.length === 0) {
        toast.error('Nenhuma linha pronta para importar.');
        return;
      }

      const conflitosRedeSeguranca = await verificarConflitosRetail(precoRows);
      if (conflitosRedeSeguranca && conflitosRedeSeguranca.length > 0) {
        toast.error(
          `Conflito de importação: ${conflitosRedeSeguranca.length} linha(s) já importada(s) para a mesma data. Corrija a planilha e reimporte.`,
        );
        return;
      }

      const rowsInsert = precoRows.map(({ _idxOriginal, ...rest }) => rest);

      const { error: insertPrecosError, data: insertedPrecos } = await supabase
        .from('client_retail_prices')
        .insert(rowsInsert)
        .select('client_id, datasul_code, collected_at');

      if (insertPrecosError) {
        console.error(insertPrecosError);
        toast.error(
          `Erro ao gravar preços: ${insertPrecosError.message || String(insertPrecosError)}. A importação foi cancelada; os vínculos que você resolveu foram mantidos.`,
        );
        return;
      }

      if (aliasRows.length > 0) {
        const { error: insertAliasesError } = await supabase
          .from('retail_sku_aliases')
          .upsert(aliasRows, {
            onConflict: 'client_id, nome_site',
            ignoreDuplicates: false,
          });
        if (insertAliasesError) {
          console.warn('Erro ao inserir aliases (preços foram gravados):', insertAliasesError);
        }
      }

      toast.success(`Importação concluída: ${insertedPrecos ? insertedPrecos.length : precoRows.length} preço(s) gravado(s).`);
      setRetailCommitando(false);
      cancelarConferenciaRetail();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(
        `Erro na importação: ${e && e.message ? e.message : String(e)}. A importação foi cancelada; os vínculos que você resolveu foram mantidos.`,
      );
    } finally {
      setRetailCommitando(false);
    }
  };

  const handleToggleVigency = async (item) => {
    if (!canEdit || !item?.id) return;

    try {
      const { data: skuRows, error } = await supabase
        .from('pricing_history')
        .select('*')
        .eq('client_id', item.client_id)
        .eq('code', item.code);

      if (error) throw error;

      const sortedRows = [...(skuRows || [])].sort(comparePricingRows);

      if (item.isCurrent) {
        const nextCurrent = sortedRows.find(row => row.id !== item.id);
        if (!nextCurrent) {
          toast.warning('Não é possível remover o único preço vigente deste código.');
          return;
        }

        await setCurrentPriceForSku({
          clientId: item.client_id,
          code: item.code,
          currentId: nextCurrent.id
        });
        toast.success('Preço movido para histórico com sucesso.');
      } else {
        await setCurrentPriceForSku({
          clientId: item.client_id,
          code: item.code,
          currentId: item.id
        });
        toast.success('Preço marcado como vigente com sucesso.');
      }

      loadData();
    } catch (error) {
      console.error('Erro ao alternar vigência:', error);
      toast.error('Erro ao alternar vigência.');
    }
  };

  // Função para normalizar nome de cliente (adicionar alias automaticamente)
  const normalizeClientName = async (clientId, originalName) => {
    try {
      // Verificar se já existe alias para este nome
      const { data: existingAlias } = await supabase
        .from('client_aliases')
        .select('id')
        .eq('alias_name', originalName)
        .single();

      if (!existingAlias) {
        // Criar alias automaticamente
        await supabase
          .from('client_aliases')
          .insert({
            client_id: clientId,
            alias_name: originalName
          });
      }
    } catch (error) {
      console.error('Erro ao normalizar nome do cliente:', error);
    }
  };

  const handleNewPriceChange = (field, value) => {
    setNewPriceForm(prev => {
      const newData = { ...prev, [field]: value };
      // Limpar SKU automaticamente se o cliente for alterado
      if (field === 'client_id') {
        newData.sku = '';
      }
      return newData;
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle="Dados e análises" 
        showBack={false} 
        logoRedirect="/select"
      />

      {/* Action Bar */}
      <div className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Botões principais à esquerda */}
            {canEdit && (
              <>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setBasePriceId('');
                    setNewPriceForm({
                      client_id: '',
                      sku: '',
                      net_price: '',
                      gross_price: '',
                      margin_budget: '',
                      size: '',
                      manager: '',
                      code: '',
                      category: '',
                      subcategory: '',
                      month: '',
                      date: new Date().toISOString().split('T')[0],
                      obs: '',
                      currency: 'BRL'
                    });
                    setShowNewPriceModal(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 text-white w-[180px]"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  <Plus size={18} />
                  Novo Preço
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 text-white w-[180px]"
                  style={{ backgroundColor: 'var(--color-info)' }}
                >
                  <Upload size={18} />
                  Importar Excel
                </button>
                <button
                  onClick={abrirConferenciaRetail}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 text-white whitespace-nowrap"
                  style={{ backgroundColor: COR_ROXO_COMPLEMENTAR_BOTAO }}
                >
                  <Briefcase size={18} />
                  Importar preços de ponta
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/pricing/analytics')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <BarChart3 size={18} />
              Ver Dashboards/Análises
            </button>
          </div>
          
          {/* Botões à direita: Exportar e Gerenciar Depara */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center px-3 py-2 rounded-lg font-semibold transition-colors hover:shadow-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              title="Exportar"
            >
              <Download size={18} />
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setShowAliasManager(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors hover:shadow-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  <Settings size={18} />
                  Gerenciar Depara
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Conferência de importação de preços de ponta */}
      {retailConferenciaAtiva && (
        <div className="max-w-[110rem] mx-auto px-6 py-2">
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm transition-colors duration-200">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  onClick={tentarSairConferencia}
                  className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  title="Voltar ao dashboard"
                  type="button"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Conferência de importação de preços de ponta
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {retailArquivoNome ? `Arquivo: ${retailArquivoNome}` : 'Selecione um arquivo para começar.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={abrirConferenciaRetail}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Upload size={16} />
                  Trocar arquivo
                </button>
                <button
                  onClick={tentarSairConferencia}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <X size={16} />
                  Cancelar
                </button>
              </div>
            </div>

            {retailErrosEstruturais && retailErrosEstruturais.length > 0 && (
              <div className="mb-4 p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
                      Não foi possível ler o arquivo
                    </p>
                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                      {retailErrosEstruturais.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {resumoAposCorrecao && (
              <div className="mb-4 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Total de linhas: </span>
                    <span className="font-bold text-gray-900 dark:text-white text-lg">{resumoAposCorrecao.total}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Vinculadas por código: </span>
                    <span className="font-semibold text-green-700 dark:text-green-400">{resumoAposCorrecao.porCodigo}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Vinculadas por de-para: </span>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">{resumoAposCorrecao.porAlias}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Sem vínculo: </span>
                    <span className={`font-semibold ${resumoAposCorrecao.pendentes > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {resumoAposCorrecao.pendentes}
                    </span>
                  </div>
                  {resumoAposCorrecao.errosLinhaCount > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Com erro de linha: </span>
                      <span className="font-semibold text-red-700 dark:text-red-400">{resumoAposCorrecao.errosLinhaCount}</span>
                    </div>
                  )}
                  {resumoAposCorrecao.invalidos > 0 && (
                    <div className="px-3 py-1 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-800">
                      <span className="text-red-800 dark:text-red-300 font-bold text-xs">
                        REGISTROS INVÁLIDOS (BUG): {resumoAposCorrecao.invalidos}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {retailConflitos && retailConflitos.length > 0 && (
              <div className="mb-4 p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
                      Já existem preços gravados para as chaves abaixo. Remova essas linhas da planilha ou use outra data de coleta.
                    </p>
                    <div className="overflow-x-auto mt-2">
                      <table className="min-w-[400px] text-sm">
                        <thead>
                          <tr>
                            <th className="px-3 py-1 text-left text-red-700 dark:text-red-400 font-semibold">Linha</th>
                            <th className="px-3 py-1 text-left text-red-700 dark:text-red-400 font-semibold">Cliente</th>
                            <th className="px-3 py-1 text-left text-red-700 dark:text-red-400 font-semibold">Código</th>
                            <th className="px-3 py-1 text-left text-red-700 dark:text-red-400 font-semibold">Data coleta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {retailConflitos.map((c, i) => (
                            <tr key={i} className="border-t border-red-200 dark:border-red-900">
                              <td className="px-3 py-1 text-red-800 dark:text-red-300">{c.linhaArquivo}</td>
                              <td className="px-3 py-1 text-red-800 dark:text-red-300">{c.cliente}</td>
                              <td className="px-3 py-1 text-red-800 dark:text-red-300 font-mono">{c.codigo}</td>
                              <td className="px-3 py-1 text-red-800 dark:text-red-300">{c.data}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {linhasAposCorrecaoManual.length > 0 && (
              <div className="overflow-auto max-h-[62vh] border border-gray-200 dark:border-gray-800 rounded-lg">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Linha
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[280px]">
                        Nome no site
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Preço de ponta
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[280px]">
                        Situação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-[#0a0a0a] divide-y divide-gray-200 dark:divide-gray-800">
                    {linhasAposCorrecaoManual.map((linha, idx) => {
                      const temErroLinha = linha.errosLinha && linha.errosLinha.length > 0;
                      const v = linha.vinculo || {};
                      const rowClass = temErroLinha
                        ? 'bg-red-50 dark:bg-red-900/10'
                        : v.status === 'pendente'
                        ? 'bg-amber-50 dark:bg-amber-900/10'
                        : '';
                      const skuOptions = linha.clientId ? (skusPorCliente.get(linha.clientId) || new Map()) : new Map();
                      const skuOptionsList = Array.from(skuOptions.values());
                      return (
                        <tr key={idx} className={rowClass}>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300 align-top">
                            {linha.linhaArquivo}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200 align-top">
                            {linha.clienteNome || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-200 align-top">
                            <div className="max-w-md break-words">
                              {linha.nomeSite || <span className="text-gray-400">-</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200 font-mono align-top">
                            {linha.datasulCodeInformado || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200 align-top">
                            {linha.precoPonta != null ? (
                              <span>
                                {linha.moeda === 'USD' ? '$' : 'R$'} {Number(linha.precoPonta).toFixed(2)}
                                <span className="text-gray-400 text-xs ml-2">{linha.moeda}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-800 dark:text-gray-200 align-top">
                            {linha.dataColeta || <span className="text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {temErroLinha ? (
                              <div className="space-y-1">
                                <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900 whitespace-nowrap">
                                  Erro na linha · corrija a planilha
                                </Badge>
                                <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-400 space-y-0.5 mt-1 pl-1">
                                  {linha.errosLinha.map((e, i2) => (
                                    <li key={i2}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : v.status === VINCULO_STATUS.POR_CODIGO ? (
                              <div className="space-y-1">
                                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900 whitespace-nowrap">
                                  <Check size={12} className="mr-1 inline" />
                                  {v.origem === 'manual' ? 'Vinculado manualmente' : 'Vinculado por código'}
                                </Badge>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Código: <span className="font-mono">{v.datasulCode}</span>
                                </div>
                              </div>
                            ) : v.status === VINCULO_STATUS.POR_ALIAS ? (
                              <div className="space-y-1">
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900 whitespace-nowrap">
                                  <ShieldCheck size={12} className="mr-1 inline" />
                                  Por de-para (alias)
                                </Badge>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Código: <span className="font-mono">{v.datasulCode}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900 whitespace-nowrap">
                                  <Clock size={12} className="mr-1 inline" />
                                  Sem vínculo · resolva abaixo
                                </Badge>
                                {v.motivo && (
                                  <div className="text-xs text-amber-700 dark:text-amber-400">
                                    Motivo: {String(v.motivo)}
                                  </div>
                                )}
                                {linha.clientId ? (
                                  skuOptionsList.length === 0 ? (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      Nenhum SKU encontrado na base para este cliente.
                                    </div>
                                  ) : (
                                    <select
                                      value={retailCodigosManuais[idx] || ''}
                                      onChange={(e) => handleSelecionarSkuManual(idx, e.target.value)}
                                      className="w-full px-2 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                    >
                                      <option value="">-- Escolha o SKU correspondente --</option>
                                      {skuOptionsList.map((s) => (
                                        <option key={s.code} value={s.code}>
                                          [{s.code}] {s.sku}
                                          {s.category ? ` · ${s.category}` : ''}
                                          {s.subcategory ? ` / ${s.subcategory}` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  )
                                ) : (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Cliente não identificado — não é possível selecionar um SKU.
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(resumoAposCorrecao || (retailErrosEstruturais && retailErrosEstruturais.length > 0)) && (
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-800 pt-4">
                <button
                  onClick={tentarSairConferencia}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarImportacaoRetail}
                  disabled={!podeCommitarAposCorrecao() || retailCommitando}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-colors transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 disabled:hover:scale-100 text-white"
                  style={{ backgroundColor: 'var(--color-success)' }}
                >
                  {retailCommitando ? (
                    <>
                      <Clock size={16} className="animate-spin" />
                      Gravando…
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar importação
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!retailConferenciaAtiva && (
        <>
        {/* Cards de Resumo */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Clientes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(filters.client || filters.sku || filters.category || filters.subcategory || filters.size || filters.datasulCode || filters.dateFrom || filters.dateTo) 
                      ? new Set(filteredData.map(item => item.client_id)).size 
                      : clients.length}
                  </p>
                </div>
                <Users className="text-blue-500" size={32} />
              </div>
            </div>
            <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total SKUs</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {new Set(filteredData.map(item => item.code).filter(Boolean)).size}
                  </p>
                </div>
                <Package className="text-green-500" size={32} />
              </div>
            </div>
            <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Preço Médio</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    R$ {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + Number(item.gross_price || 0), 0) / filteredData.length).toFixed(2) : '0.00'}
                  </p>
                </div>
                <DollarSign className="text-yellow-500" size={32} />
              </div>
            </div>
            <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm card-pronutrition hover-lift transition-colors duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Margem Média</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + Number(item.margin_budget || 0), 0) / filteredData.length).toFixed(1) : '0.0'}%
                  </p>
                </div>
                <TrendingUp className="text-purple-500" size={32} />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg p-6 shadow-sm mb-6 transition-colors duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Filtros
                </h3>
              </div>
              {(filters.client || filters.sku || filters.category || filters.subcategory || filters.size || filters.datasulCode || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => setFilters({
                  client: '',
                  sku: '',
                  category: '',
                  subcategory: '',
                  size: '',
                  dateFrom: '',
                  dateTo: '',
                  datasulCode: ''
                })}
                className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-full transition-colors"
              >
                <X size={14} />
                Limpar Filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  SKU
                </label>
                <SearchableSelect
                  options={skuOptions}
                  value={filters.sku}
                  onChange={(value) => handleFilterChange('sku', value)}
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
                  value={filters.client}
                  onChange={(value) => handleFilterChange('client', value)}
                  placeholder="Todos os clientes"
                  searchPlaceholder="Buscar cliente..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Código Datasul
                </label>
                <input
                  type="text"
                  value={filters.datasulCode}
                  onChange={(e) => handleFilterChange('datasulCode', e.target.value)}
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
                  value={filters.category}
                  onChange={(value) => handleFilterChange('category', value)}
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
                  value={filters.subcategory}
                  onChange={(value) => handleFilterChange('subcategory', value)}
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
                  value={filters.size}
                  onChange={(value) => handleFilterChange('size', value)}
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
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Data Final
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 rounded-lg shadow-sm overflow-hidden transition-colors duration-200">
            <div className="overflow-auto h-[calc(100vh-250px)]">
              <table className="w-full min-w-[2150px]">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-40 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 z-50 bg-gray-50 dark:bg-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tamanho
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Gestora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Preço liquido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Preço bruto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Moeda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margem (Orçada)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vigência
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mês
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status CS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subcategoria
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('markup_ponta')}>
                      <div className="flex items-center justify-end gap-1">
                        Markup ponta
                        {sortKey === 'markup_ponta' && <ChevronsUpDown size={14} />}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-50 bg-gray-50 dark:bg-gray-800 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#0a0a0a] divide-y divide-gray-200 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan="18" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="18" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Nenhum dado encontrado
                      </td>
                    </tr>
                  ) : (
                    sortedData.map((item) => {
                      const info = markupPorLinha.get(item.id);
                      const statusOk = info && info.resultado && info.resultado.status === MARKUP_STATUS.OK;
                      return (
                      <tr
                        key={item.id}
                        className={`group hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors ${statusOk ? 'cursor-pointer' : ''}`}
                        onClick={() => abrirRetailDetailSeOk(item)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 z-30 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          {item.clients?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.size || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.manager || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.code || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {parsePriceNumber(item.db_net_price ?? item.net_price) === null
                            ? '-'
                            : `${item.currency === 'USD' ? '$' : 'R$'} ${parsePriceNumber(item.db_net_price ?? item.net_price).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-gray-100">
                          {parsePriceNumber(item.db_gross_price ?? item.gross_price) === null
                            ? '-'
                            : `${item.currency === 'USD' ? '$' : 'R$'} ${parsePriceNumber(item.db_gross_price ?? item.gross_price).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.currency === 'USD' ? 'Dólar' : 'Real'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {(Number(item.margin_budget) || 0).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {canEdit ? (
                            <button
                              onClick={() => handleToggleVigency(item)}
                              className="inline-flex rounded-md transition-opacity"
                              title="Clique para alternar vigência"
                            >
                              {item.isCurrent ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none dark:bg-green-900/30 dark:text-green-400">Atual</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-gray-500 dark:text-gray-400 dark:bg-gray-800">Histórico</Badge>
                              )}
                            </button>
                          ) : item.isCurrent ? (
                            <Badge className="bg-green-100 text-green-800 border-none dark:bg-green-900/30 dark:text-green-400">Atual</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-gray-500 dark:text-gray-400 dark:bg-gray-800">Histórico</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.month || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.gate ? `Gate ${item.gate}` : (item.date ? `Gate ${calculateGate(new Date(item.date).getMonth())}` : '-')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.readjustment_status ? (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                              WORKFLOW_STATUS_OPTIONS.find(opt => opt.value === item.readjustment_status)?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                            }`}>
                              {item.readjustment_status}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.subcategory || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <TooltipProvider>
                            {(() => {
                              const info = markupPorLinha.get(item.id);
                              const r = info && info.resultado;
                              if (!r) {
                                return <span className="text-gray-400">—</span>;
                              }
                              if (r.status === MARKUP_STATUS.OK) {
                                const tier = resolveMarkupTier(r.markup);
                                const formatted = formatMarkup(r.markup);
                                const pal = getTierColor(tier);
                                const bg = pal.bg;
                                const fg = pal.fg;
                                return (
                                  <div className="flex flex-col items-end gap-1">
                                    <span
                                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                                      style={{ backgroundColor: bg, color: fg }}
                                    >
                                      {formatted}
                                    </span>
                                    {info.coletaData && !Number.isNaN(info.coletaData.getTime()) ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={`text-[11px] ${info.proMaisRecente ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}
                                          >
                                            {format(info.coletaData, 'dd/MM/yyyy', { locale: ptBR })}
                                          </span>
                                        </TooltipTrigger>
                                        {info.proMaisRecente ? (
                                          <TooltipContent>
                                            <p>Preço PRO mais recente que a coleta de ponta</p>
                                          </TooltipContent>
                                        ) : null}
                                      </Tooltip>
                                    ) : null}
                                  </div>
                                );
                              }
                              if (r.status === MARKUP_STATUS.SEM_PONTA) {
                                return <span className="text-gray-400">—</span>;
                              }
                              if (r.status === MARKUP_STATUS.MOEDA_DIVERGENTE) {
                                return (
                                  <div className="flex flex-col items-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-end text-amber-600 dark:text-amber-400 cursor-help">
                                          <AlertCircle size={18} />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Moeda do preço PRO difere da moeda de ponta</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {info.coletaData && !Number.isNaN(info.coletaData.getTime()) ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={`text-[11px] ${info.proMaisRecente ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}
                                          >
                                            {format(info.coletaData, 'dd/MM/yyyy', { locale: ptBR })}
                                          </span>
                                        </TooltipTrigger>
                                        {info.proMaisRecente ? (
                                          <TooltipContent><p>Preço PRO mais recente que a coleta de ponta</p></TooltipContent>
                                        ) : null}
                                      </Tooltip>
                                    ) : null}
                                  </div>
                                );
                              }
                              if (
                                r.status === MARKUP_STATUS.MOEDA_INVALIDA ||
                                r.status === MARKUP_STATUS.PONTA_INVALIDA ||
                                r.status === MARKUP_STATUS.PRO_INVALIDO
                              ) {
                                return (
                                  <div className="flex flex-col items-end gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-end text-red-600 dark:text-red-400 cursor-help">
                                          <AlertCircle size={18} />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Não foi possível calcular o markup</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    {info.coletaData && !Number.isNaN(info.coletaData.getTime()) ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span
                                            className={`text-[11px] ${info.proMaisRecente ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}
                                          >
                                            {format(info.coletaData, 'dd/MM/yyyy', { locale: ptBR })}
                                          </span>
                                        </TooltipTrigger>
                                        {info.proMaisRecente ? (
                                          <TooltipContent><p>Preço PRO mais recente que a coleta de ponta</p></TooltipContent>
                                        ) : null}
                                      </Tooltip>
                                    ) : null}
                                  </div>
                                );
                              }
                              return <span className="text-gray-400">—</span>;
                            })()}
                          </TooltipProvider>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help text-gray-400 hover:text-gray-600 flex justify-center">
                                  <Clock size={16} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Última alteração por: {item.updated_by || 'Sistema'}</p>
                                <p>Em: {item.updated_at ? format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm') : (item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm') : '-')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm sticky right-0 z-30 bg-white dark:bg-[#0a0a0a] group-hover:bg-gray-50 dark:group-hover:bg-gray-900 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/pricing/analytics?sku=${encodeURIComponent(item.sku)}&client=${encodeURIComponent(item.client_id)}`)}
                              className="p-2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                              style={{ color: 'var(--color-success)' }}
                              title="Ver Analytics"
                            >
                              <BarChart3 size={16} />
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                                  style={{ color: 'var(--color-info)' }}
                                  title="Editar"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(item)}
                                  className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors transition-transform hover:scale-105 active:scale-95"
                                  style={{ color: 'var(--color-danger)' }}
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>
      )}

        {/* Modal de Detalhe de Preço de Ponta */}
        {retailDetailOpen && skuAtualDetail && (() => {
          const info = markupPorLinha.get(skuAtualDetail.id);
          if (!info || !info.resultado || info.resultado.status !== MARKUP_STATUS.OK) return null;
          const resultado = info.resultado;
          const ponta = info.ponta;
          const precoPro = Number(skuAtualDetail.gross_price);
          const moedaPro = skuAtualDetail.currency || 'BRL';
          const precoPonta = ponta && Number.isFinite(Number(ponta.retail_price)) ? Number(ponta.retail_price) : null;
          const moedaPonta = ponta ? ponta.currency || 'BRL' : 'BRL';
          const dataColeta = ponta ? ponta.collected_at : null;
          const fonte = ponta ? ponta.source : null;

          const tier = resultado.tier;
          const pal = getTierColor(tier);
          const pillBg = pal.bg;
          const pillFg = pal.fg;

          const razao = (precoPro != null && precoPonta && Number.isFinite(precoPonta) && precoPonta > 0)
            ? precoPro / precoPonta : 0;
          const larguraProPct = Math.max(6, razao * 100);

          let spreadAbsoluto = null;
          if (precoPonta != null && precoPro != null && Number.isFinite(precoPonta) && Number.isFinite(precoPro)) {
            spreadAbsoluto = precoPonta - precoPro;
          }
          const participacaoProPct = (precoPro != null && precoPonta && Number.isFinite(precoPonta) && precoPonta > 0)
            ? (precoPro / precoPonta) * 100 : null;

          const clientId = skuAtualDetail.client_id;
          const skusDoCliente = clientId ? (markupPorCliente.get(clientId) || []) : [];
          const mostrarListaCliente = skusDoCliente.length > 1;
          let mediaMarkupCliente = null;
          let qtdSkusComColeta = 0;
          if (mostrarListaCliente) {
            let soma = 0;
            let n = 0;
            for (const s of skusDoCliente) {
              if (Number.isFinite(s.markup) && s.markup > 0) {
                soma += s.markup;
                n += 1;
              }
            }
            qtdSkusComColeta = n;
            if (n > 0) mediaMarkupCliente = soma / n;
          }

          return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={fecharRetailDetail}
          >
            <div
              className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full p-2 shrink-0" style={{ backgroundColor: pillBg }}>
                      <Tag className="w-5 h-5" style={{ color: pillFg }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                        Preço de ponta · {skuAtualDetail.sku || 'SKU sem nome'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {skuAtualDetail.clients?.name || 'Cliente não identificado'} · código {skuAtualDetail.code || '-'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fecharRetailDetail}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Conteúdo com scroll */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Três cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Preço PRO (bruto)
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatCurrencyLocal(precoPro, moedaPro)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Preço de ponta
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {precoPonta != null ? formatCurrencyLocal(precoPonta, moedaPonta) : '-'}
                    </p>
                  </div>
                  <div
                    className="rounded-lg border p-4"
                    style={{
                      borderColor: pal.border,
                      borderWidth: '2px',
                      backgroundColor: pillBg,
                    }}
                  >
                    <p
                      className="text-xs font-medium uppercase tracking-wider mb-2"
                      style={{ color: pillFg }}
                    >
                      Markup
                    </p>
                    <p className="text-2xl font-extrabold" style={{ color: pillFg }}>
                      {formatMarkup(resultado.markup)}
                    </p>
                  </div>
                </div>

                {/* Comparativo barras */}
                <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Preço ponta</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {precoPonta != null ? formatCurrencyLocal(precoPonta, moedaPonta) : '-'}
                      </span>
                    </div>
                    <div className="w-full h-6 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full flex items-center px-3 text-xs font-semibold text-white whitespace-nowrap"
                        style={{
                          width: '100%',
                          backgroundColor: COR_ROXO_PONTA,
                        }}
                      >
                        {precoPonta != null ? formatCurrencyLocal(precoPonta, moedaPonta) : ''}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Preço PRO</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {formatCurrencyLocal(precoPro, moedaPro)}
                      </span>
                    </div>
                    <div className="w-full h-6 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full flex items-center px-3 text-xs font-semibold text-white whitespace-nowrap"
                        style={{
                          width: `${larguraProPct}%`,
                          minWidth: '6%',
                          backgroundColor: COR_VERDE_PRO,
                        }}
                      >
                        {formatCurrencyLocal(precoPro, moedaPro)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha de contexto */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Spread absoluto na cadeia
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {spreadAbsoluto != null ? formatCurrencyLocal(spreadAbsoluto, moedaPonta || moedaPro) : '-'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Participação PRO no preço final
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {participacaoProPct != null
                        ? `${participacaoProPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Markup por SKU do cliente */}
                {mostrarListaCliente && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Markup por SKU do cliente
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Média dos SKUs com coleta:{' '}
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatMarkup(mediaMarkupCliente) || '-'}
                        </span>
                        {' · '}
                        <span className="font-medium">{qtdSkusComColeta}</span>
                        {' '}SKU{qtdSkusComColeta === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {skusDoCliente
                        .slice()
                        .sort((a, b) => (b.markup || 0) - (a.markup || 0))
                        .map((s) => {
                          const isAberto = s.id === skuAtualDetail.id;
                          const sp = getTierColor(s.tier);
                          const barBg = sp.bg;
                          const barFg = sp.fg;
                          const largBarra = Math.min(100, ((s.markup || 0) / 8) * 100);
                          return (
                            <div
                              key={s.id}
                              className={`rounded-md p-3 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/30 ${isAberto ? 'ring-1 ring-offset-1 ring-[#845AFA]/60' : 'opacity-70'}`}
                            >
                              <div className="flex items-center justify-between mb-1.5 gap-2">
                                <div className="flex items-baseline gap-2 min-w-0">
                                  <span className={`text-sm font-semibold truncate ${isAberto ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                    {s.sku || 'SKU sem nome'}
                                  </span>
                                  <span className="text-[11px] text-gray-400 shrink-0">
                                    {s.code || ''}
                                  </span>
                                </div>
                                <span
                                  className="text-sm font-bold shrink-0"
                                  style={{ color: barFg }}
                                >
                                  {formatMarkup(s.markup)}
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${largBarra}%`,
                                    backgroundColor: barFg,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé do conteúdo */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-gray-500 dark:text-gray-400">
                      Data da coleta
                      <span className="ml-1 font-medium text-gray-700 dark:text-gray-200">
                        {dataColeta && !Number.isNaN(new Date(dataColeta).getTime())
                          ? format(new Date(dataColeta), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </span>
                      {info.proMaisRecente && (
                        <span
                          className="ml-2 font-semibold inline-flex items-center gap-1"
                          style={{ color: '#B45309' }}
                          title="Preço PRO mais recente que a coleta de ponta"
                        >
                          <AlertCircle size={12} />
                          Preço PRO mais recente que a coleta de ponta
                        </span>
                      )}
                    </p>
                    {fonte && (
                      <p className="text-gray-500 dark:text-gray-400">
                        Fonte: <span className="font-medium text-gray-700 dark:text-gray-200">{fonte}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={fecharRetailDetail}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Modal de Novo Preço */}
        {showNewPriceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#171717] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col mx-auto shadow-xl border dark:border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-800 shrink-0 bg-white dark:bg-[#171717]">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingId ? 'Editar Preço' : 'Novo Preço'}
                </h2>
                <button
                  onClick={() => {
                    setShowNewPriceModal(false);
                    setEditingId(null);
                    setBasePriceId('');
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <form onSubmit={handleNewPriceSubmit} id="newPriceForm" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {!editingId && (
                      <div className="col-span-2 mb-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Upload size={16} className="text-gray-500" />
                          Usar preço existente como base
                        </label>
                        <SearchableSelect
                          options={basePriceOptions}
                          value={basePriceId}
                          onChange={handleBasePriceChange}
                          placeholder="Selecione um preço para copiar..."
                          searchPlaceholder="Buscar por SKU, cliente..."
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Cliente *
                      </label>
                      <select
                        value={newPriceForm.client_id}
                        onChange={(e) => handleNewPriceChange('client_id', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Selecione um cliente</option>
                        {clients.map(client => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        SKU *
                      </label>
                      <input
                        type="text"
                        value={newPriceForm.sku}
                        onChange={(e) => handleNewPriceChange('sku', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="Digite o SKU"
                      />
                    </div>
                    
                    {/* Novos Campos */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Código
                      </label>
                      <input
                        type="text"
                        value={newPriceForm.code}
                        onChange={(e) => handleNewPriceChange('code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="Código Datasul"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Gestora
                      </label>
                      <input
                        type="text"
                        value={newPriceForm.manager}
                        onChange={(e) => handleNewPriceChange('manager', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="Gestora"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Tamanho
                      </label>
                      <input
                        type="text"
                        value={newPriceForm.size}
                        onChange={(e) => handleNewPriceChange('size', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="Ex: 1, 2, 3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Categoria
                      </label>
                      <select
                        value={newPriceForm.category}
                        onChange={(e) => handleNewPriceChange('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Selecione uma categoria</option>
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Subcategoria
                      </label>
                      <select
                        value={newPriceForm.subcategory}
                        onChange={(e) => handleNewPriceChange('subcategory', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Selecione uma subcategoria</option>
                        {SUBCATEGORY_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Mês
                      </label>
                      <input
                        type="date"
                        value={newPriceForm.month}
                        onChange={(e) => handleNewPriceChange('month', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Preço Líquido *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPriceForm.net_price}
                        onChange={(e) => handleNewPriceChange('net_price', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Preço Bruto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPriceForm.gross_price}
                        onChange={(e) => handleNewPriceChange('gross_price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Margem Orçada (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newPriceForm.margin_budget}
                        onChange={(e) => handleNewPriceChange('margin_budget', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Moeda
                      </label>
                      <select
                        value={newPriceForm.currency}
                        onChange={(e) => handleNewPriceChange('currency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="BRL">Real (R$)</option>
                        <option value="USD">Dólar ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Data *
                      </label>
                      <input
                        type="date"
                        value={newPriceForm.date}
                        onChange={(e) => handleNewPriceChange('date', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Observações
                      </label>
                      <textarea
                        value={newPriceForm.obs}
                        onChange={(e) => handleNewPriceChange('obs', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        rows="3"
                        placeholder="Observações opcionais"
                      />
                    </div>
                  </div>
                </form>
              </div>
              <div className="p-6 border-t dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a1a] rounded-b-lg flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPriceModal(false);
                    setEditingId(null);
                    setBasePriceId('');
                    setNewPriceForm({
                      client_id: '',
                      sku: '',
                      net_price: '',
                      gross_price: '',
                      margin_budget: '',
                      size: '',
                      manager: '',
                      code: '',
                      category: '',
                      subcategory: '',
                      month: '',
                      date: new Date().toISOString().split('T')[0],
                      obs: '',
                      currency: 'BRL'
                    });
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="newPriceForm"
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#171717] dark:border dark:border-gray-800 rounded-lg p-6 w-full max-w-md mx-auto shadow-xl transition-colors duration-200">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Confirmar Exclusão
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors hover:bg-red-600 text-white"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#171717] dark:border dark:border-gray-800 rounded-lg p-6 w-full max-w-md mx-4 transition-colors duration-200">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                Importar Excel
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Arquivo Excel
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  {importFile && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Arquivo selecionado: {importFile.name}
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>Formato esperado das colunas:</p>
                  <ul className="list-disc list-inside mt-2 grid grid-cols-2 gap-x-4">
                    <li>Cliente</li>
                    <li>Tamanho</li>
                    <li>Gestora</li>
                    <li>Código</li>
                    <li>SKU</li>
                    <li>Preço liquido</li>
                    <li>Preço bruto</li>
                    <li>Moeda</li>
                    <li>Margem (Orçada)</li>
                    <li>Mês</li>
                    <li>Categoria</li>
                    <li>Subcategoria</li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-info)', color: 'white' }}
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal de Gerenciamento de Aliases */}
        {showAliasManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#171717] dark:border dark:border-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto transition-colors duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Gerenciar Depara de Clientes
                </h2>
                <button
                  onClick={() => setShowAliasManager(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-transform hover:scale-110"
                >
                  ✕
                </button>
              </div>
              <ClientAliasManager user={user} refreshAliases={loadData} />
            </div>
          </div>
        )}
    </div>
  );
};

export default PricingDashboard;
