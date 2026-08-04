import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Globe2,
  Info,
  Map as MapIcon,
  Package,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/utils';
import Header from './Header';
import SearchableSelect from './SearchableSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { logExport } from '@/utils/activityLog';
import { getPermissionErrorMessage, isPermissionError } from '@/utils/permissionErrors';

const VOLUMES = [1000, 1500, 3000, 5000];
const DEFAULT_CATEGORIES = ['Pó', 'Gel', 'Goma', 'Softgel'];
const EXPIRY_DATE_TEXT = '31/08/2026';
const EXPIRY_DATE = new Date(2026, 7, 31);

const BrazilMapIcon = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="5.5"
      y="7"
      width="21"
      height="18"
      rx="2.75"
      stroke="currentColor"
      strokeWidth="2.2"
    />
    <path
      d="M16 10.6 22.1 16 16 21.4 9.9 16 16 10.6Z"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <circle cx="16" cy="16" r="2.8" stroke="currentColor" strokeWidth="2.2" />
    <path
      d="M12.2 16.4c1.2-.8 2.5-1.2 3.9-1.2 1.1 0 2.2.2 3.4.7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const CATALOG_CONFIG = {
  brazil: {
    key: 'brazil',
    title: 'Catálogo Brasil',
    selectionTitle: 'Catálogo Brasil 2026',
    selectionDescription: 'Precos e volumes do Brasil.',
    description: 'Visualize o catálogo Brasil com filtros, importação, exportação e manutenção.',
    tableName: 'catalog_br_prices',
    idField: 'simulation_id',
    costField: 'catalog_cost',
    marginField: 'catalog_margin',
    primaryPriceField: 'catalog_price',
    secondaryPriceField: 'catalog_gross_price',
    userPrimaryPriceLabel: 'Preço Líquido',
    userSecondaryPriceLabel: 'Preço Bruto',
    userPrimaryPriceSymbol: 'R$',
    userSecondaryPriceSymbol: 'R$',
    pricingPrimaryPriceLabel: 'Preço Líquido',
    pricingSecondaryPriceLabel: 'Preço Bruto',
    pricingPrimaryPriceSymbol: 'R$',
    pricingSecondaryPriceSymbol: 'R$',
    exportFileName: 'catalogo-brasil-2026.xlsx',
    sheetName: 'Catalogo Brasil 2026',
    editTitle: 'Editar registro do Catálogo Brasil',
    icon: BrazilMapIcon,
    preserveDatasulCode: true,
    parameters: {
      freight: 'FOB',
      paymentTerm: 'À vista',
      taxes: [
        { label: 'PIS e COFINS', value: '9.25%' },
        { label: 'ICMS', value: '12%' },
      ],
      serviceValues: [
        { label: 'Gomas', value: 'Full service Ekobé' },
        { label: 'Softgel', value: 'Full service HLCaps' },
      ],
    },
    importAliases: {
      id: ['ID', 'id'],
      sku: ['SKU', 'sku'],
      cost: ['Custo', 'custo'],
      margin: ['Margem', 'margem'],
      primaryPrice: ['Preço Líquido', 'Preco Liquido', 'Preco Líquido', 'preco liquido', 'Preço em R$', 'Preco em R$'],
      secondaryPrice: ['Preço Bruto', 'Preco Bruto', 'Preco bruto', 'preco bruto', 'Preço em $', 'Preco em $'],
      volume: ['Volume', 'volume'],
      category: ['Categoria', 'categoria', 'category'],
    },
  },
  latam: {
    key: 'latam',
    title: 'Catálogo Latam',
    selectionTitle: 'Catálogo Latam 2026',
    selectionDescription: 'Precos e volumes da Latam.',
    description: 'Visualize o catálogo Latam com filtros, importação, exportação e manutenção.',
    tableName: 'catalog_latam_prices',
    idField: 'catalog_id',
    costField: 'catalog_cost',
    marginField: 'catalog_margin',
    primaryPriceField: 'price_brl',
    secondaryPriceField: 'price_usd',
    userPrimaryPriceLabel: 'Preço em R$',
    userSecondaryPriceLabel: 'Preço em $',
    userPrimaryPriceSymbol: 'R$',
    userSecondaryPriceSymbol: '$',
    pricingPrimaryPriceLabel: 'Preço BRL',
    pricingSecondaryPriceLabel: 'Preço em $',
    pricingPrimaryPriceSymbol: 'R$',
    pricingSecondaryPriceSymbol: '$',
    exportFileName: 'catalogo-latam-2026.xlsx',
    sheetName: 'Catalogo Latam 2026',
    editTitle: 'Editar registro do Catálogo Latam',
    icon: Globe2,
    ptaxLabel: 'PTAX',
    ptaxValue: 'R$ 4,48',
    preserveDatasulCode: false,
    parameters: {
      freight: 'EX WORKS',
      paymentTerm: 'À vista',
      taxes: [
        { label: 'Impostos', value: '0%' },
      ],
    },
    importAliases: {
      id: ['ID', 'id'],
      sku: ['SKU', 'sku'],
      cost: ['Custo', 'custo'],
      margin: ['Margem', 'margem'],
      primaryPrice: ['Preço Líquido', 'Preco Liquido', 'Preco Líquido', 'preco liquido', 'Preço em R$', 'Preco em R$'],
      secondaryPrice: ['Preço Bruto', 'Preco Bruto', 'Preco bruto', 'preco bruto', 'Preço em $', 'Preco em $'],
      volume: ['Volume', 'volume'],
      category: ['Categoria', 'categoria', 'category'],
    },
  },
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const parseNumber = (value) => {
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

const formatCurrency = (value, symbol = 'R$') => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  const formattedNumber = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
  return `${symbol} ${formattedNumber}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = parseNumber(value);
  if (number === null) return '—';
  const percentageValue = Math.abs(number) <= 1 ? number * 100 : number;
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(percentageValue)}%`;
};

