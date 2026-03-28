import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, cn } from '@/lib/utils';
import Header from './Header';
import SearchableSelect from './SearchableSelect';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Calculator, RefreshCcw, TrendingUp, DollarSign, Percent, Upload, History, Info, Map as MapIcon, Check, XCircle, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

// MOCK DATA for Simulation
const MOCK_CATALOG_PRODUCTS = [
  { datasul_code: '900001', sku: 'LAVITAN COLAGENO VERISOL+AC.H PO PT300G', volume: 1000, catalog_cost: 21.3, catalog_price: 29.9, catalog_gross_price: 33.22, catalog_margin: 28.76 },
  { datasul_code: '900001', sku: 'LAVITAN COLAGENO VERISOL+AC.H PO PT300G', volume: 3000, catalog_cost: 20.8, catalog_price: 28.9, catalog_gross_price: 32.11, catalog_margin: 28.03 },
  { datasul_code: '900001', sku: 'CIMED - Lavitan Colágeno Verisol Hibisco e Limão - Pote 300g', volume: 5000, catalog_cost: 20.1, catalog_price: 27.8, catalog_gross_price: 30.89, catalog_margin: 27.7 },
  { datasul_code: '900045', sku: 'Calm Gut- Pote 175g', volume: 1000, catalog_cost: 32.5, catalog_price: 43.7, catalog_gross_price: 48.56, catalog_margin: 25.63 },
  { datasul_code: '900045', sku: 'Talita Tozzo - Calm Gut - Pote 175g', volume: 3000, catalog_cost: 31.4, catalog_price: 42.1, catalog_gross_price: 46.78, catalog_margin: 25.42 },
  { datasul_code: '900045', sku: 'Talita Tozzo - Calm Gut - Pote 175g', volume: 5000, catalog_cost: 30.8, catalog_price: 41.4, catalog_gross_price: 46.0, catalog_margin: 25.6 },
];

