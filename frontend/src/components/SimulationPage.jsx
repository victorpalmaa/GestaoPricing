import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase, cn } from '@/lib/utils';
import {
  calculateGrossPriceFromNetPrice,
  calculateMarginFromGrossPrice,
  estimateMarginFromGrossPrice,
  formatMarginPercentInputValue,
  calculateNetPriceFromGrossPrice,
  normalizeMarginPercentInput,
  roundCurrency,
  solveDisplayedPriceByMargin,
  toRate,
} from '@/utils/simulationPricing';
import Header from './Header';
import SearchableSelect from './SearchableSelect';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, RefreshCcw, TrendingUp, DollarSign, Percent, History, Info, Map as MapIcon, Check, XCircle, Trash2, X, AlertTriangle, Upload, FileText, Target } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { logImport } from '@/utils/activityLog';
import { parseVbaVersaoLabel, reconcileVbaCatalogRow } from '@/utils/catalogImportReconciliation';
import { getPermissionErrorMessage, isPermissionError } from '@/utils/permissionErrors';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const MINIMUM_POLICY_STATUS = {
  NOT_CONFIGURED: 'not_configured',
  WITHIN_POLICY: 'within_policy',
  BELOW_MINIMUM_PRICE: 'below_minimum_price',
  BELOW_MINIMUM_MARGIN: 'below_minimum_margin',
  BELOW_BOTH: 'below_minimum_price_and_margin',
};

const SIMULATION_MODES = {
  MARGIN: 'simularMargem',
  PRICE: 'simularPreco',
  FREIGHT: 'simularFrete',
  GROSS_CALCULATION: 'calculoPrecoBruto',
  NET_CALCULATION: 'calculoPrecoLiquido',
};

const normalizeLookupValue = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const CLIENTS_PAGE_SIZE = 1000;

const loadAllRows = async (tableName, selectClause, orderColumn) => {
  let rows = [];
  let from = 0;

  while (true) {
    const to = from + CLIENTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select(selectClause)
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const batch = data || [];
    rows = rows.concat(batch);

    if (batch.length < CLIENTS_PAGE_SIZE) {
      break;
    }

    from += CLIENTS_PAGE_SIZE;
  }

  return rows;
};

const loadAllClients = async () => {
  return loadAllRows('clients', 'id, name', 'name');
};

const loadAllClientAliases = async () => {
  return loadAllRows('client_aliases', 'id, client_id, alias_name, clients(name)', 'alias_name');
};

const DRE_APPROVED_MARGINS = [
  { category: 'Pó', margin: '20,32%' },
  { category: 'Gel', margin: '48,41%' },
  { category: 'Cápsulas', margin: '8,56%' },
  { category: 'Pastilha', margin: '57,09%' },
  { category: 'Dr Simi', margin: '45,91%' },
];

const parseSpreadsheetNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  let normalized = String(value).replace(/[R$\s]/g, '').trim();
  if (!normalized) return null;

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const evaluateMinimumPolicy = ({ rule, grossPrice, margin }) => {
  if (!rule) {
    return {
      hasRule: false,
      isBlocked: false,
      status: MINIMUM_POLICY_STATUS.NOT_CONFIGURED,
      minimumGrossPrice: null,
      minimumMargin: null,
      belowPrice: false,
      belowMargin: false,
      message: 'Nenhuma regra minima foi cadastrada para este SKU/volume.',
    };
  }

  const minimumGrossPrice = Number(rule.precobruto || 0);
  const minimumMargin = Number(rule.margem || 0);
  const simulatedGrossPrice = roundCurrency(grossPrice || 0);
  const simulatedMargin = roundCurrency(normalizeMarginPercentInput(margin || 0));
  const roundedMinimumGrossPrice = roundCurrency(minimumGrossPrice);
  const roundedMinimumMargin = roundCurrency(minimumMargin);

  const belowPrice = roundedMinimumGrossPrice > 0 && simulatedGrossPrice < (roundedMinimumGrossPrice - 0.01 - 0.0001);
  const belowMargin = roundedMinimumMargin > 0 && simulatedMargin < (roundedMinimumMargin - 0.0001);

  let status = MINIMUM_POLICY_STATUS.WITHIN_POLICY;
  if (belowPrice && belowMargin) {
    status = MINIMUM_POLICY_STATUS.BELOW_BOTH;
  } else if (belowPrice) {
    status = MINIMUM_POLICY_STATUS.BELOW_MINIMUM_PRICE;
  } else if (belowMargin) {
    status = MINIMUM_POLICY_STATUS.BELOW_MINIMUM_MARGIN;
  }

  const reasons = [];
  if (belowPrice) {
    reasons.push(`o preco bruto minimo permitido e ${roundedMinimumGrossPrice.toFixed(2)}`);
  }
  if (belowMargin) {
    reasons.push(`a margem minima permitida e ${roundedMinimumMargin.toFixed(2)}%`);
  }

  return {
    hasRule: true,
    isBlocked: belowPrice || belowMargin,
    status,
    minimumGrossPrice: roundedMinimumGrossPrice,
    minimumMargin: roundedMinimumMargin,
    belowPrice,
    belowMargin,
    message:
      reasons.length > 0
        ? `Esta simulacao nao pode ser salva porque ficou fora da politica minima cadastrada: ${reasons.join(' e ')}.`
        : 'Simulacao dentro da politica minima cadastrada.',
  };
};

