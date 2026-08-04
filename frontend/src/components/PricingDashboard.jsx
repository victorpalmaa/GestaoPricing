import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Download, Upload, TrendingUp, DollarSign, Users, Package, Settings, BarChart3, LogOut, ArrowLeft, Edit2, Trash2, Briefcase, Filter, Search, Check, ChevronsUpDown, X, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
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

  const CATEGORY_OPTIONS = ['Pó', 'Gel', 'Pastilha', 'Cápsula', 'Goma', 'Softgel'];
  const SUBCATEGORY_OPTIONS = ['Goma', 'Cápsula', 'Colágeno', 'Creatina', 'Gel', 'Glutamina', 'Outros', 'Pastilha', 'Proteína'];

  const isSuper = canWrite;
  const canEdit = canWrite;

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

  const getGroupKey = (clientId, sku) => `${clientId}::${(sku || '').toString().trim().toUpperCase()}`;

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

  const setCurrentPriceForSku = async ({ clientId, sku, currentId }) => {
    const { error: clearError } = await supabase
      .from('pricing_history')
      .update({ is_current: false })
      .eq('client_id', clientId)
      .eq('sku', sku)
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
        const key = getGroupKey(item.client_id, item.sku);
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
          isCurrent: item.id === currentIdMap.get(getGroupKey(item.client_id, item.sku))
        };
      });

      setPricingData(enrichedData);

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
              code: row['code']?.toString().trim() || null,
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
    if (!newPriceForm.client_id || !newPriceForm.sku || !newPriceForm.net_price || !newPriceForm.date) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
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
        code: newPriceForm.code?.trim() || null,
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

      // Regra de vigência: novo preço cadastrado para o mesmo SKU/cliente vira o atual.
      if (!editingId && savedRowId) {
        await setCurrentPriceForSku({
          clientId: priceData.client_id,
          sku: priceData.sku,
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

  const handleToggleVigency = async (item) => {
    if (!canEdit || !item?.id) return;

    try {
      const { data: skuRows, error } = await supabase
        .from('pricing_history')
        .select('*')
        .eq('client_id', item.client_id)
        .eq('sku', item.sku);

      if (error) throw error;

      const sortedRows = [...(skuRows || [])].sort(comparePricingRows);

      if (item.isCurrent) {
        const nextCurrent = sortedRows.find(row => row.id !== item.id);
        if (!nextCurrent) {
          toast.warning('Não é possível remover o único preço vigente deste SKU.');
          return;
        }

        await setCurrentPriceForSku({
          clientId: item.client_id,
          sku: item.sku,
          currentId: nextCurrent.id
        });
        toast.success('Preço movido para histórico com sucesso.');
      } else {
        await setCurrentPriceForSku({
          clientId: item.client_id,
          sku: item.sku,
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
              <table className="w-full min-w-[2000px]">
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
                      <td colSpan="13" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        Nenhum dado encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