const SimulationPage = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  
  // State from navigation
  const initialState = location.state || {};
  
  const [selectedProductSku, setSelectedProductSku] = useState(initialState.code || initialState.sku || '');
  const [selectedVolume, setSelectedVolume] = useState(initialState.volume ? String(initialState.volume) : '');
  const [sku, setSku] = useState(initialState.sku || '');
  const [productName, setProductName] = useState(initialState.productName || '');
  const [cost, setCost] = useState(initialState.initialCost || '');
  const [price, setPrice] = useState(initialState.initialPrice || '');
  const [margin, setMargin] = useState(initialState.initialMargin || '');
  const [pis, setPis] = useState(1.65);
  const [cofins, setCofins] = useState(7.60);
  const [icms, setIcms] = useState(12.00);
  const [comissao, setComissao] = useState(0);
  const [frete, setFrete] = useState(0);
  const [encargo, setEncargo] = useState(1.5);
  const [ipi, setIpi] = useState(0);
  const [grossPrice, setGrossPrice] = useState('');
  const [mode, setMode] = useState('simularMargem'); // 'simularMargem', 'simularPreco' or 'simularPrecoBruto'
  const [calculationError, setCalculationError] = useState('');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const [history, setHistory] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
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
  
  const userArea = user?.area || user?.user_metadata?.area;
  const normalizedUserArea = String(userArea || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');
  const isPricingUser = normalizedUserArea === 'pricing'
    || normalizedUserArea === 'prevendas'
    || normalizedUserArea === 'presales'
    || normalizedUserArea === 'cs'
    || normalizedUserArea === 'clientsuccess'
    || normalizedUserArea === 'businessdev'
    || normalizedUserArea === 'businessdevelopment';
  const isPricingApprover = normalizedUserArea === 'pricing';

  // Fetch catalog/products from DB
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('simulation_catalog_prices')
          .select('*')
          .order('sku', { ascending: true })
          .order('volume', { ascending: true });
        
        if (error) throw error;
        setCatalogProducts(data && data.length > 0 ? data : MOCK_CATALOG_PRODUCTS);
      } catch (err) {
        console.error('Error fetching catalog:', err);
        setCatalogProducts(MOCK_CATALOG_PRODUCTS);
      }
    };

    fetchCatalog();
  }, [history]);

  // Generate options for the select
  const productOptions = useMemo(() => {
    const grouped = new Map();
    (catalogProducts || []).forEach(item => {
      const code = item.datasul_code ? String(item.datasul_code).trim() : '';
      if (!code) return;
      if (!grouped.has(code)) {
        grouped.set(code, { code, skuNames: new Set() });
      }
      if (item.sku) {
        grouped.get(code).skuNames.add(item.sku);
      }
    });

    return Array.from(grouped.values()).map(item => {
      const names = Array.from(item.skuNames);
      const primaryName = names[0] || item.code;
      return {
        value: item.code,
        label: `${primaryName} (${item.code})`,
        keywords: `${primaryName} ${item.code} ${names.join(' ')}`
      };
    });
  }, [catalogProducts]);

  const volumeOptions = useMemo(() => {
    if (!selectedProductSku) {
      return ['1000', '3000', '5000'];
    }
    const volumes = [...new Set(
      (catalogProducts || [])
        .filter(item => String(item.datasul_code || '').trim() === String(selectedProductSku).trim())
        .map(item => String(item.volume || '').trim())
        .filter(Boolean)
    )].sort((a, b) => Number(a) - Number(b));
    return volumes.length > 0 ? volumes : ['1000', '3000', '5000'];
  }, [catalogProducts, selectedProductSku]);

  const selectedCatalogEntry = useMemo(() => {
    if (!selectedProductSku || !selectedVolume) return null;
    return (catalogProducts || []).find(item =>
      String(item.datasul_code || '').trim() === String(selectedProductSku).trim()
      && String(item.volume || '').trim() === String(selectedVolume).trim()
    ) || null;
  }, [catalogProducts, selectedProductSku, selectedVolume]);

  // Handle product selection
  const handleProductSelect = (selectedCode) => {
    setSelectedProductSku(selectedCode);
    setSelectedVolume('');
    const firstMatch = (catalogProducts || []).find(item =>
      String(item.datasul_code || '').trim() === String(selectedCode || '').trim()
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
    setMargin(formatValue(selectedCatalogEntry.catalog_margin));
    setGrossPrice(formatValue(selectedCatalogEntry.catalog_gross_price || selectedCatalogEntry.catalog_price));
    setHasManualInput(false);
  }, [selectedCatalogEntry]);

  // Calculate on change
  useEffect(() => {
    const costNum = Number(cost) || 0;
    const priceNum = Number(price) || 0;
    const marginNum = Number(margin) || 0;

    calculate(costNum, priceNum, marginNum);
  }, [price, margin, cost, mode, pis, cofins, icms, grossPrice, comissao, frete, encargo, ipi]);

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

  const handleBlur = (setter, value) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setter(num.toFixed(2));
    }
  };

  const toRate = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return numeric / 100;
  };

  const calculatePricingFactors = ({ pisRate, cofinsRate, icmsRate }) => {
    const pisLiq = pisRate * (1 - icmsRate);
    const cofinsLiq = cofinsRate * (1 - icmsRate);
    const fatorImp = 1 - pisLiq - cofinsLiq - icmsRate;
    return { pisLiq, cofinsLiq, fatorImp };
  };

  const solvePriceByMargin = ({
    custoTotal,
    margemRate,
    pisRate,
    cofinsRate,
    icmsRate,
    comissaoRate,
    freteRate,
    encargoRate,
    ipiRate
  }) => {
    const { pisLiq, cofinsLiq, fatorImp } = calculatePricingFactors({ pisRate, cofinsRate, icmsRate });
    const denominador = 1 - comissaoRate - freteRate - (margemRate * fatorImp) - pisLiq - cofinsLiq - icmsRate;
    if (denominador <= 0) {
      return { error: 'Margem inviável para as alíquotas configuradas.' };
    }
    const pbBase = custoTotal / denominador;
    const rolBase = pbBase * fatorImp;
    const denomEnc = 1 - pisLiq - cofinsLiq - icmsRate - comissaoRate - freteRate;
    if (denomEnc <= 0) {
      return { error: 'Parâmetros inviáveis para cálculo com encargo.' };
    }
    const pbSemIpi = ((margemRate * rolBase) + custoTotal + (encargoRate * pbBase)) / denomEnc;
    const pbComIpi = pbSemIpi * (1 + ipiRate);
    const rol = pbSemIpi * fatorImp;
    if (rol <= 0) {
      return { error: 'Parâmetros inviáveis para cálculo.' };
    }
    const margemReal = (rol - custoTotal) / rol;
    return {
      pbSemIpi,
      pbComIpi,
      rol,
      margemReal
    };
  };

  const calculate = (costNum, priceNum, marginNum) => {
    const pisRate = toRate(pis);
    const cofinsRate = toRate(cofins);
    const icmsRate = toRate(icms);
    const comissaoRate = toRate(comissao);
    const freteRate = toRate(frete);
    const encargoRate = toRate(encargo);
    const ipiRate = toRate(ipi);
    const { fatorImp } = calculatePricingFactors({ pisRate, cofinsRate, icmsRate });
    const referencePriceFromCatalog = Number(
      selectedCatalogEntry?.catalog_gross_price
      ?? selectedCatalogEntry?.catalog_price
      ?? initialState.initialPrice
      ?? 0
    );
    const referenceMarginFromCatalog = Number(
      selectedCatalogEntry?.catalog_margin
      ?? initialState.initialMargin
      ?? NaN
    );
    const hasCatalogReferencePair = Number.isFinite(referencePriceFromCatalog)
      && referencePriceFromCatalog > 0
      && Number.isFinite(referenceMarginFromCatalog)
      && referenceMarginFromCatalog > -100
      && referenceMarginFromCatalog < 100;
    const referenceCostFromCatalog = hasCatalogReferencePair
      ? (referencePriceFromCatalog * (1 - (referenceMarginFromCatalog / 100)))
      : NaN;
    const hasCurrentReferencePair = Number.isFinite(priceNum)
      && priceNum > 0
      && Number.isFinite(marginNum)
      && marginNum > -100
      && marginNum < 100;
    const referenceCostFromCurrent = hasCurrentReferencePair
      ? (priceNum * (1 - (marginNum / 100)))
      : NaN;
    const referenceCost = mode === 'simularMargem'
      ? (Number.isFinite(referenceCostFromCatalog) ? referenceCostFromCatalog : (Number.isFinite(referenceCostFromCurrent) ? referenceCostFromCurrent : costNum))
      : (Number.isFinite(referenceCostFromCurrent) ? referenceCostFromCurrent : (Number.isFinite(referenceCostFromCatalog) ? referenceCostFromCatalog : costNum));

    if (mode === 'simularMargem') {
      const margemRate = marginNum / 100;
      const margemDenominador = 1 - margemRate;
      if (margemDenominador <= 0) {
        setCalculationError('Margem inviável para os parâmetros atuais.');
        return;
      }
      const suggestedPrice = referenceCost / margemDenominador;
      if (Math.abs(suggestedPrice - priceNum) > 0.01) {
        setPrice(suggestedPrice.toFixed(2));
      }
      if (Math.abs(suggestedPrice - Number(grossPrice)) > 0.01) {
        setGrossPrice(suggestedPrice.toFixed(2));
      }
      setCalculationError('');
    } else if (mode === 'simularPreco') {
      const simulatedPrice = Number(grossPrice);
      if (simulatedPrice <= 0) {
        setCalculationError('');
        return;
      }
      if (Math.abs(simulatedPrice - priceNum) > 0.01) {
        setPrice(simulatedPrice.toFixed(2));
      }
      const calculatedMargin = ((simulatedPrice - referenceCost) / simulatedPrice) * 100;
      if (Number.isFinite(calculatedMargin) && Math.abs(calculatedMargin - marginNum) > 0.01) {
        setMargin(calculatedMargin.toFixed(2));
      }
      setCalculationError('');
    } else if (mode === 'simularPrecoBruto') {
      if (fatorImp <= 0) {
        setCalculationError('Não foi possível calcular com as alíquotas atuais.');
        return;
      }
      const gross = priceNum / fatorImp;
      if (Math.abs(gross - Number(grossPrice)) > 0.01) {
        setGrossPrice(gross.toFixed(2));
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
    setShowSaveModal(true);
  };

  const handleSaveSimulation = async () => {
    if (!user) return;
    if (!saveForm.clientName.trim()) {
      toast.error('Cliente é obrigatório.');
      return;
    }

    try {
      setLoading(true);
      const parsedPrice = Number(price) || 0;
      const parsedCost = Number(cost) || 0;
      const parsedMargin = Number(margin) || 0;
      const parsedGrossPrice = Number(grossPrice) || 0;

      const { error } = await supabase
        .from('simulations_history')
        .insert({
          user_id: user.id,
          sku: sku || 'N/A',
          datasul_code: selectedProductSku || null,
          volume: selectedVolume ? Number(selectedVolume) : null,
          product_name: productName || 'Simulação Avulsa',
          price: parsedPrice,
          cost: parsedCost,
          margin: parsedMargin,
          mode: mode,
          pis: Number(pis),
          cofins: Number(cofins),
          icms: Number(icms),
          gross_price: parsedGrossPrice,
          user_email: user.email,
          user_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          client_name: saveForm.clientName.trim(),
          target: saveForm.target?.trim() || null,
          observations: saveForm.observations?.trim() || null,
          catalog_cost: Number(selectedCatalogEntry?.catalog_cost || 0),
          catalog_price: Number(selectedCatalogEntry?.catalog_price || 0),
          catalog_gross_price: Number(selectedCatalogEntry?.catalog_gross_price || selectedCatalogEntry?.catalog_price || 0),
          catalog_margin: Number(selectedCatalogEntry?.catalog_margin || 0)
        });

      if (error) throw error;
      
      toast.success('Simulação salva com sucesso!');
      setShowSaveModal(false);
      setSaveForm({ clientName: '', target: '', observations: '' });
      if (isPricingUser) loadHistory();
      
    } catch (error) {
      console.error('Error saving simulation:', error);
      toast.error(`Erro ao salvar simulação: ${error.message || 'Erro desconhecido'}`);
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

  const handleDeleteSimulation = async (simulationId) => {
    if (!simulationId || !isPricingUser) return;
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
      toast.error(`Erro ao excluir simulação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeHistoryDetailModal = () => {
    setIsClosingHistoryDetailModal(true);
    setTimeout(() => {
      setShowHistoryDetailModal(false);
      setSelectedHistoryItem(null);
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
  const marginForDisplay = Number(margin || 0);
  const priceForDisplay = mode === 'simularPrecoBruto'
    ? Number(grossPrice || 0)
    : Number(grossPrice || selectedCatalogEntry?.catalog_gross_price || selectedCatalogEntry?.catalog_price || 0);

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
    if (!selectedHistoryItem?.id || !isPricingApprover || !user) return;
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
      toast.error(`Erro ao atualizar status: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleImportTable = () => {
    setShowImportModal(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile || !user) return;

    try {
      setLoading(true);
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast.warning('A planilha está vazia.');
            return;
          }

          const processedData = [];
          let successCount = 0;
          let errorCount = 0;

          const parseNumber = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
              let clean = val.replace(/[R$\s]/g, '').trim();
              if (clean === '') return 0;
              // Handle comma as decimal separator (Brazilian format)
              if (clean.includes(',') && !clean.includes('.')) {
                clean = clean.replace(',', '.');
              } else if (clean.includes(',') && clean.includes('.')) {
                // Assume 1.000,00 format
                clean = clean.replace(/\./g, '').replace(',', '.');
              }
              const num = Number(clean);
              return isNaN(num) ? 0 : num;
            }
            return 0;
          };

          const getUserName = () => {
             return user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
          };

          for (const row of jsonData) {
            // Map columns based on user requirement:
            // ID simulação / Versão / Custo / Margem / Preço liquido / Preço bruto
            
            const rowKeys = Object.keys(row);
            
            // Helper to normalize keys (remove accents, lowercase, trim)
            const normalizeKey = (key) => {
              if (!key) return '';
              return key
                .toString()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim();
            };

            const getVal = (targetKeys) => {
              // Accepts a single key or array of possible keys
              const targets = Array.isArray(targetKeys) ? targetKeys : [targetKeys];
              
              for (const target of targets) {
                const normalizedTarget = normalizeKey(target);
                const foundKey = rowKeys.find(k => normalizeKey(k) === normalizedTarget);
                if (foundKey) return row[foundKey];
              }
              return null;
            };

            const idSimulacao = getVal(['ID simulação', 'ID simulacao', 'id']);
            const version = getVal(['Versao', 'Versão', 'Version']);
            const costVal = getVal(['CustoTotal', 'Custo', 'Cost']);
            const marginVal = getVal(['Margem', 'Margin']);
            const priceNetVal = getVal(['PrecoLiq', 'Preço liquido', 'Preco liquido', 'Net Price', 'Preço Líquido']);
            const priceGrossVal = getVal(['PrecoBruto', 'Preço bruto', 'Preco bruto', 'Gross Price', 'Preço Bruto']);

            // Basic validation - at least one financial value must be present
            if (costVal == null && priceNetVal == null && priceGrossVal == null) {
              console.log('Skipping row due to missing data:', row);
              errorCount++;
              continue;
            }

            processedData.push({
              user_id: user.id,
              user_email: user.email,
              user_name: getUserName(),
              sku: idSimulacao || 'N/A',
              product_name: version || `Sem nome`,
              cost: parseNumber(costVal),
              margin: parseNumber(marginVal),
              price: parseNumber(priceNetVal),
              gross_price: parseNumber(priceGrossVal),
              version: version ? String(version) : null,
              mode: 'import',
              // If ID is provided and valid UUID, we could use it, but for history we usually generate new IDs.
              // We'll ignore ID simulação for insertion to avoid conflicts, or store it in a metadata field if needed.
              // For now, we treat this as adding new history records.
            });
            successCount++;
          }

          if (processedData.length === 0) {
            toast.warning('Nenhum dado válido encontrado para importação.');
            return;
          }

          const { error } = await supabase
            .from('simulations_history')
            .insert(processedData);

          if (error) throw error;

          toast.success(`${successCount} registros importados com sucesso!`);
          if (errorCount > 0) {
            toast.warning(`${errorCount} linhas ignoradas por falta de dados.`);
          }

          setShowImportModal(false);
          setImportFile(null);
          if (isPricingUser) loadHistory();

        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          toast.error('Erro ao processar arquivo Excel.');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error('Erro ao iniciar importação.');
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val);
    if (isNaN(num)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatPercent = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0,00%';
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num / 100);
  };

  const formatCurrencyInput = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    const numeric = Number(digits) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric || 0);
  };

  const grossPriceForSaveModal = useMemo(() => {
    return Number(grossPrice) || 0;
  }, [grossPrice]);

  const selectedHistoryMetrics = useMemo(() => {
    if (!selectedHistoryItem) return null;
    const volume = Number(selectedHistoryItem.volume || 0);
    const catalogPrice = Number(selectedHistoryItem.catalog_price || 0);
    const catalogGrossPrice = Number(selectedHistoryItem.catalog_gross_price || 0);
    const catalogMargin = Number(selectedHistoryItem.catalog_margin || 0);
    const simulatedPrice = Number(selectedHistoryItem.price || 0);
    const simulatedGrossPrice = Number(selectedHistoryItem.gross_price || 0);
    const simulatedMargin = Number(selectedHistoryItem.margin || 0);
    const robCatalog = volume * (catalogGrossPrice || catalogPrice);
    const robEstimated = volume * (simulatedGrossPrice || simulatedPrice);
    const mbCatalog = robCatalog * (catalogMargin / 100);
    const mbEstimated = robEstimated * (simulatedMargin / 100);
    return {
      volume,
      catalogPrice,
      catalogGrossPrice,
      catalogMargin,
      simulatedPrice,
      simulatedGrossPrice,
      simulatedMargin,
      robCatalog,
      robEstimated,
      mbCatalog,
      mbEstimated,
      grossPriceVariation: simulatedGrossPrice - catalogGrossPrice,
      marginVariationPp: simulatedMargin - catalogMargin,
      robVariation: robEstimated - robCatalog,
      mbVariation: mbEstimated - mbCatalog
    };
  }, [selectedHistoryItem]);

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
        
        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#171717] dark:border dark:border-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl transition-all duration-200">
              <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar Simulações
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Arquivo Excel (.xlsx, .xls)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
                    />
                  </div>
                  {importFile && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Arquivo selecionado: {importFile.name}
                    </p>
                  )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Formato esperado das colunas:</p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                    <li>ID simulação</li>
                    <li>Versao</li>
                    <li>CustoTotal</li>
                    <li>Margem</li>
                    <li>PrecoLiq</li>
                    <li>PrecoBruto</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile || loading}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                <Button variant="outline" size="sm" onClick={handleImportTable} className="gap-2">
                  <Upload size={16} />
                  Importar Tabela
                </Button>
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
                    <div className="font-medium">{formatCurrency(priceForDisplay)}</div>
                 </div>
                 <div className="space-y-1 md:col-span-2 md:text-right">
                    <Label className="text-xs text-muted-foreground">Margem</Label>
                    <div className="font-medium">{formatPercent(marginForDisplay)}</div>
                 </div>
              </div>

              <Tabs value={mode} onValueChange={setMode} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="simularMargem">Simular Margem</TabsTrigger>
                  <TabsTrigger value="simularPreco">Simular Preço</TabsTrigger>
                  <TabsTrigger value="simularPrecoBruto">Simular Preço Bruto</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                {/* Cost Input - Restricted View (Hidden in simularPrecoBruto mode) */}
                {mode !== 'simularPrecoBruto' && (
                  <div className="space-y-2 relative">
                    <Label htmlFor="cost" className="flex items-center gap-2">
                      Custo do Produto
                      {!isPricingUser && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                      <Input 
                        id="cost" 
                        type="number" 
                        value={cost} 
                        onChange={(e) => setCost(e.target.value)}
                        onBlur={(e) => handleBlur(setCost, e.target.value)}
                        disabled={!isPricingUser || mode === 'simularMargem' || mode === 'simularPreco'}
                        className={cn(
                          "pl-8",
                          !isPricingUser && "bg-muted text-transparent select-none",
                          (mode === 'simularMargem' || mode === 'simularPreco') && "bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                        )}
                      />
                      {!isPricingUser && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground font-medium bg-muted/50 rounded-md backdrop-blur-[2px]">
                          Confidencial
                        </div>
                      )}
                    </div>
                    {(mode === 'simularMargem' || mode === 'simularPreco') && (
                       <p className="text-[10px] text-muted-foreground">O custo é fixo baseado no produto selecionado.</p>
                    )}
                  </div>
                )}

                {/* Dynamic Inputs based on Mode */}
                {mode === 'simularMargem' ? (
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
                        onBlur={(e) => handleBlur(setMargin, e.target.value)}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : mode === 'simularPreco' ? (
                  <div className="space-y-2">
                    <Label htmlFor="grossPrice">Preço novo</Label>
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
                ) : (
                  // Mode: simularPrecoBruto
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="basePrice">Preço Líquido Base</Label>
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
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">SP</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">18%</span>
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
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                  Produtos Importados
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">IM (Importação)</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">4%</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100 dark:border-blue-800/30">
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                  <Info className="w-3 h-3" />
                                  PIS e COFINS são iguais para todos os estados.
                                </p>
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
                          value={price} 
                          onChange={(e) => setPrice(e.target.value)}
                          disabled={true}
                          placeholder="0.00"
                          className="pl-8 font-semibold bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">O preço base é fixo baseado no produto selecionado.</p>
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
            <CardFooter>
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
                  {mode === 'simularMargem' ? 'Preço Sugerido' : 
                   mode === 'simularPreco' ? 'Margem Resultante' : 
                   'Preço Bruto Calculado'}
                </span>
                <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {mode === 'simularMargem' ? (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(grossPrice))}
                    </span>
                  ) : mode === 'simularPreco' ? (
                    isPricingUser ? (
                      <span className={marginForDisplay < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}>
                        {formatPercent(marginForDisplay)}
                      </span>
                    ) : '***'
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
                  Margem catálogo: {formatPercent(catalogMarginValue || Number(margin || 0))}
                </div>
                
                {/* Tax Breakdown (only for simularPrecoBruto mode) */}
                {mode === 'simularPrecoBruto' && Number(grossPrice) > 0 && (
                   <div className="mt-4 flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">PIS: {pis}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">COFINS: {cofins}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">ICMS: {icms}%</span>
                   </div>
                )}
                
                {!isPricingUser && mode === 'simularPreco' && (
                  <Badge variant="outline" className="mt-4 border-yellow-200 bg-yellow-50 text-yellow-700">
                    Restrito ao Pricing
                  </Badge>
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
                    {isPricingUser ? formatCurrency(Number(cost)) : 'Confidencial'}
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
                    {isPricingUser ? formatCurrency(Number(price) - Number(cost)) : 'Confidencial'}
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* History Log - Only for Pricing */}
        {isPricingUser && (
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
                        <TableHead className="text-left">Produto</TableHead>
                        <TableHead className="text-left">Volume</TableHead>
                        <TableHead className="text-left">Custo Total</TableHead>
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
                              setIsClosingHistoryDetailModal(false);
                              setShowHistoryDetailModal(true);
                            }}
                          >
                            <TableCell className="text-xs font-mono text-gray-500 align-top">
                              {item.simulation_number || item.id.substring(0, 8)}
                            </TableCell>
                            <TableCell className="font-medium text-xs leading-tight break-words align-top" title={item.product_name}>
                              {item.product_name}
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              {item.volume || '-'}
                            </TableCell>
                            <TableCell className="text-xs align-top">
                              {formatCurrency(item.cost)}
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
        )}

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
              </div>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Input
                  value={saveForm.clientName}
                  onChange={(e) => setSaveForm(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Informe o cliente"
                />
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
                <Button variant="outline" onClick={() => setShowSaveModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveSimulation} disabled={loading} className="bg-[#845AFA] hover:bg-[#6b46c1] text-white">
                  Confirmar e Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

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
                  <Badge className={cn("text-[11px] border bg-white/10 text-white border-white/30", getApprovalStatus(selectedHistoryItem) === 'approved' && "bg-green-500/20 border-green-200/30", getApprovalStatus(selectedHistoryItem) === 'rejected' && "bg-red-500/20 border-red-200/30")}>
                    {approvalStatusUi[getApprovalStatus(selectedHistoryItem)].label}
                  </Badge>
                  <Button variant="outline" size="icon" className="bg-white text-[#6b46c1] border-white hover:bg-purple-50" onClick={closeHistoryDetailModal}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10">
                    <div className="font-semibold mb-3 text-[#6b46c1] dark:text-purple-300">Catálogo</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Líquido</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.catalogPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Bruto</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.catalogGrossPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Margem</span><span className="font-medium">{formatPercent(selectedHistoryMetrics.catalogMargin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">ROB</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.robCatalog)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">MB</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.mbCatalog)}</span></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#845AFA]/20 dark:border-[#845AFA]/30 bg-white dark:bg-[#1a1a1a]">
                    <div className="font-semibold mb-3 text-[#845AFA]">Simulado</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Líquido</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.simulatedPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Preço Bruto</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.simulatedGrossPrice)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Margem</span><span className="font-medium">{formatPercent(selectedHistoryMetrics.simulatedMargin)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">ROB</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.robEstimated)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">MB</span><span className="font-medium">{formatCurrency(selectedHistoryMetrics.mbEstimated)}</span></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#181818]">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. Preço Bruto</div>
                    <div className={cn("text-lg font-bold mt-1", selectedHistoryMetrics.grossPriceVariation < 0 ? "text-red-500" : "text-green-600 dark:text-green-400")}>
                      {formatCurrency(selectedHistoryMetrics.grossPriceVariation)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#181818]">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. Margem</div>
                    <div className={cn("text-lg font-bold mt-1", selectedHistoryMetrics.marginVariationPp < 0 ? "text-red-500" : "text-green-600 dark:text-green-400")}>
                      {selectedHistoryMetrics.marginVariationPp.toFixed(2)} p.p.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#181818]">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. ROB</div>
                    <div className={cn("text-lg font-bold mt-1", selectedHistoryMetrics.robVariation < 0 ? "text-red-500" : "text-green-600 dark:text-green-400")}>
                      {formatCurrency(selectedHistoryMetrics.robVariation)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#181818]">
                    <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Var. MB</div>
                    <div className={cn("text-lg font-bold mt-1", selectedHistoryMetrics.mbVariation < 0 ? "text-red-500" : "text-green-600 dark:text-green-400")}>
                      {formatCurrency(selectedHistoryMetrics.mbVariation)}
                    </div>
                  </div>
                </div>
                {isPricingApprover && (
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