const SimulationPage = ({ user }) => {
  const { isPricing, user: authUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  
  // State from navigation
  const initialState = location.state || {};
  
  const [selectedProductSku, setSelectedProductSku] = useState(initialState.sku || initialState.code || '');
  const [selectedVolume, setSelectedVolume] = useState(initialState.volume ? String(initialState.volume) : '');
  const [sku, setSku] = useState(initialState.sku || '');
  const [productName, setProductName] = useState(initialState.productName || '');
  const [cost, setCost] = useState(initialState.initialCost || '');
  const [price, setPrice] = useState(initialState.initialPrice || '');
  const [margin, setMargin] = useState(() => formatMarginPercentInputValue(initialState.initialMargin));
  const [pis, setPis] = useState(1.65);
  const [cofins, setCofins] = useState(7.60);
  const [icms, setIcms] = useState(12.00);
  const [comissao, setComissao] = useState(0);
  const [frete, setFrete] = useState(0);
  const [encargo, setEncargo] = useState(1.5);
  const [ipi, setIpi] = useState(0);
  const [grossPrice, setGrossPrice] = useState('');
  const [mode, setMode] = useState(SIMULATION_MODES.MARGIN);
  const [calculationError, setCalculationError] = useState('');
  
  const [history, setHistory] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('idle');
  const [catalogError, setCatalogError] = useState('');
  const [clients, setClients] = useState([]);
  const [clientAliases, setClientAliases] = useState([]);
  const [minimumRules, setMinimumRules] = useState([]);
  const [minimumRulesStatus, setMinimumRulesStatus] = useState('idle');
  const [minimumRulesError, setMinimumRulesError] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [importingMinimumRules, setImportingMinimumRules] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDreInfoModal, setShowDreInfoModal] = useState(false);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedBaseClient, setSelectedBaseClient] = useState(null);
  const [saveForm, setSaveForm] = useState({
    clientName: '',
    target: '',
    observations: ''
  });
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [hasManualInput, setHasManualInput] = useState(false);
  const [isClosingHistoryDetailModal, setIsClosingHistoryDetailModal] = useState(false);
  const [decisionEffect, setDecisionEffect] = useState({ visible: false, status: '', tokens: [], logoTokens: [] });
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showHistoryObservations, setShowHistoryObservations] = useState(false);
  const minimumRulesImportInputRef = useRef(null);
  
  const isPricingUser = isPricing;
  const canDeleteHistoryItem = useCallback((item) => {
    if (!item?.id || !authUser?.id) {
      return false;
    }

    return isPricingUser || item.user_id === authUser.id;
  }, [authUser?.id, isPricingUser]);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogStatus('loading');
      setCatalogError('');

      const { data, error } = await supabase
        .from('catalog_br_prices')
        .select('*')
        .order('sku', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Catálogo Brasil indisponível ou sem itens cadastrados.');
      }

      setCatalogProducts(data);
      setCatalogStatus('success');
    } catch (err) {
      console.error('Error fetching catalog:', err);
      setCatalogProducts([]);
      setCatalogStatus('error');
      setCatalogError('Não foi possível carregar o catálogo Brasil. Os valores não podem ser calculados no momento.');
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const loadMinimumRules = useCallback(async () => {
    try {
      setMinimumRulesStatus('loading');
      setMinimumRulesError('');

      const { data, error } = await supabase
        .from('simulation_minimum_price_rules')
        .select('*')
        .order('versao', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;

      setMinimumRules(data || []);
      setMinimumRulesStatus('success');
    } catch (err) {
      console.error('Error fetching minimum rules:', err);
      setMinimumRules([]);
      setMinimumRulesStatus('error');
      setMinimumRulesError('Não foi possível carregar as regras mínimas de preço. A simulação está bloqueada no momento.');
    }
  }, []);

  useEffect(() => {
    loadMinimumRules();
  }, [loadMinimumRules]);

  const retrySimulationDependencies = useCallback(async () => {
    await Promise.all([loadCatalog(), loadMinimumRules()]);
  }, [loadCatalog, loadMinimumRules]);

  useEffect(() => {
    const loadClientData = async () => {
      try {
        setLoadingClients(true);
        const [clientsData, aliasesData] = await Promise.all([
          loadAllClients(),
          loadAllClientAliases(),
        ]);
        setClients(clientsData);
        setClientAliases(aliasesData);
      } catch (error) {
        console.error('Error loading clients:', error);
        setClients([]);
        setClientAliases([]);
      } finally {
        setLoadingClients(false);
      }
    };

    loadClientData();
  }, []);

  // Generate options for the select
  const productOptions = useMemo(() => {
    const grouped = new Map();
    (catalogProducts || []).forEach(item => {
      const skuName = item.sku ? String(item.sku).trim() : '';
      if (!skuName) return;
      if (!grouped.has(skuName)) {
        grouped.set(skuName, { sku: skuName, codes: new Set() });
      }
      if (item.datasul_code) {
        grouped.get(skuName).codes.add(String(item.datasul_code).trim());
      }
    });

    return Array.from(grouped.values()).map(item => {
      const codes = Array.from(item.codes).filter(Boolean);
      return {
        value: item.sku,
        label: item.sku,
        keywords: `${item.sku} ${codes.join(' ')}`
      };
    });
  }, [catalogProducts]);

  const volumeOptions = useMemo(() => {
    if (!selectedProductSku) {
      return ['1000', '1500', '3000', '5000'];
    }
    const volumes = [...new Set(
      (catalogProducts || [])
        .filter(item => String(item.sku || '').trim() === String(selectedProductSku).trim())
        .map(item => String(item.volume || '').trim())
        .filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));
    return volumes.length > 0 ? volumes : ['1000', '1500', '3000', '5000'];
  }, [catalogProducts, selectedProductSku]);

  const selectedCatalogEntry = useMemo(() => {
    if (!selectedProductSku || !selectedVolume) return null;
    return (catalogProducts || []).find(item =>
      String(item.sku || '').trim() === String(selectedProductSku).trim()
      && String(item.volume || '').trim() === String(selectedVolume).trim()
    ) || null;
  }, [catalogProducts, selectedProductSku, selectedVolume]);

  const selectedMinimumRule = useMemo(() => {
    const selectedName = normalizeLookupValue(selectedCatalogEntry?.sku || productName || selectedProductSku || '');
    const selectedVolumeValue = Number(selectedVolume || 0);
    if (!selectedName || !selectedVolumeValue) return null;

    return (minimumRules || []).find((rule) => {
      return normalizeLookupValue(rule.versao) === selectedName
        && Number(rule.volume || 0) === selectedVolumeValue;
    }) || null;
  }, [minimumRules, selectedCatalogEntry, productName, selectedProductSku, selectedVolume]);

  const simulationPolicy = useMemo(() => {
    return evaluateMinimumPolicy({
      rule: selectedMinimumRule,
      grossPrice,
      margin,
    });
  }, [selectedMinimumRule, grossPrice, margin]);

  useEffect(() => {
    if (!selectedProductSku || (catalogProducts || []).length === 0) return;
    const hasSkuMatch = (catalogProducts || []).some(item =>
      String(item.sku || '').trim() === String(selectedProductSku).trim()
    );
    if (hasSkuMatch) return;

    const matchByCode = (catalogProducts || []).find(item =>
      String(item.datasul_code || '').trim() === String(selectedProductSku).trim()
    );

    if (matchByCode?.sku) {
      setSelectedProductSku(matchByCode.sku);
      setSku(matchByCode.sku);
      setProductName(matchByCode.sku);
    }
  }, [catalogProducts, selectedProductSku]);

  // Handle product selection
  const handleProductSelect = (selectedCode) => {
    setSelectedProductSku(selectedCode);
    setSelectedVolume('');
    const firstMatch = (catalogProducts || []).find(item =>
      String(item.sku || '').trim() === String(selectedCode || '').trim()
    );
    if (firstMatch?.sku) {
      setSku(firstMatch.sku);
      setProductName(firstMatch.sku);
    }
  };

  useEffect(() => {
    if (!selectedCatalogEntry) return;

    const formatValue = (val) => {
      if (val === null || val === undefined || val === '') return '0.00';
      const num = Number(val);
      return Number.isNaN(num) ? '0.00' : num.toFixed(2);
    };

    setSku(selectedCatalogEntry.sku || '');
    setProductName(selectedCatalogEntry.sku || '');
    setCost(formatValue(selectedCatalogEntry.catalog_cost));
    setPrice(formatValue(selectedCatalogEntry.catalog_price));
    setMargin(formatMarginPercentInputValue(selectedCatalogEntry.catalog_margin));
    setGrossPrice(formatValue(selectedCatalogEntry.catalog_gross_price || selectedCatalogEntry.catalog_price));
    setHasManualInput(false);
  }, [selectedCatalogEntry]);

  // Calculate on change
  useEffect(() => {
    const costNum = Number(cost) || 0;
    const priceNum = Number(price) || 0;
    const marginNum = normalizeMarginPercentInput(margin);

    calculate(costNum, priceNum, marginNum);
  }, [price, margin, cost, mode, pis, cofins, icms, grossPrice, comissao, frete, encargo, ipi]);

  useEffect(() => {
    if (mode !== SIMULATION_MODES.FREIGHT) {
      setFrete(0);
    }
  }, [mode]);

  // Load history on mount
  useEffect(() => {
      loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('simulations_history')
        .select('*')
        .neq('mode', 'import') // Exclude imported data
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      const baseHistory = data || [];
      const userIds = [...new Set(baseHistory.map(item => item.user_id).filter(Boolean))];
      const userEmails = [...new Set(baseHistory.map(item => String(item.user_email || '').trim().toLowerCase()).filter(Boolean))];

      let usersById = {};
      let usersByEmail = {};
      if (userIds.length > 0 || userEmails.length > 0) {
        const [usersByIdResult, usersByEmailResult] = await Promise.all([
          userIds.length > 0
            ? supabase
                .from('users')
                .select('id, nome, email')
                .in('id', userIds)
            : Promise.resolve({ data: [] }),
          userEmails.length > 0
            ? supabase
                .from('users')
                .select('id, nome, email')
                .in('email', userEmails)
            : Promise.resolve({ data: [] })
        ]);

        const usersCombined = [...(usersByIdResult.data || []), ...(usersByEmailResult.data || [])];
        usersById = usersCombined.reduce((acc, row) => {
          if (row?.id && row?.nome) acc[row.id] = row.nome;
          return acc;
        }, {});
        usersByEmail = usersCombined.reduce((acc, row) => {
          const normalizedEmail = String(row?.email || '').trim().toLowerCase();
          if (normalizedEmail && row?.nome) acc[normalizedEmail] = row.nome;
          return acc;
        }, {});
      }

      const enrichedHistory = baseHistory.map(item => ({
        ...item,
        user_name_from_users:
          usersByEmail[String(item.user_email || '').trim().toLowerCase()] ||
          usersById[item.user_id] ||
          item.user_name ||
          null
      }));

      setHistory(enrichedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Erro ao carregar histórico de simulações');
    }
  };

  const handleBlur = (setter, value, options = {}) => {
    const normalizedValue = String(value ?? '').replace(',', '.');
    let num = parseFloat(normalizedValue);
    if (!isNaN(num)) {
      if (options.normalizePercent) {
        num = normalizeMarginPercentInput(num);
      }
      setter(num.toFixed(2));
    }
  };

  const handleMinimumRulesImportClick = () => {
    if (!isPricingUser || importingMinimumRules) return;
    minimumRulesImportInputRef.current?.click();
  };

  const handleMinimumRulesFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !isPricingUser) return;

    try {
      setImportingMinimumRules(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!Array.isArray(rows) || rows.length === 0) {
        toast.error('Planilha vazia.');
        return;
      }

      const normalizeHeader = (header) =>
        normalizeLookupValue(header)
          .replace(/[^a-z0-9]/g, '');
      const getValueByAliases = (row, aliases) => {
        const headers = Object.keys(row || {});
        const match = headers.find((header) => aliases.includes(normalizeHeader(header)));
        return match ? row[match] : '';
      };
      const hasSpreadsheetValue = (value) =>
        value !== null && value !== undefined && String(value).trim() !== '';

      const aliases = {
        id: ['id'],
        versao: ['versao', 'nome', 'produto'],
        margem: ['margem'],
        precobruto: ['precobruto', 'preco', 'precodevenda', 'precocheio'],
        volume: ['volume', 'vol'],
        custoTotal: ['custototal'],
        precoLiq: ['precoliq'],
        custoMp: ['customp'],
        custoEmb: ['custoemb'],
        custoPerda: ['custoperda'],
        custoGgf: ['custoggf'],
        custoMod: ['customod'],
        freteValor: ['fretevalor'],
        encargoValor: ['encargofinancvalor'],
        comissaoValor: ['comissaovalor'],
        impostosValor: ['impostosvalor'],
        idVersaoVba: ['idversao'],
        dataVersaoVba: ['dataversao'],
      };

      const firstRow = rows[0] || {};
      const detectedHeaders = Object.keys(firstRow).map((header) => ({
        original: String(header),
        normalized: normalizeHeader(header)
      }));
      const missingColumns = Object.entries(aliases)
        .filter(([, candidates]) => {
          return !Object.keys(firstRow).some((header) => candidates.includes(normalizeHeader(header)));
        })
        .map(([key]) => key);

      const obrigatorios = ['versao', 'margem', 'precobruto', 'volume'];
      const faltamObrigatorios = missingColumns.filter((c) => obrigatorios.includes(c));

      if (faltamObrigatorios.length > 0) {
        toast.error(`Colunas obrigatorias ausentes: ${faltamObrigatorios.join(', ')}.`);
        return;
      }

      const MINIMUM_VBA_NUMERIC_KEYS = [
        'custoMp',
        'custoEmb',
        'custoPerda',
        'custoGgf',
        'custoMod',
        'freteValor',
        'encargoValor',
        'comissaoValor',
        'impostosValor',
      ];

      const payloadByVersionAndVolume = new Map();
      let invalidRows = 0;
      let duplicatedRows = 0;
      let reconciledRows = 0;
      let importErrorDetails = [];
      let warningRows = 0;

      rows.forEach((row, idx) => {
        const versaoRaw = getValueByAliases(row, aliases.versao);
        const margem = parseSpreadsheetNumber(getValueByAliases(row, aliases.margem));
        const precobruto = parseSpreadsheetNumber(getValueByAliases(row, aliases.precobruto));
        const volume = parseSpreadsheetNumber(getValueByAliases(row, aliases.volume));
        const custoTotalRaw = getValueByAliases(row, aliases.custoTotal);
        const precoLiqRaw = getValueByAliases(row, aliases.precoLiq);
        const idVersaoVbaRaw = getValueByAliases(row, aliases.idVersaoVba);
        const dataVersaoVbaRaw = getValueByAliases(row, aliases.dataVersaoVba);
        const numericVbaRawValues = Object.fromEntries(
          MINIMUM_VBA_NUMERIC_KEYS.map((key) => [
            key,
            getValueByAliases(row, aliases[key] || []),
          ])
        );

        const rowWarnings = [];

        const parsedVersao = parseVbaVersaoLabel(versaoRaw, volume);
        const versaoFinal = parsedVersao.skuLimpo;

        if (parsedVersao.volumeExtraido !== null && parsedVersao.bateComVolume === false) {
          rowWarnings.push(
            `volume divergente: sufixo (NK) ${parsedVersao.volumeExtraido} vs coluna ${volume}`
          );
        }

        if (!versaoFinal || !Number.isFinite(volume) || (margem === null && precobruto === null)) {
          invalidRows += 1;
          if (importErrorDetails.length < 10) {
            importErrorDetails.push(
              `Linha ${idx + 2} | versao "${String(versaoRaw).trim()}" | vol ${volume} | campos obrigatórios ausentes`
            );
          }
          return;
        }

        const normalizedVersion = normalizeLookupValue(versaoFinal);
        const normalizedVolume = Number(volume);

        const hasAnyVbaData = (
          hasSpreadsheetValue(custoTotalRaw)
          || hasSpreadsheetValue(precoLiqRaw)
          || hasSpreadsheetValue(idVersaoVbaRaw)
          || hasSpreadsheetValue(dataVersaoVbaRaw)
          || Object.values(numericVbaRawValues).some(hasSpreadsheetValue)
        );

        const parsedNumericVbaValues = Object.fromEntries(
          Object.entries(numericVbaRawValues).map(([key, value]) => [
            key,
            parseSpreadsheetNumber(value),
          ])
        );
        const custoTotal = parseSpreadsheetNumber(custoTotalRaw);
        const precoLiq = parseSpreadsheetNumber(precoLiqRaw);

        let vbaPayload = {};
        if (hasAnyVbaData) {
          const todosVbaNumericosPreenchidos = MINIMUM_VBA_NUMERIC_KEYS.every(
            (key) => parsedNumericVbaValues[key] !== null
              && parsedNumericVbaValues[key] !== undefined
          );
          const podeReconciliar = todosVbaNumericosPreenchidos
            && custoTotal !== null
            && precoLiq !== null
            && precobruto !== null;

          if (podeReconciliar) {
            const reconciliation = reconcileVbaCatalogRow({
              custoMp: parsedNumericVbaValues.custoMp,
              custoEmb: parsedNumericVbaValues.custoEmb,
              custoPerda: parsedNumericVbaValues.custoPerda,
              custoGgf: parsedNumericVbaValues.custoGgf,
              custoMod: parsedNumericVbaValues.custoMod,
              freteValor: parsedNumericVbaValues.freteValor,
              encargoValor: parsedNumericVbaValues.encargoValor,
              comissaoValor: parsedNumericVbaValues.comissaoValor,
              impostosValor: parsedNumericVbaValues.impostosValor,
              custoTotal,
              precoLiq,
              precoBruto: precobruto,
              margemInformada: margem,
            });

            if (!reconciliation.ok) {
              invalidRows += 1;
              if (importErrorDetails.length < 10) {
                importErrorDetails.push(
                  `Linha ${idx + 2} | SKU ${versaoFinal} | Vol ${volume} | ${reconciliation.errors.join(' | ')}`
                );
              }
              return;
            }

            rowWarnings.push(...reconciliation.errors);
            reconciledRows += 1;

            vbaPayload = {
              custo_total: custoTotal,
              preco_liq: precoLiq,
              custo_mp: parsedNumericVbaValues.custoMp,
              custo_emb: parsedNumericVbaValues.custoEmb,
              custo_perda: parsedNumericVbaValues.custoPerda,
              custo_ggf: parsedNumericVbaValues.custoGgf,
              custo_mod: parsedNumericVbaValues.custoMod,
              frete_valor: parsedNumericVbaValues.freteValor,
              encargo_valor: parsedNumericVbaValues.encargoValor,
              comissao_valor: parsedNumericVbaValues.comissaoValor,
              impostos_valor: parsedNumericVbaValues.impostosValor,
              icms_rate: reconciliation.derived.icmsRate,
              pis_rate: reconciliation.derived.pisRate,
              cofins_rate: reconciliation.derived.cofinsRate,
              frete_rate: reconciliation.derived.freteRate,
              comissao_rate: reconciliation.derived.comissaoRate,
              encargo_rate: reconciliation.derived.encargoRate,
            };
          }

          if (hasSpreadsheetValue(idVersaoVbaRaw)) {
            vbaPayload.id_versao_vba = String(idVersaoVbaRaw).trim();
          }
          if (hasSpreadsheetValue(dataVersaoVbaRaw)) {
            const rawDate = dataVersaoVbaRaw;
            let dataValida = null;
            try {
              if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
                dataValida = rawDate.toISOString().slice(0, 10);
              } else {
                const str = String(rawDate).trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                  const d = new Date(str + 'T00:00:00');
                  if (!Number.isNaN(d.getTime())) dataValida = str;
                } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
                  const [d, m, y] = str.split('/');
                  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                  if (!Number.isNaN(dateObj.getTime())) {
                    dataValida = dateObj.toISOString().slice(0, 10);
                  }
                }
              }
            } catch (_) {
              dataValida = null;
            }
            if (dataValida !== null) {
              vbaPayload.data_versao_vba = dataValida;
            }
          }
        }

        if (rowWarnings.length > 0) {
          warningRows += 1;
        }

        const uniqueKey = `${normalizedVersion}::${normalizedVolume}`;

        if (payloadByVersionAndVolume.has(uniqueKey)) {
          duplicatedRows += 1;
        }

        payloadByVersionAndVolume.set(uniqueKey, {
          versao: versaoFinal,
          volume: normalizedVolume,
          margem,
          precobruto,
          ...vbaPayload,
        });
      });

      const payload = Array.from(payloadByVersionAndVolume.values());
      const sucessoCount = payload.length;

      if (sucessoCount === 0) {
        const message = `Nenhuma linha valida. ${invalidRows} inválida(s). Detalhes no log.`;
        try {
          await logImport(
            'simulation_minimum_price_rules',
            0,
            {
              inseridos: 0,
              atualizados: 0,
              linhas_invalidas: invalidRows,
              linhas_duplicadas: duplicatedRows,
              linhas_com_warnings: warningRows,
              linhas_reconciliadas_vba: reconciledRows,
              erros_amostra: importErrorDetails,
            }
          );
        } catch (_) { /* não bloquear */ }
        toast.error(message);
        return;
      }

      const { error } = await supabase
        .from('simulation_minimum_price_rules')
        .upsert(payload, { onConflict: 'versao,volume' });

      if (error) throw error;

      await loadMinimumRules();

      const detailsParts = [];
      detailsParts.push(`${sucessoCount} OK`);
      if (invalidRows > 0) detailsParts.push(`${invalidRows} inválida(s)`);
      if (duplicatedRows > 0) detailsParts.push(`${duplicatedRows} duplicada(s)`);
      if (warningRows > 0) detailsParts.push(`${warningRows} c/ aviso(s)`);
      if (reconciledRows > 0) detailsParts.push(`${reconciledRows} reconcil. VBA`);
      const details = detailsParts.join(', ');
      const message = `${sucessoCount} importado(s): ${details}.`;

      try {
        await logImport(
          'simulation_minimum_price_rules',
          sucessoCount,
          {
            inseridos: sucessoCount,
            atualizados: 0,
            linhas_invalidas: invalidRows,
            linhas_duplicadas: duplicatedRows,
            linhas_com_warnings: warningRows,
            linhas_reconciliadas_vba: reconciledRows,
            erros_amostra: importErrorDetails,
          }
        );
      } catch (_) { /* não bloquear */ }

      toast.success(message);
    } catch (error) {
      console.error('Erro ao importar minimos:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode importar regras mínimas.')
          : `Erro: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setImportingMinimumRules(false);
    }
  };

  const calculate = (costNum, priceNum, marginNum) => {
    const pisRate = toRate(pis);
    const cofinsRate = toRate(cofins);
    const icmsRate = toRate(icms);
    const comissaoRate = toRate(comissao);
    const freteRate = toRate(frete);
    const encargoRate = toRate(encargo);
    const ipiRate = toRate(ipi);

    if (mode === SIMULATION_MODES.MARGIN) {
      const grossNum = Number(grossPrice || 0);
      const result = estimateMarginFromGrossPrice({
        grossPrice: grossNum,
        custoTotal: costNum,
        pisRate,
        cofinsRate,
        icmsRate,
        comissaoRate,
        freteRate,
        encargoRate,
        ipiRate,
      });
      if (grossNum <= 0) {
        setCalculationError('');
        return;
      }
      if (result.error) {
        setCalculationError('');
        return;
      }
      if (Math.abs(result.roundedNetPrice - priceNum) > 0.01) {
        setPrice(result.roundedNetPrice.toFixed(2));
      }
      if (Number.isFinite(result.marginPercent) && Math.abs(result.marginPercent - marginNum) > 0.01) {
        setMargin(result.marginPercent.toFixed(2));
      }
      setCalculationError('');
    } else if (mode === SIMULATION_MODES.PRICE || mode === SIMULATION_MODES.FREIGHT) {
      const marginRate = marginNum / 100;
      const result = solveDisplayedPriceByMargin({
        custoTotal: costNum,
        margemRate: marginRate,
        pisRate,
        cofinsRate,
        icmsRate,
        comissaoRate,
        freteRate,
        encargoRate,
        ipiRate,
      });
      if (result.error) {
        setCalculationError(result.error);
        return;
      }
      if (Math.abs(result.roundedNetPrice - priceNum) > 0.01) {
        setPrice(result.roundedNetPrice.toFixed(2));
      }
      if (Math.abs(result.grossPrice - Number(grossPrice)) > 0.01) {
        setGrossPrice(result.grossPrice.toFixed(2));
      }
      setCalculationError('');
    } else if (mode === SIMULATION_MODES.GROSS_CALCULATION) {
      const grossResult = calculateGrossPriceFromNetPrice({
        netPrice: priceNum,
        pisRate,
        cofinsRate,
        icmsRate,
        ipiRate,
      });
      if (grossResult.error) {
        setCalculationError(grossResult.error);
        return;
      }
      const marginResult = calculateMarginFromGrossPrice({
        grossPrice: grossResult.grossPrice,
        cost: costNum,
        pisRate,
        cofinsRate,
        icmsRate,
        ipiRate,
      });
      if (Math.abs(grossResult.grossPrice - Number(grossPrice)) > 0.01) {
        setGrossPrice(grossResult.grossPrice.toFixed(2));
      }
      if (Number.isFinite(marginResult.marginPercent) && Math.abs(marginResult.marginPercent - marginNum) > 0.01) {
        setMargin(marginResult.marginPercent.toFixed(2));
      }
      setCalculationError('');
    } else if (mode === SIMULATION_MODES.NET_CALCULATION) {
      const result = calculateNetPriceFromGrossPrice({
        grossPrice,
        pisRate,
        cofinsRate,
        icmsRate,
        ipiRate,
      });
      if (result.error) {
        setCalculationError(result.error);
        return;
      }
      const marginPercent = result.netPrice > 0 ? ((result.netPrice - costNum) / result.netPrice) * 100 : 0;
      if (Math.abs(result.netPrice - priceNum) > 0.01) {
        setPrice(result.netPrice.toFixed(2));
      }
      if (Number.isFinite(marginPercent) && Math.abs(marginPercent - marginNum) > 0.01) {
        setMargin(marginPercent.toFixed(2));
      }
      setCalculationError('');
    }
  };

  const handleOpenSaveSimulation = () => {
    if (!user) return;
    if (!selectedProductSku) {
      toast.error('Selecione um produto.');
      return;
    }
    if (!selectedVolume) {
      toast.error('Selecione o volume do SKU.');
      return;
    }
    if (showsMinimumPolicyWarnings && simulationPolicy.isBlocked) {
      setShowRestrictionModal(true);
      toast.error('Simulação fora da política mínima cadastrada.');
      return;
    }
    setShowSaveModal(true);
  };

  const insertSimulationHistory = async (payload) => {
    const sanitizedPayload = { ...payload };

    while (true) {
      const { error } = await supabase
        .from('simulations_history')
        .insert(sanitizedPayload);

      if (!error) {
        return null;
      }

      const missingColumnMatch = String(error.message || '').match(
        /Could not find the '([^']+)' column of 'simulations_history'/
      );

      if (!missingColumnMatch) {
        return error;
      }

      const missingColumn = missingColumnMatch[1];
      if (!(missingColumn in sanitizedPayload)) {
        return error;
      }

      delete sanitizedPayload[missingColumn];
    }
  };

  const handleSaveSimulation = async () => {
    if (!user) return;
    const typedClientName = saveForm.clientName.trim();
    if (!typedClientName) {
      toast.error('Cliente é obrigatório.');
      return;
    }

    try {
      setLoading(true);
      const baseClient = findBaseClientByInput(typedClientName)
        || (selectedBaseClient && selectedBaseClient.name === typedClientName ? selectedBaseClient : null);
      const normalizedClientName = baseClient?.name || typedClientName;
      const parsedPrice = Number(price) || 0;
      const parsedCost = Number(cost) || 0;
      const parsedMargin = Number(margin) || 0;
      const parsedGrossPrice = Number(grossPrice) || 0;
      const parsedTargetValue = (() => {
        const normalized = String(saveForm.target || '')
          .replace(/[R$\s]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim();
        const numeric = Number(normalized);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
      })();

      const error = await insertSimulationHistory({
        user_id: user.id,
        sku: sku || 'N/A',
        datasul_code: selectedCatalogEntry?.datasul_code || null,
        volume: selectedVolume ? Number(selectedVolume) : null,
        product_name: productName || 'Simulação Avulsa',
        price: parsedPrice,
        cost: parsedCost,
        margin: parsedMargin,
        mode: mode,
        pis: Number(pis),
        cofins: Number(cofins),
        icms: Number(icms),
        frete: Number(frete),
        gross_price: parsedGrossPrice,
        user_email: user.email,
        user_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        client_name: normalizedClientName,
        client_id: baseClient?.id || null,
        client_source: baseClient ? 'base' : 'manual',
        target: saveForm.target?.trim() || null,
        target_value: parsedTargetValue,
        observations: saveForm.observations?.trim() || null,
        catalog_cost: Number(selectedCatalogEntry?.catalog_cost || 0),
        catalog_price: Number(selectedCatalogEntry?.catalog_price || 0),
        catalog_gross_price: Number(selectedCatalogEntry?.catalog_gross_price || selectedCatalogEntry?.catalog_price || 0),
        catalog_margin: Number(selectedCatalogEntry?.catalog_margin || 0),
        approval_status: 'pending',
        minimum_rule_id: selectedMinimumRule?.id || null,
        minimum_gross_price: simulationPolicy.minimumGrossPrice,
        minimum_margin: simulationPolicy.minimumMargin,
        is_within_minimum_policy: !simulationPolicy.isBlocked,
        minimum_policy_status: simulationPolicy.status,
        minimum_policy_message: simulationPolicy.message
      });

      if (error) throw error;
      
      toast.success('Simulação salva com sucesso!');
      setShowSaveModal(false);
      setSaveForm({ clientName: '', target: '', observations: '' });
      setSelectedBaseClient(null);
      loadHistory();
      
    } catch (error) {
      console.error('Error saving simulation:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode salvar esta simulação.')
          : `Erro ao salvar simulação: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (name, email) => {
    const baseName = String(name || '').trim();
    if (baseName) return baseName;
    const baseEmail = String(email || '').trim().toLowerCase();
    if (baseEmail.includes('@')) {
      const localPart = baseEmail.split('@')[0];
      const normalized = localPart.replace(/[._-]+/g, ' ').trim();
      if (normalized) {
        return normalized
          .split(/\s+/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      }
    }
    return 'Usuário';
  };

  const isHistoryClientFromBase = useCallback((item) => {
    const explicitSource = String(item?.client_source || '').trim().toLowerCase();
    if (explicitSource === 'base') return true;
    if (explicitSource === 'manual') return false;
    if (item?.client_id) return true;

    const clientName = String(item?.client_name || '').trim();
    if (!clientName) return false;

    const normalizedHistoryClientName = normalizeLookupValue(clientName);
    return (clients || []).some((client) => {
      return normalizeLookupValue(client.name) === normalizedHistoryClientName;
    });
  }, [clients]);

  const formatHistoryClientName = (item) => {
    const clientName = String(item?.client_name || '').trim();
    if (!clientName) return '-';

    const isBaseClient = isHistoryClientFromBase(item);
    return isBaseClient ? `${clientName} (base)` : clientName;
  };

  const handleDeleteSimulation = async (simulationId) => {
    const targetItem = history.find((item) => item.id === simulationId);

    if (!simulationId || !canDeleteHistoryItem(targetItem)) return;
    try {
      setDeleteLoading(true);
      const { data, error } = await supabase
        .from('simulations_history')
        .delete()
        .eq('id', simulationId)
        .select('id');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Sem permissão para excluir esta simulação no banco de dados.');
      }
      setHistory(prev => prev.filter(item => item.id !== simulationId));
      if (selectedHistoryItem?.id === simulationId) {
        setSelectedHistoryItem(null);
        setShowHistoryDetailModal(false);
      }
      setDeleteConfirmItem(null);
      toast.success('Simulação excluída com sucesso.');
    } catch (error) {
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode excluir esta simulação.')
          : `Erro ao excluir simulação: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeHistoryDetailModal = () => {
    setIsClosingHistoryDetailModal(true);
    setTimeout(() => {
      setShowHistoryDetailModal(false);
      setSelectedHistoryItem(null);
      setShowHistoryObservations(false);
      setIsClosingHistoryDetailModal(false);
    }, 280);
  };

  const triggerDecisionEffect = (status) => {
    const tokens = status === 'approved'
      ? Array.from({ length: 28 }, (_, idx) => ({
          id: `${Date.now()}-${idx}`,
          left: Math.random() * 100,
          delay: Math.random() * 0.7,
          duration: 1.4 + Math.random() * 1.3,
          size: 14 + Math.random() * 18
        }))
      : [];
    const logoTokens = status === 'approved'
      ? Array.from({ length: 10 }, (_, idx) => ({
          id: `logo-${Date.now()}-${idx}`,
          left: Math.random() * 100,
          delay: Math.random() * 0.8,
          duration: 1.8 + Math.random() * 1.4,
          size: 22 + Math.random() * 24
        }))
      : [];
    setDecisionEffect({ visible: true, status, tokens, logoTokens });
    setTimeout(() => {
      setDecisionEffect({ visible: false, status: '', tokens: [], logoTokens: [] });
    }, status === 'approved' ? 2600 : 900);
  };

  const catalogMarginValue = Number(selectedCatalogEntry?.catalog_margin || 0);
  const marginForDisplay = selectedCatalogEntry && !hasManualInput ? catalogMarginValue : Number(margin || 0);

  const getApprovalStatus = (item) => {
    const status = String(item?.approval_status || '').trim().toLowerCase();
    if (status === 'approved') return 'approved';
    if (status === 'rejected') return 'rejected';
    return 'pending';
  };

  const approvalStatusUi = {
    pending: { label: 'Pendente', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' },
    approved: { label: 'Aprovado', badgeClass: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40' },
    rejected: { label: 'Reprovado', badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40' }
  };

  const handleReviewSimulation = async (status) => {
    if (!selectedHistoryItem?.id || !isPricingUser || !user) return;
    try {
      setReviewLoading(true);
      const payload = {
        approval_status: status,
        approved_at: new Date().toISOString(),
        approved_by_id: user.id,
        approved_by_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Pricing'
      };
      const { error } = await supabase
        .from('simulations_history')
        .update(payload)
        .eq('id', selectedHistoryItem.id);
      if (error) throw error;

      const updated = { ...selectedHistoryItem, ...payload };
      setSelectedHistoryItem(updated);
      setHistory(prev => prev.map(item => item.id === selectedHistoryItem.id ? updated : item));
      toast.success(status === 'approved' ? 'Simulação aprovada com sucesso.' : 'Simulação reprovada com sucesso.');
      triggerDecisionEffect(status);
      closeHistoryDetailModal();
    } catch (error) {
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode revisar esta simulação.')
          : `Erro ao atualizar status: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatCurrencyRounded = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0';
    return `R$ ${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(num))}`;
  };

  const formatPercent = (val) => {
    if (val === null || val === undefined || val === '') return '0%';
    const normalized = String(val).trim().replace(/\s+/g, '').replace('%', '').replace(',', '.');
    const num = Number(normalized);
    if (Number.isNaN(num)) return '0%';
    const percentageValue = Math.abs(num) <= 1 ? num * 100 : num;
    return `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(percentageValue)}%`;
  };

  const formatPercentFixed = (val, decimals = 1) => {
    if (val === null || val === undefined || val === '') {
      return `${(0).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    }

    const normalized = String(val).trim().replace(/\s+/g, '').replace('%', '').replace(',', '.');
    const num = Number(normalized);
    const percentageValue = Number.isNaN(num) ? 0 : (Math.abs(num) <= 1 ? num * 100 : num);

    return `${percentageValue.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}%`;
  };

  const formatCurrencyInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const numeric = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric || 0);
  };

  const parseCurrencyValue = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
    const normalized = String(value)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    const numeric = Number(normalized);
    return Number.isNaN(numeric) ? 0 : numeric;
  };

  const roundTo = (value, decimals = 2) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 0;
    const factor = 10 ** decimals;
    return Math.round((numeric + Number.EPSILON) * factor) / factor;
  };

  const grossPriceForSaveModal = useMemo(() => {
    return Number(grossPrice) || 0;
  }, [grossPrice]);

  const clientLookupData = useMemo(() => {
    const clientsById = new Map((clients || []).map((client) => [client.id, client]));
    const aliasesByNormalized = new Map();

    (clientAliases || []).forEach((alias) => {
      const normalizedAlias = normalizeLookupValue(alias.alias_name);
      const baseClient = clientsById.get(alias.client_id) || {
        id: alias.client_id,
        name: alias.clients?.name || '',
      };

      if (!normalizedAlias || !baseClient?.id) return;
      aliasesByNormalized.set(normalizedAlias, {
        ...alias,
        client: baseClient,
      });
    });

    return {
      clientsById,
      aliasesByNormalized,
    };
  }, [clientAliases, clients]);

  const findBaseClientByInput = useCallback((value) => {
    const normalizedValue = normalizeLookupValue(value);
    if (!normalizedValue) return null;

    const exactClientMatch = (clients || []).find(
      (client) => normalizeLookupValue(client.name) === normalizedValue
    );
    if (exactClientMatch) return exactClientMatch;

    return clientLookupData.aliasesByNormalized.get(normalizedValue)?.client || null;
  }, [clientLookupData.aliasesByNormalized, clients]);

  const resolvedSaveClient = useMemo(() => {
    const typedClientName = saveForm.clientName.trim();
    const matchedClient = findBaseClientByInput(typedClientName)
      || selectedBaseClient
      || null;
    const isBaseClient = Boolean(matchedClient);

    return {
      matchedClient,
      isBaseClient,
      displayName: matchedClient?.name || typedClientName,
    };
  }, [findBaseClientByInput, saveForm.clientName, selectedBaseClient]);

  const filteredClientSuggestions = useMemo(() => {
    const typedValue = normalizeLookupValue(saveForm.clientName);
    const baseSuggestions = (clients || [])
      .filter((client) => {
        const normalizedClientName = normalizeLookupValue(client.name);
        if (!typedValue) return true;
        return normalizedClientName.includes(typedValue);
      })
      .map((client) => ({
        key: `client-${client.id}`,
        type: 'client',
        client,
        label: client.name,
        description: null,
      }));

    if (!typedValue) {
      return baseSuggestions;
    }

    const aliasSuggestions = (clientAliases || [])
      .filter((alias) => {
        const normalizedAlias = normalizeLookupValue(alias.alias_name);
        return normalizedAlias.includes(typedValue);
      })
      .map((alias) => {
        const baseClient = clientLookupData.clientsById.get(alias.client_id) || {
          id: alias.client_id,
          name: alias.clients?.name || '',
        };

        return {
          key: `alias-${alias.id}`,
          type: 'alias',
          client: baseClient,
          label: alias.alias_name,
          description: baseClient.name || null,
        };
      })
      .filter((suggestion) => {
        return normalizeLookupValue(suggestion.label) !== normalizeLookupValue(suggestion.client.name);
      });

    return [...baseSuggestions, ...aliasSuggestions];
  }, [clientAliases, clientLookupData.clientsById, clients, saveForm.clientName]);

  const usesTaxesCalculator = [
    SIMULATION_MODES.GROSS_CALCULATION,
    SIMULATION_MODES.NET_CALCULATION,
  ].includes(mode);
  const showsMinimumPolicyWarnings = [
    SIMULATION_MODES.MARGIN,
    SIMULATION_MODES.PRICE,
    SIMULATION_MODES.FREIGHT,
  ].includes(mode);

  const hidesCostInput = usesTaxesCalculator;

  const resultLabel = mode === SIMULATION_MODES.MARGIN
    ? 'Margem Bruta Resultante'
    : mode === SIMULATION_MODES.PRICE
      ? 'Preço Bruto Sugerido'
      : mode === SIMULATION_MODES.FREIGHT
        ? 'Preço Bruto Sugerido'
        : mode === SIMULATION_MODES.NET_CALCULATION
          ? 'Preço Líquido Calculado'
          : 'Preço Bruto Calculado';

  const currentSimulationDiscount = useMemo(() => {
    const catalogGrossPrice = Number(selectedCatalogEntry?.catalog_gross_price || 0);
    const simulatedGrossPrice = Number(grossPrice || 0);
    const discountAmount = catalogGrossPrice - simulatedGrossPrice;
    const discountPercent = catalogGrossPrice > 0 ? (discountAmount / catalogGrossPrice) * 100 : 0;
    return {
      catalogGrossPrice,
      simulatedGrossPrice,
      discountAmount,
      discountPercent,
    };
  }, [selectedCatalogEntry, grossPrice]);

  const selectedHistoryMetrics = useMemo(() => {
    if (!selectedHistoryItem) return null;
    const volume = Math.round(parseCurrencyValue(selectedHistoryItem.volume || 0));
    const catalogPrice = roundTo(selectedHistoryItem.catalog_price || 0);
    const catalogGrossPrice = roundTo(selectedHistoryItem.catalog_gross_price || 0);
    const catalogMargin = roundTo(normalizeMarginPercentInput(selectedHistoryItem.catalog_margin || 0));
    const simulatedPrice = roundTo(selectedHistoryItem.price || 0);
    const simulatedGrossPrice = roundTo(selectedHistoryItem.gross_price || 0);
    const simulatedMargin = roundTo(normalizeMarginPercentInput(selectedHistoryItem.margin || 0));
    const numericTarget = Number(selectedHistoryItem.target_value);
    const targetValue = roundTo(Number.isFinite(numericTarget) && numericTarget > 0
      ? numericTarget
      : parseCurrencyValue(selectedHistoryItem.target));
    const hasTarget = targetValue > 0;
    const robCatalog = roundTo(volume * catalogGrossPrice, 0);
    const robSimulated = roundTo(volume * simulatedGrossPrice, 0);
    const mbCatalogAbsolute = roundTo(robCatalog * (catalogMargin / 100), 0);
    const mbSimulatedAbsolute = roundTo(robSimulated * (simulatedMargin / 100), 0);
    const priceDiscountAmount = simulatedGrossPrice - catalogGrossPrice;
    const priceDiscountPercent = catalogGrossPrice > 0 ? ((simulatedGrossPrice / catalogGrossPrice) - 1) * 100 : 0;
    const targetVsCatalogAmount = hasTarget ? (catalogGrossPrice - targetValue) : null;
    const targetVsCatalogPercent = hasTarget && targetValue > 0 ? ((catalogGrossPrice / targetValue) - 1) * 100 : null;
    const targetVsSimulatedAmount = hasTarget ? (simulatedGrossPrice - targetValue) : null;
    const targetVsSimulatedPercent = hasTarget && targetValue > 0 ? ((simulatedGrossPrice / targetValue) - 1) * 100 : null;
    const robVariationAmount = roundTo(robSimulated - robCatalog, 0);
    const robVariationPercent = robCatalog > 0 ? ((robSimulated / robCatalog) - 1) * 100 : 0;
    const mbVariationAmount = roundTo(mbSimulatedAbsolute - mbCatalogAbsolute, 0);
    const mbVariationPercent = mbCatalogAbsolute > 0 ? ((mbSimulatedAbsolute / mbCatalogAbsolute) - 1) * 100 : 0;
    return {
      volume,
      catalogPrice,
      catalogGrossPrice,
      catalogMargin,
      simulatedPrice,
      simulatedGrossPrice,
      simulatedMargin,
      robCatalog,
      robSimulated,
      mbCatalogAbsolute,
      mbSimulatedAbsolute,
      hasTarget,
      targetValue,
      targetVsCatalogAmount: roundTo(targetVsCatalogAmount || 0),
      targetVsCatalogPercent: roundTo(targetVsCatalogPercent || 0, 1),
      targetVsSimulatedAmount: roundTo(targetVsSimulatedAmount || 0),
      targetVsSimulatedPercent: roundTo(targetVsSimulatedPercent || 0, 1),
      priceDiscountAmount,
      priceDiscountPercent,
      marginVariationPp: simulatedMargin - catalogMargin,
      robVariationAmount,
      robVariationPercent,
      mbVariationAmount,
      mbVariationPercent,
      minimumGrossPrice: Number(selectedHistoryItem.minimum_gross_price || 0),
      minimumMargin: Number(selectedHistoryItem.minimum_margin || 0),
      minimumPolicyStatus: String(selectedHistoryItem.minimum_policy_status || '').trim(),
      minimumPolicyMessage: String(selectedHistoryItem.minimum_policy_message || '').trim(),
      isWithinMinimumPolicy: selectedHistoryItem.is_within_minimum_policy !== false
    };
  }, [selectedHistoryItem]);

  const simulationDependencyLoading = catalogStatus === 'loading' || minimumRulesStatus === 'loading';
  const simulationReady = catalogStatus === 'success' && minimumRulesStatus === 'success';
  const simulationDependencyErrors = [catalogError, minimumRulesError].filter(Boolean);

  if (!simulationReady) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
        <Header
          user={user}
          title="Simulador de Preço e Margem"
          subtitle="Ferramenta de cálculo e análise de rentabilidade"
          showBack={false}
          logoRedirect="/select"
        />

        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111111] p-10 shadow-sm">
            <div className="mx-auto max-w-2xl text-center">
              <div className={cn(
                "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full",
                simulationDependencyLoading
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                  : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
              )}>
                {simulationDependencyLoading ? (
                  <RefreshCcw className="h-8 w-8 animate-spin" />
                ) : (
                  <AlertTriangle className="h-8 w-8" />
                )}
              </div>

              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
                {simulationDependencyLoading ? 'Carregando dados obrigatórios' : 'Simulador temporariamente indisponível'}
              </h1>

              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {simulationDependencyLoading
                  ? 'Estamos carregando o catálogo e as regras mínimas obrigatórias da simulação. Enquanto isso, os valores permanecem indisponíveis.'
                  : 'Não foi possível carregar os dados obrigatórios da simulação. Os valores não podem ser calculados no momento.'}
              </p>

              {!simulationDependencyLoading && simulationDependencyErrors.length > 0 && (
                <div className="mt-6 space-y-3 text-left">
                  {simulationDependencyErrors.map((message) => (
                    <div
                      key={message}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                    >
                      {message}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <Button onClick={retrySimulationDependencies} disabled={simulationDependencyLoading} className="px-6">
                  {simulationDependencyLoading ? 'Carregando...' : 'Tentar novamente'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header 
        user={user} 
        title="Simulador de Preço e Margem" 
        subtitle="Ferramenta de cálculo e análise de rentabilidade" 
        showBack={false}
        logoRedirect="/select"
      />
      
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <input
          ref={minimumRulesImportInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleMinimumRulesFileChange}
        />
        
        {/* Main Simulator Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-lg border-t-4 border-t-[#845AFA]">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-[#845AFA]" />
                    Parâmetros da Simulação
                  </CardTitle>
                  <CardDescription>
                    Selecione um SKU do catálogo para simular
                  </CardDescription>
                </div>
                {isPricingUser && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleMinimumRulesImportClick}
                    disabled={importingMinimumRules}
                  >
                    {importingMinimumRules ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {importingMinimumRules ? 'Importando...' : 'Importar minimos'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label>Selecionar Produto</Label>
                <SearchableSelect 
                  options={productOptions}
                  value={selectedProductSku}
                  onChange={handleProductSelect}
                  placeholder="Selecione um produto..."
                  searchPlaceholder="Buscar por Nome..."
                />
              </div>

              <div className="space-y-2">
                <Label>Selecionar Volume</Label>
                <select
                  value={selectedVolume}
                  onChange={(e) => setSelectedVolume(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione o volume</option>
                  {volumeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                 <div className="space-y-1 md:col-span-8">
                    <Label className="text-xs text-muted-foreground">Produto Selecionado</Label>
                    <div className="font-medium leading-snug break-words">{productName || '-'}</div>
                 </div>
                 <div className="space-y-1 md:col-span-2 md:text-right">
                    <Label className="text-xs text-muted-foreground">Preço</Label>
                    <div className="font-medium">{formatCurrency(selectedCatalogEntry?.catalog_gross_price ?? grossPrice ?? 0)}</div>
                 </div>
                 <div className="space-y-1 md:col-span-2 md:text-right">
                    <Label className="text-xs text-muted-foreground">Margem</Label>
                    <div className="font-medium">{formatPercent(catalogMarginValue || marginForDisplay)}</div>
                 </div>
              </div>

              <Tabs value={mode} onValueChange={setMode} className="w-full">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1 h-auto p-1">
                  <TabsTrigger
                    value={SIMULATION_MODES.MARGIN}
                    className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-center leading-tight"
                  >
                    Simular Margem
                  </TabsTrigger>
                  <TabsTrigger
                    value={SIMULATION_MODES.PRICE}
                    className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-center leading-tight"
                  >
                    Simular Preço
                  </TabsTrigger>
                  <TabsTrigger
                    value={SIMULATION_MODES.FREIGHT}
                    className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-center leading-tight"
                  >
                    Simular Frete
                  </TabsTrigger>
                  <TabsTrigger
                    value={SIMULATION_MODES.GROSS_CALCULATION}
                    className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-center leading-tight"
                  >
                    Cálculo Preço Bruto
                  </TabsTrigger>
                  <TabsTrigger
                    value={SIMULATION_MODES.NET_CALCULATION}
                    className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-center leading-tight"
                  >
                    Cálculo Preço Liquido
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                {/* Cost Input - Restricted View */}
                {!hidesCostInput && (
                  <div className="space-y-2 relative">
                    <Label htmlFor="cost">Custo do Produto</Label>
                    {isPricingUser ? (
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                        <Input 
                          id="cost" 
                          type="number" 
                          value={cost} 
                          onChange={(e) => setCost(e.target.value)}
                          onBlur={(e) => handleBlur(setCost, e.target.value)}
                          disabled={mode === SIMULATION_MODES.MARGIN || mode === SIMULATION_MODES.PRICE || mode === SIMULATION_MODES.FREIGHT}
                          className={cn(
                            "pl-8",
                            (mode === SIMULATION_MODES.MARGIN || mode === SIMULATION_MODES.PRICE || mode === SIMULATION_MODES.FREIGHT) && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                          )}
                        />
                      </div>
                    ) : (
                      <div className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-gray-900 dark:bg-gray-950 dark:text-gray-100">
                        {formatCurrency(Number(cost))}
                      </div>
                    )}
                    {(mode === SIMULATION_MODES.MARGIN || mode === SIMULATION_MODES.PRICE || mode === SIMULATION_MODES.FREIGHT) && (
                       <p className="text-[10px] text-muted-foreground">O custo é fixo baseado no produto selecionado.</p>
                    )}
                  </div>
                )}

                {/* Dynamic Inputs based on Mode */}
                {mode === SIMULATION_MODES.MARGIN ? (
                  <div className="space-y-2">
                    <Label htmlFor="grossPrice">Preço bruto (novo)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                      <Input 
                        id="grossPrice" 
                        type="number" 
                        value={grossPrice} 
                        onChange={(e) => {
                          setHasManualInput(true);
                          setGrossPrice(e.target.value);
                        }}
                        onBlur={(e) => handleBlur(setGrossPrice, e.target.value)}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : mode === SIMULATION_MODES.PRICE ? (
                  <div className="space-y-2">
                    <Label htmlFor="margin">Margem Alvo (%)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                      <Input 
                        id="margin" 
                        type="number" 
                        value={margin} 
                        onChange={(e) => {
                          setHasManualInput(true);
                          setMargin(e.target.value);
                        }}
                        onBlur={(e) => handleBlur(setMargin, e.target.value, { normalizePercent: true })}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : mode === SIMULATION_MODES.FREIGHT ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="freight">Frete (%)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                          <Input 
                            id="freight" 
                            type="number" 
                            value={frete} 
                            onChange={(e) => {
                              setHasManualInput(true);
                              setFrete(e.target.value);
                            }}
                            onBlur={(e) => handleBlur(setFrete, e.target.value)}
                            className="pl-8 font-semibold text-lg"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="margin">Margem Alvo (%)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                          <Input 
                            id="margin" 
                            type="number" 
                            value={margin} 
                            onChange={(e) => {
                              setHasManualInput(true);
                              setMargin(e.target.value);
                            }}
                            onBlur={(e) => handleBlur(setMargin, e.target.value, { normalizePercent: true })}
                            className="pl-8 font-semibold text-lg"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preço Líquido</Label>
                        <div className="rounded-md border bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-not-allowed">
                          {formatCurrency(Number(price) || 0)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Preço Bruto</Label>
                        <div className="rounded-md border bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-not-allowed">
                          {formatCurrency(Number(grossPrice) || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Modes with tax conversion
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="basePrice">
                          {mode === SIMULATION_MODES.NET_CALCULATION ? 'Preço Bruto Base' : 'Preço Líquido Base'}
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors h-[28px]">
                              <MapIcon className="w-3.5 h-3.5" />
                              Alíquotas ICMS
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0 bg-white dark:bg-[#171717] border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Referência de Alíquotas</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Tabela prática por região</p>
                              </div>
                            </div>
                            <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  Operação Interna
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between gap-3">
                                    <span className="text-gray-600 dark:text-gray-400">SP</span>
                                    <span className="font-semibold text-right text-gray-900 dark:text-gray-100">
                                      12% ou 18%
                                    </span>
                                  </div>
                                  <div className="pt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                    12% para Simples Nacional e 18% para Lucro Real.
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  Sul / Sudeste
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">MG, PR, RS, RJ, SC</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">12%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  Norte / Nordeste / C.O. / ES
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">AC, AL, AM, AP, BA, CE, DF...</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">7%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  Observação
                                </h5>
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-800/30">
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                  <Info className="w-3 h-3" />
                                  PIS e COFINS são iguais para todos os estados.
                                </p>
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                        <Input 
                          id="basePrice" 
                          type="number" 
                          value={mode === SIMULATION_MODES.NET_CALCULATION ? grossPrice : price}
                          onChange={(e) => {
                            setHasManualInput(true);
                            if (mode === SIMULATION_MODES.NET_CALCULATION) {
                              setGrossPrice(e.target.value);
                            } else {
                              setPrice(e.target.value);
                            }
                          }}
                          onBlur={(e) => handleBlur(
                            mode === SIMULATION_MODES.NET_CALCULATION ? setGrossPrice : setPrice,
                            e.target.value
                          )}
                          placeholder="0.00"
                          className="pl-8 font-semibold"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {mode === SIMULATION_MODES.NET_CALCULATION
                            ? 'O valor é preenchido pelo catálogo e pode ser alterado manualmente para calcular o preço líquido.'
                            : 'O valor é preenchido pelo catálogo e pode ser alterado manualmente para calcular o preço bruto.'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="pis" className="text-xs">PIS (%)</Label>
                        <Input 
                          id="pis" 
                          type="number" 
                          value={pis} 
                          onChange={(e) => setPis(e.target.value)}
                          onBlur={(e) => handleBlur(setPis, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cofins" className="text-xs">COFINS (%)</Label>
                        <Input 
                          id="cofins" 
                          type="number" 
                          value={cofins} 
                          onChange={(e) => setCofins(e.target.value)}
                          onBlur={(e) => handleBlur(setCofins, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="icms" className="text-xs">ICMS (%)</Label>
                        <Input 
                          id="icms" 
                          type="number" 
                          value={icms} 
                          onChange={(e) => setIcms(e.target.value)}
                          onBlur={(e) => handleBlur(setIcms, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDreInfoModal(true)}
                className="w-full border-[#845AFA]/30 bg-[#845AFA]/10 text-[#6b46c1] hover:bg-[#845AFA]/15 dark:border-[#845AFA]/40 dark:bg-[#845AFA]/15 dark:text-purple-200 dark:hover:bg-[#845AFA]/20 shadow-sm"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                MB considerada no DRE
              </Button>
              <Button onClick={handleOpenSaveSimulation} className="w-full bg-[#845AFA] hover:bg-[#6b46c1] text-white" disabled={loading}>
                {loading ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : <History className="w-4 h-4 mr-2" />}
                Salvar Simulação
              </Button>
            </CardFooter>
          </Card>

          {/* Results Card */}
          <Card className="shadow-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                Resultados da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Main Result */}
              <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <span className="text-gray-500 dark:text-slate-400 text-sm font-medium uppercase tracking-widest mb-3">
                  {resultLabel}
                </span>
                <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {mode === SIMULATION_MODES.MARGIN ? (
                    <span className={marginForDisplay < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}>
                      {formatPercent(marginForDisplay)}
                    </span>
                  ) : mode === SIMULATION_MODES.PRICE ? (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(grossPrice))}
                    </span>
                  ) : mode === SIMULATION_MODES.NET_CALCULATION ? (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(price))}
                    </span>
                  ) : (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(grossPrice))}
                    </span>
                  )}
                </div>
                {calculationError && (
                  <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                    {calculationError}
                  </div>
                )}
                <div className="mt-4 px-3 py-1.5 rounded-full bg-[#845AFA]/10 border border-[#845AFA]/20 text-xs font-medium text-[#6b46c1] dark:text-purple-300">
                  Margem catalogo: {formatPercent(catalogMarginValue || Number(margin || 0))}
                </div>
                {showsMinimumPolicyWarnings && simulationPolicy.hasRule && (
                  <div className={cn(
                    "mt-3 w-full rounded-xl border px-4 py-3 text-left text-sm",
                    simulationPolicy.isBlocked
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                  )}>
                    <div className="font-semibold">
                      {simulationPolicy.isBlocked ? 'Fora da politica minima' : 'Dentro da politica minima'}
                    </div>
                    <div className="mt-1 text-xs">
                      Preco bruto minimo: {formatCurrency(simulationPolicy.minimumGrossPrice || 0)} | Margem minima: {formatPercent(simulationPolicy.minimumMargin || 0)}
                    </div>
                  </div>
                )}
                
                {/* Tax Breakdown */}
                {usesTaxesCalculator && Number(grossPrice) > 0 && (
                   <div className="mt-4 flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">PIS: {pis}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">COFINS: {cofins}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">ICMS: {icms}%</span>
                   </div>
                )}
                
              </div>

              {/* Secondary Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-gray-100 dark:bg-slate-700 rounded-md">
                      <DollarSign className="w-4 h-4 text-gray-600 dark:text-slate-300" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Custo Base</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(Number(cost))}
                  </div>
                </div>

                <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700/50 shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md">
                      <Percent className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Lucro Bruto</span>
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(Number(price) - Number(cost))}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        <div className="mt-12">
          <Card className="shadow-lg h-full">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                Histórico de simulações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-y-auto max-h-[600px] -mx-6 px-6">
                <Table className="w-full table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">ID</TableHead>
                      <TableHead className="text-left">Cliente</TableHead>
                      <TableHead className="text-left">Produto</TableHead>
                      <TableHead className="text-left">Volume</TableHead>
                      <TableHead className="text-left">Margem</TableHead>
                      <TableHead className="text-left">Preço Liq.</TableHead>
                      <TableHead className="text-left">Preço Bruto</TableHead>
                      <TableHead className="text-left">Status</TableHead>
                      <TableHead className="text-left">Usuário / Data</TableHead>
                      <TableHead className="text-left">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhuma simulação registrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((item) => (
                        <TableRow
                          key={item.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                          onClick={() => {
                            setSelectedHistoryItem(item);
                            setShowHistoryObservations(false);
                            setIsClosingHistoryDetailModal(false);
                            setShowHistoryDetailModal(true);
                          }}
                        >
                          <TableCell className="text-xs font-mono text-gray-500 align-top">
                            {item.simulation_number || item.id.substring(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs align-top font-medium leading-tight break-words" title={formatHistoryClientName(item)}>
                            {formatHistoryClientName(item)}
                          </TableCell>
                          <TableCell className="font-medium text-xs leading-tight break-words align-top" title={item.product_name}>
                            {item.product_name}
                          </TableCell>
                          <TableCell className="text-xs align-top">
                            {item.volume || '-'}
                          </TableCell>
                          <TableCell className="text-xs align-top">
                            <Badge variant={item.margin < 10 ? "destructive" : "secondary"} className="text-[10px]">
                              {formatPercent(item.margin)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs align-top">
                            {formatCurrency(item.price)}
                          </TableCell>
                          <TableCell className="text-xs align-top">
                            {item.gross_price ? formatCurrency(item.gross_price) : '-'}
                          </TableCell>
                          <TableCell className="text-xs align-top">
                            <Badge className={cn("text-[10px] border", approvalStatusUi[getApprovalStatus(item)].badgeClass)}>
                              {approvalStatusUi[getApprovalStatus(item)].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs align-top">
                           <div className="flex flex-col items-start">
                              <span className="font-medium">{getDisplayName(item.user_name_from_users || item.user_name, item.user_email)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                           </div>
                        </TableCell>
                          <TableCell className="align-top">
                            {canDeleteHistoryItem(item) ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmItem(item);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <AlertDialog
          open={Boolean(deleteConfirmItem)}
          onOpenChange={(open) => {
            if (!open && !deleteLoading) setDeleteConfirmItem(null);
          }}
        >
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a simulação do histórico no banco de dados e não pode ser desfeita.
              </AlertDialogDescription>
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div><span className="font-medium">Produto:</span> {deleteConfirmItem?.product_name || '-'}</div>
                <div><span className="font-medium">ID:</span> {deleteConfirmItem?.simulation_number || deleteConfirmItem?.id?.substring(0, 8) || '-'}</div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
              <Button
                onClick={() => {
                  if (!deleteConfirmItem?.id) return;
                  handleDeleteSimulation(deleteConfirmItem.id);
                }}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteLoading ? 'Excluindo...' : 'Excluir simulação'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showSaveModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#171717] rounded-lg w-full max-w-lg p-6 space-y-4 border border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Salvar Simulação</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>SKU</Label>
                  <div className="mt-1 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">{productName || '-'}</div>
                </div>
                <div>
                  <Label>Volume</Label>
                  <div className="mt-1 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">{selectedVolume || '-'}</div>
                </div>
                <div className="col-span-2">
                  <Label>Preço Bruto (novo)</Label>
                  <div className="mt-1 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">{formatCurrency(grossPriceForSaveModal)}</div>
                </div>
                <div>
                  <Label>Desconto vs. catálogo</Label>
                  <div className="mt-1 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                    {formatPercent(currentSimulationDiscount.discountPercent)}
                  </div>
                </div>
                <div>
                  <Label>Valor do desconto</Label>
                  <div className="mt-1 px-3 py-2 rounded border border-gray-200 dark:border-gray-700">
                    {formatCurrency(currentSimulationDiscount.discountAmount)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <div className="relative">
                  <Input
                    value={saveForm.clientName}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSaveForm(prev => ({ ...prev, clientName: e.target.value }));
                      if (!selectedBaseClient || selectedBaseClient.name !== nextValue) {
                        setSelectedBaseClient(null);
                      }
                      setShowClientSuggestions(true);
                    }}
                    onFocus={() => setShowClientSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setShowClientSuggestions(false);
                      }, 120);
                    }}
                    placeholder={loadingClients ? 'Carregando clientes...' : 'Selecione da base ou digite um novo cliente'}
                  />
                  {showClientSuggestions && filteredClientSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                      {filteredClientSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.key}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-900 hover:bg-[#845AFA]/10 dark:text-gray-100 dark:hover:bg-[#845AFA]/20"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setSelectedBaseClient(suggestion.client);
                            setSaveForm((prev) => ({ ...prev, clientName: suggestion.client.name }));
                            setShowClientSuggestions(false);
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{suggestion.label}</div>
                            {suggestion.description && (
                              <div className="truncate text-[11px] text-muted-foreground">
                                Base: {suggestion.description}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 text-[11px] text-[#6b46c1] dark:text-purple-300">
                            {suggestion.type === 'alias' ? 'Depara' : 'Base'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className={cn(
                  "text-xs",
                  resolvedSaveClient.isBaseClient
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}>
                  {resolvedSaveClient.isBaseClient
                    ? `Cliente encontrado na base e será exibido como ${resolvedSaveClient.displayName} (base) no histórico.`
                    : 'Cliente digitado será salvo como novo. Para marcar como base, selecione um item da lista.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Target</Label>
                <Input
                  value={saveForm.target}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, target: formatCurrencyInput(e.target.value) }))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <textarea
                  value={saveForm.observations}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Observações adicionais"
                  className="w-full min-h-[90px] px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveModal(false);
                    setSelectedBaseClient(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveSimulation} disabled={loading} className="bg-[#845AFA] hover:bg-[#6b46c1] text-white">
                  Confirmar e Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

        {showDreInfoModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#171717] rounded-xl w-full max-w-md border border-amber-200 dark:border-amber-800/40 shadow-2xl overflow-hidden">
              <div className="bg-[#845AFA]/10 dark:bg-[#845AFA]/20 border-b border-[#845AFA]/20 dark:border-[#845AFA]/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-[#845AFA]/15 dark:bg-[#845AFA]/25 p-2">
                    <AlertTriangle className="w-5 h-5 text-[#6b46c1] dark:text-purple-200" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#6b46c1] dark:text-purple-100">MB considerada no DRE</h3>
                    <p className="text-sm text-[#6b46c1]/80 dark:text-purple-200/80">Consulta para referência das simulações.</p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-5 space-y-3">
                {DRE_APPROVED_MARGINS.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between rounded-lg border border-[#845AFA]/10 bg-[#845AFA]/5 px-4 py-3 text-sm dark:border-[#845AFA]/20 dark:bg-[#845AFA]/10"
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-100">{item.category}</span>
                    <span className="text-base font-bold text-[#6b46c1] dark:text-purple-200">{item.margin}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <Button variant="outline" onClick={() => setShowDreInfoModal(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={showRestrictionModal} onOpenChange={setShowRestrictionModal}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-5 h-5" />
                Simulação fora do range permitido
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6">
                {simulationPolicy.message}
              </AlertDialogDescription>
              <div className="rounded-xl border border-red-100 bg-red-50/80 p-4 text-sm dark:border-red-900/40 dark:bg-red-900/10">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Preço bruto simulado</span>
                  <span className="font-semibold">{formatCurrency(Number(grossPrice) || 0)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-muted-foreground">Margem simulada</span>
                  <span className="font-semibold">{formatPercent(Number(margin) || 0)}</span>
                </div>
                <div className="mt-4 border-t border-red-200 pt-3 dark:border-red-900/40">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Preço bruto mínimo</span>
                    <span className="font-semibold">{formatCurrency(simulationPolicy.minimumGrossPrice || 0)}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-4">
                    <span className="text-muted-foreground">Margem mínima</span>
                    <span className="font-semibold">{formatPercent(simulationPolicy.minimumMargin || 0)}</span>
                  </div>
                </div>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setShowRestrictionModal(false)}>
                Entendi
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(showHistoryDetailModal || isClosingHistoryDetailModal) && selectedHistoryItem && selectedHistoryMetrics && (
          <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300", isClosingHistoryDetailModal ? "bg-black/0 opacity-0" : "bg-black/50 opacity-100")}>
            <div className={cn("bg-white dark:bg-[#111111] rounded-2xl w-full max-w-4xl p-0 border border-[#845AFA]/20 dark:border-[#845AFA]/30 overflow-hidden shadow-2xl transition-all duration-300", isClosingHistoryDetailModal ? "opacity-0 scale-95 translate-y-3" : "opacity-100 scale-100 translate-y-0")}>
              <div className="bg-gradient-to-r from-[#845AFA] to-[#6b46c1] px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Detalhes da Simulação #{selectedHistoryItem.simulation_number || selectedHistoryItem.id.substring(0, 8)}
                  </h3>
                  <p className="text-xs text-purple-100 mt-1">
                    {selectedHistoryItem.product_name || '-'} • Volume {selectedHistoryItem.volume || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-[#6b46c1] border-white hover:bg-purple-50"
                    onClick={() => setShowHistoryObservations(prev => !prev)}
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Observações
                  </Button>
                  <Badge className={cn("text-[11px] border bg-white/10 text-white border-white/30", getApprovalStatus(selectedHistoryItem) === 'approved' && "bg-green-500/20 border-green-200/30", getApprovalStatus(selectedHistoryItem) === 'rejected' && "bg-red-500/20 border-red-200/30")}>
                    {approvalStatusUi[getApprovalStatus(selectedHistoryItem)].label}
                  </Badge>
                  <Button variant="outline" size="icon" className="bg-white text-[#6b46c1] border-white hover:bg-purple-50" onClick={closeHistoryDetailModal}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-[#845AFA]/20 bg-[#845AFA]/5 px-4 py-3 dark:border-[#845AFA]/30 dark:bg-[#845AFA]/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[#845AFA] dark:text-purple-300">Cliente da Simulação</div>
                      <div className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                        {formatHistoryClientName(selectedHistoryItem) || 'Nao informado'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#845AFA] dark:text-purple-300">
                          <Target className="w-3.5 h-3.5" />
                          Target
                        </div>
                        <div className="mt-1 font-semibold text-gray-900 dark:text-white">
                          {selectedHistoryMetrics.targetValue > 0 ? formatCurrency(selectedHistoryMetrics.targetValue) : 'Nao informado'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <div className="text-center text-[11px] uppercase tracking-wide text-[#845AFA] dark:text-purple-300">Target vs Catálogo</div>
                        <div className={cn("mt-1 text-center font-semibold", !selectedHistoryMetrics.hasTarget ? "text-gray-500 dark:text-gray-400" : selectedHistoryMetrics.targetVsCatalogAmount > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                          {selectedHistoryMetrics.hasTarget ? formatCurrency(selectedHistoryMetrics.targetVsCatalogAmount) : 'Nao informado'}
                        </div>
                        <div className="text-center text-xs text-muted-foreground">
                          {selectedHistoryMetrics.hasTarget ? formatPercentFixed(selectedHistoryMetrics.targetVsCatalogPercent, 1) : '-'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/50 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                        <div className="text-center text-[11px] uppercase tracking-wide text-[#845AFA] dark:text-purple-300">Target vs Simulado</div>
                        <div className={cn("mt-1 text-center font-semibold", !selectedHistoryMetrics.hasTarget ? "text-gray-500 dark:text-gray-400" : selectedHistoryMetrics.targetVsSimulatedAmount > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400")}>
                          {selectedHistoryMetrics.hasTarget ? formatCurrency(selectedHistoryMetrics.targetVsSimulatedAmount) : 'Nao informado'}
                        </div>
                        <div className="text-center text-xs text-muted-foreground">
                          {selectedHistoryMetrics.hasTarget ? formatPercentFixed(selectedHistoryMetrics.targetVsSimulatedPercent, 1) : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {showHistoryObservations && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <FileText className="w-4 h-4" />
                      Observações
                    </div>
                    <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white/90 p-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200 whitespace-pre-wrap break-words">
                      {String(selectedHistoryItem.observations || '').trim() || 'Nenhuma observação informada nesta simulação.'}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10">
                    <div className="font-semibold mb-3 text-[#6b46c1] dark:text-purple-300">Catálogo</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Líquido</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.catalogPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Bruto</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.catalogGrossPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Margem</span><span className="font-medium">{formatPercent(selectedHistoryMetrics.catalogMargin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">ROB</span><span className="font-medium">{formatCurrencyRounded(selectedHistoryMetrics.robCatalog)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">MB absoluta</span><span className="font-medium">{formatCurrencyRounded(selectedHistoryMetrics.mbCatalogAbsolute)}</span></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#845AFA]/20 dark:border-[#845AFA]/30 bg-white dark:bg-[#1a1a1a]">
                    <div className="font-semibold mb-3 text-[#845AFA]">Simulado</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Líquido</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.simulatedPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Bruto</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.simulatedGrossPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Margem</span><span className="font-medium">{formatPercent(selectedHistoryMetrics.simulatedMargin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">ROB</span><span className="font-medium">{formatCurrencyRounded(selectedHistoryMetrics.robSimulated)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">MB absoluta</span><span className="font-medium">{formatCurrencyRounded(selectedHistoryMetrics.mbSimulatedAbsolute)}</span></div>
                    </div>
                  </div>
                </div>
                {selectedHistoryMetrics.minimumGrossPrice > 0 || selectedHistoryMetrics.minimumMargin > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
                    <div className="font-semibold text-amber-800 dark:text-amber-300">Regra minima aplicada</div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-amber-900/80 dark:text-amber-200/90">
                      <span>Preco bruto minimo: {formatCurrency(selectedHistoryMetrics.minimumGrossPrice)}</span>
                      <span>Margem minima: {formatPercent(selectedHistoryMetrics.minimumMargin)}</span>
                      <span>Status: {selectedHistoryMetrics.isWithinMinimumPolicy ? 'Dentro da politica' : 'Fora da politica'}</span>
                    </div>
                    {selectedHistoryMetrics.minimumPolicyMessage && (
                      <div className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/90">
                        {selectedHistoryMetrics.minimumPolicyMessage}
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-[#181818]">
                    <div className="whitespace-nowrap text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Desconto Preço vs Catálogo</div>
                    <div className={cn("mt-1 text-lg font-bold", selectedHistoryMetrics.priceDiscountPercent < 0 ? "text-red-500" : selectedHistoryMetrics.priceDiscountPercent > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100")}>
                      {formatPercent(selectedHistoryMetrics.priceDiscountPercent)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(selectedHistoryMetrics.priceDiscountAmount)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-[#181818]">
                    <div className="whitespace-nowrap text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. Margem</div>
                    <div className={cn("mt-1 text-lg font-bold", selectedHistoryMetrics.marginVariationPp < 0 ? "text-red-500" : selectedHistoryMetrics.marginVariationPp > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100")}>
                      {selectedHistoryMetrics.marginVariationPp.toFixed(2)} p.p.
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-[#181818]">
                    <div className="whitespace-nowrap text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. ROB</div>
                    <div className={cn("mt-1 text-lg font-bold", selectedHistoryMetrics.robVariationPercent < 0 ? "text-red-500" : selectedHistoryMetrics.robVariationPercent > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100")}>
                      {formatPercent(selectedHistoryMetrics.robVariationPercent)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCurrencyRounded(selectedHistoryMetrics.robVariationAmount)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center dark:border-gray-700 dark:bg-[#181818]">
                    <div className="whitespace-nowrap text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. MB</div>
                    <div className={cn("mt-1 text-lg font-bold", selectedHistoryMetrics.mbVariationPercent < 0 ? "text-red-500" : selectedHistoryMetrics.mbVariationPercent > 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-gray-100")}>
                      {formatPercent(selectedHistoryMetrics.mbVariationPercent)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatCurrencyRounded(selectedHistoryMetrics.mbVariationAmount)}
                    </div>
                  </div>
                </div>
                {isPricingUser && (
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button
                      onClick={() => handleReviewSimulation('rejected')}
                      disabled={reviewLoading}
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Reprovar
                    </Button>
                    <Button
                      onClick={() => handleReviewSimulation('approved')}
                      disabled={reviewLoading}
                      variant="outline"
                      className="bg-white text-green-700 border-green-300 hover:bg-green-50 dark:bg-transparent dark:text-green-400 dark:border-green-800/40 dark:hover:bg-green-900/20"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Aprovar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {decisionEffect.visible && (
          <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
            <div className={cn("absolute inset-0", decisionEffect.status === 'approved' ? "bg-emerald-500/10" : "bg-red-500/10")} />
            {decisionEffect.status === 'approved' ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src="/logo-pronutrition-symbol.png"
                    alt="PRO Nutrition"
                    className="w-36 h-36 object-contain drop-shadow-2xl pro-logo-spotlight"
                  />
                </div>
                {decisionEffect.tokens.map((token) => (
                  <span
                    key={token.id}
                    className="absolute top-[-10%] text-emerald-400 font-bold pro-dollar-fall"
                    style={{
                      left: `${token.left}%`,
                      animationDelay: `${token.delay}s`,
                      animationDuration: `${token.duration}s`,
                      fontSize: `${token.size}px`
                    }}
                  >
                    $
                  </span>
                ))}
                {decisionEffect.logoTokens.map((token) => (
                  <img
                    key={token.id}
                    src="/logo-pronutrition-symbol.png"
                    alt="PRO"
                    className="absolute top-[-10%] object-contain opacity-90 pro-logo-fall"
                    style={{
                      left: `${token.left}%`,
                      animationDelay: `${token.delay}s`,
                      animationDuration: `${token.duration}s`,
                      width: `${token.size}px`,
                      height: `${token.size}px`
                    }}
                  />
                ))}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/90 text-white pro-reject-pop">
                  <XCircle className="w-5 h-5" />
                  <span className="font-semibold">Simulação Reprovada</span>
                </div>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes proLogoSpotlight {
            0% { transform: scale(0.62); opacity: 0; filter: brightness(1); }
            18% { transform: scale(1.06); opacity: 1; filter: brightness(1.1); }
            76% { transform: scale(1); opacity: 1; filter: brightness(1); }
            100% { transform: scale(0.9); opacity: 0; filter: brightness(0.95); }
          }
          @keyframes proDollarFall {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(120vh) rotate(360deg); opacity: 0; }
          }
          @keyframes proLogoFall {
            0% { transform: translateY(-10vh) rotate(0deg) scale(0.75); opacity: 0; }
            12% { opacity: 1; }
            100% { transform: translateY(120vh) rotate(320deg) scale(1); opacity: 0; }
          }
          @keyframes proRejectPop {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .pro-logo-spotlight { animation: proLogoSpotlight 2.4s ease-in-out forwards; }
          .pro-dollar-fall { animation-name: proDollarFall; animation-timing-function: linear; animation-fill-mode: forwards; }
          .pro-logo-fall { animation-name: proLogoFall; animation-timing-function: linear; animation-fill-mode: forwards; }
          .pro-reject-pop { animation: proRejectPop 220ms ease-out; }
        `}</style>

      </div>
    </div>
  );
};

export default SimulationPage;