const formatVolume = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

const sortCatalogRows = (rows) =>
  [...(rows || [])].sort((a, b) => {
    const skuCompare = String(a?.sku || '').localeCompare(String(b?.sku || ''), 'pt-BR', {
      sensitivity: 'base',
    });
    if (skuCompare !== 0) return skuCompare;
    return Number(a?.volume || 0) - Number(b?.volume || 0);
  });

const getDaysUntilExpiry = () => {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfExpiry = new Date(
    EXPIRY_DATE.getFullYear(),
    EXPIRY_DATE.getMonth(),
    EXPIRY_DATE.getDate(),
    23,
    59,
    59,
    999
  );
  return Math.ceil((endOfExpiry.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
};

const CatalogoPro = ({ user }) => {
  const { isPricing: isPricingUser, user: authUser } = useAuth();
  const [selectedCatalog, setSelectedCatalog] = useState('');
  const [catalogRows, setCatalogRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fullModeFilters, setFullModeFilters] = useState({
    sku: [],
    category: '',
    volume: '',
  });
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    catalogId: '',
    cost: '',
    margin: '',
    primaryPrice: '',
    secondaryPrice: '',
  });
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedCatalogConfig = selectedCatalog ? CATALOG_CONFIG[selectedCatalog] : null;

  const validityAlert = useMemo(() => {
    const daysUntilExpiry = getDaysUntilExpiry();

    if (daysUntilExpiry > 30) return null;

    if (daysUntilExpiry > 0) {
      return {
        title: 'Validade dos preços próxima do vencimento',
        description: `Faltam ${daysUntilExpiry} dia(s) para o vencimento dos preços em ${EXPIRY_DATE_TEXT}.`,
        className: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20',
        iconClassName: 'text-amber-600 dark:text-amber-400',
      };
    }

    if (daysUntilExpiry === 0) {
      return {
        title: 'Validade dos preços vence hoje',
        description: `Os preços vencem hoje (${EXPIRY_DATE_TEXT}). Para atualização, acesse o time de Data. O catálogo continua disponível para consulta.`,
        className: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
        iconClassName: 'text-red-600 dark:text-red-400',
      };
    }

    return {
      title: 'Validade dos preços encerrada',
      description: `A validade dos preços foi encerrada em ${EXPIRY_DATE_TEXT}. Para atualização, acesse o time de Data. O catálogo continua disponível para consulta.`,
      className: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20',
      iconClassName: 'text-red-600 dark:text-red-400',
    };
  }, []);

  const loadCatalog = useCallback(async (catalogKey = selectedCatalog) => {
    const config = CATALOG_CONFIG[catalogKey];
    if (!config) return;

    try {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from(config.tableName)
        .select('*')
        .order('sku', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;
      setCatalogRows(sortCatalogRows(data || []));
    } catch (error) {
      console.error(`Erro ao carregar ${config.title}:`, error);
      setCatalogRows([]);
      setErrorMessage(`Não foi possível carregar o ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [selectedCatalog]);

  useEffect(() => {
    setFullModeFilters({ sku: [], category: '', volume: '' });
    setErrorMessage('');
    setCatalogRows([]);

    if (!selectedCatalog) {
      setLoading(false);
      return;
    }

    loadCatalog(selectedCatalog);
  }, [selectedCatalog, loadCatalog]);

  const sortedCatalogRows = useMemo(() => sortCatalogRows(catalogRows), [catalogRows]);

  const uniqueSkuOptions = useMemo(() => {
    const grouped = new Map();

    sortedCatalogRows.forEach((row) => {
      const sku = String(row?.sku || '').trim();
      if (!sku) return;
      if (!grouped.has(sku)) {
        grouped.set(sku, {
          value: sku,
          label: sku,
          codes: new Set(),
        });
      }

      if (row?.datasul_code) {
        grouped.get(sku).codes.add(String(row.datasul_code).trim());
      }
    });

    return Array.from(grouped.values()).map((item) => ({
      value: item.value,
      label: item.label,
      keywords: `${item.label} ${Array.from(item.codes).join(' ')}`.trim(),
    }));
  }, [sortedCatalogRows]);

  const categoryOptions = useMemo(() => {
    const categories = new Set(DEFAULT_CATEGORIES);
    sortedCatalogRows.forEach((row) => {
      if (row?.category) categories.add(String(row.category).trim());
    });

    return Array.from(categories)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
      .map((category) => ({ value: category, label: category }));
  }, [sortedCatalogRows]);

  const filteredFullRows = useMemo(() => {
    return sortedCatalogRows.filter((row) => {
      const selectedSkus = Array.isArray(fullModeFilters.sku) ? fullModeFilters.sku : [];
      const matchesSku = selectedSkus.length === 0 || selectedSkus.includes(row.sku);
      const matchesVolume = !fullModeFilters.volume || Number(row?.volume) === Number(fullModeFilters.volume);
      const matchesCategory = !fullModeFilters.category || row?.category === fullModeFilters.category;
      return matchesSku && matchesVolume && matchesCategory;
    });
  }, [sortedCatalogRows, fullModeFilters]);

  const hasActiveFullFilters = Boolean(
    (Array.isArray(fullModeFilters.sku) && fullModeFilters.sku.length > 0)
    || fullModeFilters.category
    || fullModeFilters.volume
  );

  const handleBackToSelection = () => {
    setSelectedCatalog('');
    setFullModeFilters({ sku: [], category: '', volume: '' });
    setShowImportDialog(false);
    setSelectedImportFile(null);
    setEditOpen(false);
    setEditingRow(null);
    setDeleteRow(null);
  };

  const handleExport = async () => {
    if (!selectedCatalogConfig) return;

    try {
      setExporting(true);
      const { data, error } = await supabase
        .from(selectedCatalogConfig.tableName)
        .select('*')
        .order('sku', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;

      const exportRows = (data || []).map((row) => {
        if (isPricingUser) {
          return {
            ID: row[selectedCatalogConfig.idField] || '',
            SKU: row.sku || '',
            Custo: row[selectedCatalogConfig.costField] ?? '',
            Margem: row[selectedCatalogConfig.marginField] ?? '',
            [selectedCatalogConfig.pricingPrimaryPriceLabel]: row[selectedCatalogConfig.primaryPriceField] ?? '',
            [selectedCatalogConfig.pricingSecondaryPriceLabel]: row[selectedCatalogConfig.secondaryPriceField] ?? '',
            Volume: row.volume ?? '',
            Categoria: row.category || '',
          };
        }

        return {
          SKU: row.sku || '',
          Volume: row.volume ?? '',
          [selectedCatalogConfig.userPrimaryPriceLabel]: row[selectedCatalogConfig.primaryPriceField] ?? '',
          [selectedCatalogConfig.userSecondaryPriceLabel]: row[selectedCatalogConfig.secondaryPriceField] ?? '',
          Categoria: row.category || '',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, selectedCatalogConfig.sheetName);
      XLSX.writeFile(workbook, selectedCatalogConfig.exportFileName);
        await logExport(selectedCatalogConfig.tableName, exportRows.length, {
          format: 'xlsx',
          file_name: selectedCatalogConfig.exportFileName,
        });
      toast.success(`Exportação do ${selectedCatalogConfig.title} concluída com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar catálogo:', error);
      toast.error(`Erro ao exportar catálogo: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportButtonClick = () => {
    if (!isPricingUser || importing) return;
    setSelectedImportFile(null);
    setShowImportDialog(true);
  };

  const handleImportSubmit = () => {
    if (!isPricingUser || importing || !selectedImportFile) return;
    handleImportFile(selectedImportFile);
  };

  const handleImportFile = async (file) => {
    if (!file || !isPricingUser || !selectedCatalogConfig) return;

    try {
      setImporting(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!Array.isArray(jsonRows) || jsonRows.length === 0) {
        toast.error('A planilha está vazia.');
        return;
      }

      const normalizeHeader = (header) => normalizeText(header).replace(/\s+/g, ' ');
      const getValueByHeader = (row, candidates) => {
        const headers = Object.keys(row || {});
        const match = headers.find((header) => {
          const normalized = normalizeHeader(header);
          return candidates.some((candidate) => normalizeHeader(candidate) === normalized);
        });
        return match ? row[match] : '';
      };

      const requiredHeaders = [
        selectedCatalogConfig.importAliases.id,
        selectedCatalogConfig.importAliases.sku,
        selectedCatalogConfig.importAliases.cost,
        selectedCatalogConfig.importAliases.margin,
        selectedCatalogConfig.importAliases.primaryPrice,
        selectedCatalogConfig.importAliases.secondaryPrice,
        selectedCatalogConfig.importAliases.volume,
        selectedCatalogConfig.importAliases.category,
      ];

      const firstRow = jsonRows[0] || {};
      const missingColumns = requiredHeaders.filter((candidates) => {
        const value = getValueByHeader(firstRow, candidates);
        return value === '' && !Object.keys(firstRow).some((header) => {
          const normalized = normalizeHeader(header);
          return candidates.some((candidate) => normalizeHeader(candidate) === normalized);
        });
      });

      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias não encontradas: ${missingColumns.map((item) => item[0]).join(', ')}`);
        return;
      }

      const existingBySkuVolume = new Map();
      const existingByCatalogId = new Map();

      sortedCatalogRows.forEach((row) => {
        const skuKey = `${normalizeText(row?.sku)}::${Number(row?.volume || 0)}`;
        if (!existingBySkuVolume.has(skuKey)) existingBySkuVolume.set(skuKey, row);
        const existingCatalogId = String(row?.[selectedCatalogConfig.idField] || '').trim();
        if (existingCatalogId && !existingByCatalogId.has(existingCatalogId)) {
          existingByCatalogId.set(existingCatalogId, row);
        }
      });

      let successCount = 0;
      let errorCount = 0;
      let replacedByIdCount = 0;
      let updatedBySkuVolumeCount = 0;
      let insertedCount = 0;
      const replacedByIdDetails = [];

      for (const row of jsonRows) {
        const idRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.id);
        const skuRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.sku);
        const categoryRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.category);
        const volumeRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.volume);
        const costRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.cost);
        const marginRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.margin);
        const primaryPriceRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.primaryPrice);
        const secondaryPriceRaw = getValueByHeader(row, selectedCatalogConfig.importAliases.secondaryPrice);

        const catalogId = String(idRaw || '').trim();
        const sku = String(skuRaw || '').trim();
        const category = String(categoryRaw || '').trim();
        const volume = Number(parseNumber(volumeRaw));
        const catalogCost = parseNumber(costRaw);
        const catalogMargin = parseNumber(marginRaw);
        const primaryPrice = parseNumber(primaryPriceRaw);
        const secondaryPrice = parseNumber(secondaryPriceRaw);

        if (!catalogId || !sku || !category || !VOLUMES.includes(volume)) {
          errorCount += 1;
          continue;
        }

        if ([catalogCost, catalogMargin, primaryPrice, secondaryPrice].some((item) => item === null)) {
          errorCount += 1;
          continue;
        }

        const existingRowById = existingByCatalogId.get(catalogId);
        const existingRowBySkuVolume = existingBySkuVolume.get(`${normalizeText(sku)}::${volume}`);
        const existingRow = existingRowById || existingRowBySkuVolume;
        const payload = {
          sku,
          volume,
          category,
          [selectedCatalogConfig.idField]: catalogId,
          [selectedCatalogConfig.costField]: catalogCost,
          [selectedCatalogConfig.marginField]: catalogMargin,
          [selectedCatalogConfig.primaryPriceField]: primaryPrice,
          [selectedCatalogConfig.secondaryPriceField]: secondaryPrice,
        };

        if (selectedCatalogConfig.preserveDatasulCode && existingRow?.datasul_code) {
          payload.datasul_code = existingRow.datasul_code;
        }

        let error = null;

        if (existingRowById?.id) {
          const result = await supabase
            .from(selectedCatalogConfig.tableName)
            .update(payload)
            .eq('id', existingRowById.id);
          error = result.error;
        } else {
          const result = await supabase
            .from(selectedCatalogConfig.tableName)
            .upsert(payload, { onConflict: 'sku,volume' });
          error = result.error;
        }

        if (error) {
          console.error('Erro no upsert do catálogo:', error, payload);
          errorCount += 1;
          continue;
        }

        successCount += 1;

        if (existingRowById) {
          replacedByIdCount += 1;
          replacedByIdDetails.push(
            `ID ${catalogId} | SKU ${sku} | Vol ${formatVolume(volume)}`
          );
          existingByCatalogId.set(catalogId, { ...existingRowById, ...payload });
        } else if (existingRowBySkuVolume) {
          updatedBySkuVolumeCount += 1;
        } else {
          insertedCount += 1;
        }
      }

      await loadCatalog(selectedCatalog);
      setShowImportDialog(false);
      setSelectedImportFile(null);

      if (successCount > 0) {
        const details = [
          `${insertedCount} novo(s)`,
          `${updatedBySkuVolumeCount} atualizado(s) por SKU/volume`,
          `${replacedByIdCount} substituído(s) por ID existente`,
        ].join(' | ');
        const replacedMessage = replacedByIdDetails.length > 0
          ? ` IDs substituídos: ${replacedByIdDetails.slice(0, 5).join('; ')}${replacedByIdDetails.length > 5 ? ' ...' : ''}.`
          : '';
        toast.success(`${successCount} linhas inseridas/atualizadas com sucesso. ${errorCount} erro(s). ${details}.${replacedMessage}`);
      } else {
        toast.error(`Nenhuma linha importada. ${errorCount} erro(s) encontrados.`);
      }
    } catch (error) {
      console.error('Erro ao importar catálogo:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode importar itens deste catálogo.')
          : `Erro ao importar catálogo: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEdit = (row) => {
    if (!row?.id || !isPricingUser || !selectedCatalogConfig) return;
    setEditingRow(row);
    setEditForm({
      catalogId: row?.[selectedCatalogConfig.idField] ?? '',
      cost: row?.[selectedCatalogConfig.costField] ?? '',
      margin: row?.[selectedCatalogConfig.marginField] ?? '',
      primaryPrice: row?.[selectedCatalogConfig.primaryPriceField] ?? '',
      secondaryPrice: row?.[selectedCatalogConfig.secondaryPriceField] ?? '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRow?.id || !isPricingUser || !selectedCatalogConfig) return;

    const catalogId = String(editForm.catalogId || '').trim();
    const catalogCost = parseNumber(editForm.cost);
    const catalogMargin = parseNumber(editForm.margin);
    const primaryPrice = parseNumber(editForm.primaryPrice);
    const secondaryPrice = parseNumber(editForm.secondaryPrice);

    if (!catalogId || [catalogCost, catalogMargin, primaryPrice, secondaryPrice].some((value) => value === null)) {
      toast.error(
        `Preencha ID, Custo, Margem, ${selectedCatalogConfig.pricingPrimaryPriceLabel} e ${selectedCatalogConfig.pricingSecondaryPriceLabel} com valores válidos.`
      );
      return;
    }

    try {
      setEditSaving(true);
      const { error } = await supabase
        .from(selectedCatalogConfig.tableName)
        .update({
          [selectedCatalogConfig.idField]: catalogId,
          [selectedCatalogConfig.costField]: catalogCost,
          [selectedCatalogConfig.marginField]: catalogMargin,
          [selectedCatalogConfig.primaryPriceField]: primaryPrice,
          [selectedCatalogConfig.secondaryPriceField]: secondaryPrice,
        })
        .eq('id', editingRow.id);

      if (error) throw error;

      toast.success('Registro atualizado com sucesso!');
      setEditOpen(false);
      setEditingRow(null);
      await loadCatalog(selectedCatalog);
    } catch (error) {
      console.error('Erro ao atualizar catálogo:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode editar itens deste catálogo.')
          : `Erro ao atualizar registro: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow?.id || !isPricingUser || !selectedCatalogConfig) return;

    try {
      setDeleteLoading(true);
      const { data, error } = await supabase
        .from(selectedCatalogConfig.tableName)
        .delete()
        .eq('id', deleteRow.id)
        .select('id');

      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Sem permissão para excluir este registro.');
      }

      toast.success('Registro excluído com sucesso!');
      setDeleteRow(null);
      await loadCatalog(selectedCatalog);
    } catch (error) {
      console.error('Erro ao excluir catálogo:', error);
      toast.error(
        isPermissionError(error)
          ? getPermissionErrorMessage('Sua área não pode excluir itens deste catálogo.')
          : `Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderTable = (rows, emptyMessage) => {
    if (!selectedCatalogConfig) return null;

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-gray-200 dark:border-gray-800">
                {isPricingUser ? (
                  <>
                    <TableHead className="min-w-[120px]">ID</TableHead>
                    <TableHead className="min-w-[260px]">SKU</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Margem</TableHead>
                    <TableHead>{selectedCatalogConfig.pricingPrimaryPriceLabel}</TableHead>
                    <TableHead>{selectedCatalogConfig.pricingSecondaryPriceLabel}</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Categoria</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="min-w-[120px]">ID</TableHead>
                    <TableHead className="min-w-[260px]">SKU</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>{selectedCatalogConfig.userPrimaryPriceLabel}</TableHead>
                    <TableHead>{selectedCatalogConfig.userSecondaryPriceLabel}</TableHead>
                    <TableHead>Categoria</TableHead>
                  </>
                )}
                {isPricingUser && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-gray-200 dark:border-gray-800">
                  <TableCell
                    colSpan={isPricingUser ? 9 : 6}
                    className="h-24 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => (
                  <TableRow
                    key={row?.id || `${row?.sku || 'sku'}-${row?.volume || index}`}
                    className="border-gray-200 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-900/30"
                  >
                    {isPricingUser ? (
                      <>
                        <TableCell>{row?.[selectedCatalogConfig.idField] || '—'}</TableCell>
                        <TableCell>{row?.sku || '—'}</TableCell>
                        <TableCell>{formatCurrency(row?.[selectedCatalogConfig.costField], 'R$')}</TableCell>
                        <TableCell>{formatPercent(row?.[selectedCatalogConfig.marginField])}</TableCell>
                        <TableCell>
                          {formatCurrency(
                            row?.[selectedCatalogConfig.primaryPriceField],
                            selectedCatalogConfig.pricingPrimaryPriceSymbol || 'R$'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            row?.[selectedCatalogConfig.secondaryPriceField],
                            selectedCatalogConfig.pricingSecondaryPriceSymbol || 'R$'
                          )}
                        </TableCell>
                        <TableCell>{formatVolume(row?.volume)}</TableCell>
                        <TableCell>{row?.category || '—'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{row?.[selectedCatalogConfig.idField] || '—'}</TableCell>
                        <TableCell>{row?.sku || '—'}</TableCell>
                        <TableCell>{formatVolume(row?.volume)}</TableCell>
                        <TableCell>
                          {formatCurrency(
                            row?.[selectedCatalogConfig.primaryPriceField],
                            selectedCatalogConfig.userPrimaryPriceSymbol || 'R$'
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            row?.[selectedCatalogConfig.secondaryPriceField],
                            selectedCatalogConfig.userSecondaryPriceSymbol || 'R$'
                          )}
                        </TableCell>
                        <TableCell>{row?.category || '—'}</TableCell>
                      </>
                    )}
                    {isPricingUser && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleOpenEdit(row)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                            onClick={() => setDeleteRow(row)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const renderToolbar = () => {
    if (!selectedCatalogConfig) return null;

    const ModeIcon = selectedCatalogConfig.icon;

    return (
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm px-4 py-4 md:px-5 md:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Button
              variant="outline"
              className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800 h-11 px-5 rounded-xl"
              onClick={handleBackToSelection}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            <div className="flex items-center gap-3 rounded-xl border border-[#845AFA]/20 bg-[#845AFA]/5 px-4 py-3 dark:border-purple-900/30 dark:bg-purple-900/10">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#845AFA]/10 text-[#6b46c1] dark:bg-purple-900/20 dark:text-purple-300">
                <ModeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedCatalogConfig.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCatalogConfig.description}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors h-[38px]">
                  <MapIcon className="w-3.5 h-3.5" />
                  Parâmetros do Catálogo
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0 bg-white dark:bg-[#171717] border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Parâmetros do Catálogo</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Referência utilizada no catálogo</p>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      Parâmetros comerciais
                    </h5>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Frete</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedCatalogConfig?.parameters?.freight || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Prazo</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {selectedCatalogConfig?.parameters?.paymentTerm || '—'}
                        </span>
                      </div>
                      {(selectedCatalogConfig?.parameters?.taxes || []).map((tax) => (
                        <div key={tax.label} className="flex justify-between gap-3">
                          <span className="text-gray-600 dark:text-gray-400">{tax.label}</span>
                          <span className="font-semibold text-right text-gray-900 dark:text-gray-100">{tax.value}</span>
                        </div>
                      ))}
                      {(selectedCatalogConfig?.parameters?.serviceValues || []).map((serviceValue) => (
                        <div key={serviceValue.label} className="flex justify-between gap-3">
                          <span className="text-gray-600 dark:text-gray-400">{serviceValue.label}</span>
                          <span className="font-semibold text-right text-gray-900 dark:text-gray-100">
                            {serviceValue.value}
                          </span>
                        </div>
                      ))}
                      {selectedCatalogConfig?.ptaxLabel && selectedCatalogConfig?.ptaxValue && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">{selectedCatalogConfig.ptaxLabel}</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedCatalogConfig.ptaxValue}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      Validade dos preços
                    </h5>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Válidos até</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{EXPIRY_DATE_TEXT}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              className="bg-white dark:bg-[#0a0a0a] dark:border-gray-800"
              onClick={handleExport}
              disabled={exporting || loading}
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Exportando...' : 'Exportar'}
            </Button>

            {isPricingUser && (
              <Button
                className="bg-[#845AFA] text-white hover:bg-[#7348f5]"
                onClick={handleImportButtonClick}
                disabled={importing || loading}
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importando...' : 'Importar'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header
        user={authUser || user}
        title="Catálogo PRO"
        subtitle="Gestão dos catálogos Brasil e Latam"
        showBack={false}
        logoRedirect="/select"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!selectedCatalog && (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Selecione o catálogo</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Escolha o catálogo que deseja consultar ou manter.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['brazil', 'latam'].map((catalogKey) => {
                const config = CATALOG_CONFIG[catalogKey];
                const Icon = config.icon;

                return (
                  <button
                    key={config.key}
                    type="button"
                    onClick={() => setSelectedCatalog(config.key)}
                    className="w-full p-6 text-left bg-white dark:bg-[#0a0a0a] dark:border-gray-800 border border-transparent shadow-sm rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-blue-600 dark:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                        <Icon size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {config.selectionTitle}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {config.selectionDescription}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {selectedCatalog && renderToolbar()}

        {selectedCatalog && validityAlert && (
          <Card className={validityAlert.className}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 ${validityAlert.iconClassName}`} />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{validityAlert.title}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{validityAlert.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedCatalog && !loading && errorMessage && (
          <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              <Button variant="outline" onClick={() => loadCatalog(selectedCatalog)}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {selectedCatalog && loading && (
          <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
            <CardContent className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              Carregando {selectedCatalogConfig?.title.toLowerCase()}...
            </CardContent>
          </Card>
        )}

        {selectedCatalog && !loading && !errorMessage && (
          <>
            <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 border-t-4 border-t-[#845AFA] shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <CardTitle className="text-gray-900 dark:text-white">Filtros do catálogo</CardTitle>
                  </div>
                  {hasActiveFullFilters && (
                    <button
                      onClick={() => setFullModeFilters({ sku: [], category: '', volume: '' })}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-full transition-colors"
                    >
                      <X size={14} />
                      Limpar Filtros
                    </button>
                  )}
                </div>
                <CardDescription>
                  A tabela abaixo lista todo o catálogo ordenado alfabeticamente por SKU.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Filtrar por SKU</Label>
                  <SearchableSelect
                    options={uniqueSkuOptions}
                    value={fullModeFilters.sku}
                    onChange={(value) => setFullModeFilters((prev) => ({ ...prev, sku: value }))}
                    placeholder="Todos os SKUs"
                    searchPlaceholder="Buscar SKU..."
                    multiSelect
                    multiSelectLabel={(labels) =>
                      labels.length === 1 ? labels[0] : `${labels.length} SKUs selecionados`
                    }
                  />
                  {Array.isArray(fullModeFilters.sku) && fullModeFilters.sku.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {fullModeFilters.sku.map((selectedSku) => (
                        <span
                          key={selectedSku}
                          className="inline-flex items-center gap-1 rounded-full bg-[#845AFA]/10 px-3 py-1 text-xs font-medium text-[#6b46c1] dark:bg-[#845AFA]/20 dark:text-purple-200"
                        >
                          {selectedSku}
                          <button
                            type="button"
                            onClick={() =>
                              setFullModeFilters((prev) => ({
                                ...prev,
                                sku: prev.sku.filter((item) => item !== selectedSku),
                              }))
                            }
                            className="rounded-full text-[#6b46c1] transition-colors hover:text-[#4c1d95] dark:text-purple-200 dark:hover:text-white"
                            aria-label={`Remover ${selectedSku}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={fullModeFilters.category}
                    onChange={(value) => setFullModeFilters((prev) => ({ ...prev, category: value }))}
                    placeholder="Todas as categorias"
                    searchPlaceholder="Buscar categoria..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full-volume">Volume</Label>
                  <select
                    id="full-volume"
                    value={fullModeFilters.volume}
                    onChange={(event) => setFullModeFilters((prev) => ({ ...prev, volume: event.target.value }))}
                    className="flex h-10 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Todos</option>
                    {VOLUMES.map((volume) => (
                      <option key={volume} value={volume}>
                        {formatVolume(volume)}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">
                  {selectedCatalogConfig?.title}
                </CardTitle>
                <CardDescription>
                  {filteredFullRows.length} registro(s) encontrado(s) no catálogo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderTable(filteredFullRows, 'Nenhum registro encontrado para os filtros informados.')}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-3xl bg-white dark:bg-[#171717] dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Importar Excel
            </DialogTitle>
            <DialogDescription>
              Selecione um arquivo `.xlsx` no formato esperado para atualizar o {selectedCatalogConfig?.title.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="catalog-import-file" className="text-base font-medium text-gray-900 dark:text-white">
                Arquivo Excel
              </Label>
              <input
                id="catalog-import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setSelectedImportFile(event.target.files?.[0] || null)}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-900 hover:file:bg-gray-50 dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-gray-100 dark:file:border-gray-700 dark:file:bg-[#0a0a0a] dark:file:text-gray-100"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Formato aceito: `.xlsx`
              </p>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium text-gray-900 dark:text-white">
                A planilha deve conter estas colunas:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>- ID</p>
                <p>- SKU</p>
                <p>- Custo</p>
                <p>- Margem</p>
                <p>- {selectedCatalogConfig?.pricingPrimaryPriceLabel || 'Preço Líquido'}</p>
                <p>- {selectedCatalogConfig?.pricingSecondaryPriceLabel || 'Preço Bruto'}</p>
                <p>- Volume</p>
                <p>- Categoria</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Volumes aceitos: `1000`, `1500`, `3000` e `5000`.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              onClick={() => {
                setShowImportDialog(false);
                setSelectedImportFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#845AFA] text-white hover:bg-[#7348f5]"
              onClick={handleImportSubmit}
              disabled={importing || !selectedImportFile}
            >
              <Upload className="h-4 w-4" />
              {importing ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#171717] dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              {selectedCatalogConfig?.editTitle || 'Editar registro do catálogo'}
            </DialogTitle>
            <DialogDescription>
              Atualize ID, Custo, Margem, {selectedCatalogConfig?.pricingPrimaryPriceLabel || 'Preço Líquido'} e {selectedCatalogConfig?.pricingSecondaryPriceLabel || 'Preço Bruto'} para o registro selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{editingRow?.sku || '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ID: {editingRow?.[selectedCatalogConfig?.idField] || '—'} | Volume: {formatVolume(editingRow?.volume)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-id">ID</Label>
              <Input
                id="edit-id"
                value={editForm.catalogId}
                onChange={(event) => setEditForm((prev) => ({ ...prev, catalogId: event.target.value }))}
                placeholder="Ex.: CAT-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cost">Custo</Label>
              <Input
                id="edit-cost"
                value={editForm.cost}
                onChange={(event) => setEditForm((prev) => ({ ...prev, cost: event.target.value }))}
                placeholder="Ex.: 29,90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-margin">Margem</Label>
              <Input
                id="edit-margin"
                value={editForm.margin}
                onChange={(event) => setEditForm((prev) => ({ ...prev, margin: event.target.value }))}
                placeholder="Ex.: 28,50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-primary-price">{selectedCatalogConfig?.pricingPrimaryPriceLabel || 'Preço Líquido'}</Label>
              <Input
                id="edit-primary-price"
                value={editForm.primaryPrice}
                onChange={(event) => setEditForm((prev) => ({ ...prev, primaryPrice: event.target.value }))}
                placeholder="Ex.: 39,90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-secondary-price">{selectedCatalogConfig?.pricingSecondaryPriceLabel || 'Preço Bruto'}</Label>
              <Input
                id="edit-secondary-price"
                value={editForm.secondaryPrice}
                onChange={(event) => setEditForm((prev) => ({ ...prev, secondaryPrice: event.target.value }))}
                placeholder="Ex.: 44,90"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-[#845AFA] text-white hover:bg-[#7348f5]"
              onClick={handleSaveEdit}
              disabled={editSaving}
            >
              {editSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteRow)} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#171717] dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Excluir registro do catálogo?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Esta ação não pode ser desfeita. O registro do SKU
              <span className="font-semibold text-gray-900 dark:text-white"> {deleteRow?.sku || '—'} </span>
              no volume
              <span className="font-semibold text-gray-900 dark:text-white"> {formatVolume(deleteRow?.volume)} </span>
              será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0 hover:bg-gray-200 dark:hover:bg-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 border-0"
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CatalogoPro;
