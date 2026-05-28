import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Download,
  Info,
  Map as MapIcon,
  Package,
  Pencil,
  Search,
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

const VOLUMES = [1000, 1500, 3000, 5000];
const CATEGORY_OPTIONS = ['Pó', 'Gel', 'Goma', 'Softgel'];

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

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number);
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

const CatalogoPro = ({ user }) => {
  const [authUser, setAuthUser] = useState(user || null);
  const [catalogRows, setCatalogRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState('');
  const [skuModeFilters, setSkuModeFilters] = useState({
    sku: '',
    category: '',
    volume: '',
  });
  const [fullModeFilters, setFullModeFilters] = useState({
    sku: '',
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
    catalog_margin: '',
    catalog_price: '',
    catalog_gross_price: '',
  });
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const userArea = authUser?.area || authUser?.user_metadata?.area || user?.area || user?.user_metadata?.area;
  const isPricingUser = userArea === 'Pricing';

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('simulation_catalog_prices')
        .select('*')
        .order('sku', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;
      setCatalogRows(sortCatalogRows(data || []));
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error);
      setCatalogRows([]);
      setErrorMessage('Não foi possível carregar o catálogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (data?.user) {
          setAuthUser(data.user);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário autenticado:', error);
      }
    };

    loadUser();
    loadCatalog();
  }, []);

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

  const categoryOptions = useMemo(
    () => CATEGORY_OPTIONS.map((category) => ({ value: category, label: category })),
    []
  );

  const selectedSkuRows = useMemo(() => {
    if (!skuModeFilters.sku) return [];
    return sortedCatalogRows.filter((row) => row.sku === skuModeFilters.sku);
  }, [sortedCatalogRows, skuModeFilters.sku]);

  const skuRowsByVolume = useMemo(() => {
    const map = new Map();
    selectedSkuRows.forEach((row) => {
      const volume = Number(row?.volume);
      if (!map.has(volume)) {
        map.set(volume, row);
      }
    });

    return VOLUMES.map((volume) => map.get(volume) || {
      id: null,
      simulation_id: null,
      sku: skuModeFilters.sku,
      volume,
      category: null,
      catalog_margin: null,
      catalog_price: null,
      catalog_gross_price: null,
      isMissing: true,
    });
  }, [selectedSkuRows, skuModeFilters.sku]);

  const filteredSkuRows = useMemo(() => {
    return skuRowsByVolume.filter((row) => {
      const matchesVolume = !skuModeFilters.volume || Number(row?.volume) === Number(skuModeFilters.volume);
      const matchesCategory = !skuModeFilters.category || row?.category === skuModeFilters.category;
      return matchesVolume && matchesCategory;
    });
  }, [skuRowsByVolume, skuModeFilters]);

  const filteredFullRows = useMemo(() => {
    return sortedCatalogRows.filter((row) => {
      const matchesSku = !fullModeFilters.sku || row.sku === fullModeFilters.sku;
      const matchesVolume = !fullModeFilters.volume || Number(row?.volume) === Number(fullModeFilters.volume);
      const matchesCategory = !fullModeFilters.category || row?.category === fullModeFilters.category;
      return matchesSku && matchesVolume && matchesCategory;
    });
  }, [sortedCatalogRows, fullModeFilters]);

  const hasActiveSkuFilters = Boolean(
    skuModeFilters.sku || skuModeFilters.category || skuModeFilters.volume
  );

  const hasActiveFullFilters = Boolean(
    fullModeFilters.sku || fullModeFilters.category || fullModeFilters.volume
  );

  const handleBackToSelection = () => {
    setMode('');
    setSkuModeFilters({ sku: '', category: '', volume: '' });
    setFullModeFilters({ sku: '', category: '', volume: '' });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const { data, error } = await supabase
        .from('simulation_catalog_prices')
        .select('*')
        .order('sku', { ascending: true })
        .order('volume', { ascending: true });

      if (error) throw error;

      const exportRows = (data || []).map((row) => ({
        ID: row.simulation_id || '',
        SKU: row.sku || '',
        Categoria: row.category || '',
        Custo: row.catalog_cost ?? '',
        Margem: row.catalog_margin ?? '',
        'Preço Líquido': row.catalog_price ?? '',
        'Preço Bruto': row.catalog_gross_price ?? '',
        Volume: row.volume ?? '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalogo PRO');
      XLSX.writeFile(workbook, 'catalogo-pro.xlsx');
      toast.success('Exportação concluída com sucesso!');
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
    if (!file || !isPricingUser) return;

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
        ['ID', 'id'],
        ['SKU', 'sku'],
        ['Custo', 'custo'],
        ['Margem', 'margem'],
        ['Preço Líquido', 'Preco Liquido', 'Preco Líquido', 'preco liquido'],
        ['Preço Bruto', 'Preco Bruto', 'Preco bruto', 'preco bruto'],
        ['Volume', 'volume'],
        ['Categoria', 'categoria', 'category'],
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

      sortedCatalogRows.forEach((row) => {
        const skuKey = `${normalizeText(row?.sku)}::${Number(row?.volume || 0)}`;
        if (!existingBySkuVolume.has(skuKey)) existingBySkuVolume.set(skuKey, row);
      });

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonRows) {
        const simulationIdRaw = getValueByHeader(row, ['ID', 'id']);
        const skuRaw = getValueByHeader(row, ['SKU', 'sku']);
        const categoryRaw = getValueByHeader(row, ['Categoria', 'categoria', 'category']);
        const volumeRaw = getValueByHeader(row, ['Volume', 'volume']);
        const costRaw = getValueByHeader(row, ['Custo', 'custo']);
        const marginRaw = getValueByHeader(row, ['Margem', 'margem']);
        const priceRaw = getValueByHeader(row, ['Preço Líquido', 'Preco Liquido', 'Preco Líquido', 'preco liquido']);
        const grossPriceRaw = getValueByHeader(row, ['Preço Bruto', 'Preco Bruto', 'Preco bruto', 'preco bruto']);
        const sku = String(skuRaw || '').trim();
        const category = CATEGORY_OPTIONS.find((item) => normalizeText(item) === normalizeText(categoryRaw)) || '';
        const simulationId = String(simulationIdRaw || '').trim();
        const volume = Number(parseNumber(volumeRaw));
        const catalogCost = parseNumber(costRaw);
        const catalogMargin = parseNumber(marginRaw);
        const catalogPrice = parseNumber(priceRaw);
        const catalogGrossPrice = parseNumber(grossPriceRaw);

        if (!simulationId || !sku || !category || !VOLUMES.includes(volume)) {
          errorCount += 1;
          continue;
        }

        if ([catalogCost, catalogMargin, catalogPrice, catalogGrossPrice].some((item) => item === null)) {
          errorCount += 1;
          continue;
        }

        const existingRow = existingBySkuVolume.get(`${normalizeText(sku)}::${volume}`);

        const payload = {
          sku,
          volume,
          category,
          simulation_id: simulationId || null,
          catalog_cost: catalogCost,
          catalog_margin: catalogMargin,
          catalog_price: catalogPrice,
          catalog_gross_price: catalogGrossPrice,
        };

        if (existingRow?.datasul_code) {
          payload.datasul_code = existingRow.datasul_code;
        }

        const { error } = await supabase
          .from('simulation_catalog_prices')
          .upsert(payload, { onConflict: 'sku,volume' });

        if (error) {
          console.error('Erro no upsert do catálogo:', error, payload);
          errorCount += 1;
          continue;
        }

        successCount += 1;
      }

      await loadCatalog();
      setShowImportDialog(false);
      setSelectedImportFile(null);

      if (successCount > 0) {
        toast.success(`${successCount} linhas inseridas/atualizadas com sucesso. ${errorCount} erro(s).`);
      } else {
        toast.error(`Nenhuma linha importada. ${errorCount} erro(s) encontrados.`);
      }
    } catch (error) {
      console.error('Erro ao importar catálogo:', error);
      toast.error(`Erro ao importar catálogo: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEdit = (row) => {
    if (!row?.id || !isPricingUser) return;
    setEditingRow(row);
    setEditForm({
      catalog_margin: row?.catalog_margin ?? '',
      catalog_price: row?.catalog_price ?? '',
      catalog_gross_price: row?.catalog_gross_price ?? '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRow?.id || !isPricingUser) return;

    const catalogMargin = parseNumber(editForm.catalog_margin);
    const catalogPrice = parseNumber(editForm.catalog_price);
    const catalogGrossPrice = parseNumber(editForm.catalog_gross_price);

    if ([catalogMargin, catalogPrice, catalogGrossPrice].some((value) => value === null)) {
      toast.error('Preencha Margem, Preço Líquido e Preço Bruto com valores válidos.');
      return;
    }

    try {
      setEditSaving(true);
      const { error } = await supabase
        .from('simulation_catalog_prices')
        .update({
          catalog_margin: catalogMargin,
          catalog_price: catalogPrice,
          catalog_gross_price: catalogGrossPrice,
        })
        .eq('id', editingRow.id);

      if (error) throw error;

      toast.success('Registro atualizado com sucesso!');
      setEditOpen(false);
      setEditingRow(null);
      await loadCatalog();
    } catch (error) {
      console.error('Erro ao atualizar catálogo:', error);
      toast.error(`Erro ao atualizar registro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow?.id || !isPricingUser) return;

    try {
      setDeleteLoading(true);
      const { data, error } = await supabase
        .from('simulation_catalog_prices')
        .delete()
        .eq('id', deleteRow.id)
        .select('id');

      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Sem permissão para excluir este registro.');
      }

      toast.success('Registro excluído com sucesso!');
      setDeleteRow(null);
      await loadCatalog();
    } catch (error) {
      console.error('Erro ao excluir catálogo:', error);
      toast.error(`Erro ao excluir registro: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderTable = (rows, emptyMessage) => (
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
                  <TableHead>Preço Líquido</TableHead>
                  <TableHead>Preço Bruto</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Categoria</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="min-w-[260px]">SKU</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Preço Líquido</TableHead>
                  <TableHead>Preço Bruto</TableHead>
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
                  colSpan={isPricingUser ? 9 : 5}
                  className="h-24 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => {
                const isMissing = Boolean(row?.isMissing);

                return (
                  <TableRow
                    key={row?.id || `${row?.sku || 'sku'}-${row?.volume || index}`}
                    className="border-gray-200 dark:border-gray-800 hover:bg-gray-50/70 dark:hover:bg-gray-900/30"
                  >
                    {isPricingUser ? (
                      <>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {row?.simulation_id || '—'}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {row?.sku || '—'}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatCurrency(row?.catalog_cost)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatPercent(row?.catalog_margin)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatCurrency(row?.catalog_price)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatCurrency(row?.catalog_gross_price)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {formatVolume(row?.volume)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {row?.category || '—'}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {row?.sku || '—'}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {formatVolume(row?.volume)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatCurrency(row?.catalog_price)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {isMissing ? '—' : formatCurrency(row?.catalog_gross_price)}
                        </TableCell>
                        <TableCell className={isMissing ? 'text-gray-400 dark:text-gray-500' : ''}>
                          {row?.category || '—'}
                        </TableCell>
                      </>
                    )}
                    {isPricingUser && (
                      <TableCell className="text-right">
                        {!isMissing && row?.id ? (
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
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderToolbar = () => {
    const isSkuMode = mode === 'sku';
    const ModeIcon = isSkuMode ? Search : Package;
    const modeTitle = isSkuMode ? 'Consultar SKU' : 'Catálogo completo';
    const modeDescription = isSkuMode
      ? 'Consulte um SKU específico e refine o resultado por parâmetros.'
      : 'Visualize todo o catálogo com filtros e ações de manutenção.';

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
                  {modeTitle}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {modeDescription}
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
                      Parâmetros fiscais e logísticos
                    </h5>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Frete</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">FOB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">PIS e COFINS</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">9,25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">ICMS</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">12%</span>
                      </div>
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
                        <span className="font-semibold text-gray-900 dark:text-gray-100">31/08/2026</span>
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
              <>
                <Button
                  className="bg-[#845AFA] text-white hover:bg-[#7348f5]"
                  onClick={handleImportButtonClick}
                  disabled={importing || loading}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importando...' : 'Importar'}
                </Button>
              </>
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
        subtitle="Gestão do catálogo"
        showBack={false}
        logoRedirect="/select"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {!mode && (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Selecione o modo de consulta</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Escolha entre consultar um SKU específico ou visualizar o catálogo completo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                type="button"
                onClick={() => setMode('sku')}
                className="w-full p-6 text-left bg-white dark:bg-[#0a0a0a] dark:border-gray-800 border border-transparent shadow-sm rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-blue-600 dark:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                    <Search size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Consultar SKU</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Pesquise um SKU e visualize os volumes 1.000, 3.000 e 5.000.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('full')}
                className="w-full p-6 text-left bg-white dark:bg-[#0a0a0a] dark:border-gray-800 border border-transparent shadow-sm rounded-xl hover:shadow-md transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900 text-blue-600 dark:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Catálogo completo</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Veja toda a tabela, filtre por SKU e exporte os dados do catálogo.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {mode && renderToolbar()}

        {!loading && errorMessage && (
          <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              <Button variant="outline" onClick={loadCatalog}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !errorMessage && mode === 'sku' && (
          <>
            <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800 border-t-4 border-t-[#845AFA] shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4 mb-1">
                  <div className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <CardTitle className="text-gray-900 dark:text-white">Buscar SKU</CardTitle>
                  </div>
                  {hasActiveSkuFilters && (
                    <button
                      onClick={() => setSkuModeFilters({ sku: '', category: '', volume: '' })}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-full transition-colors"
                    >
                      <X size={14} />
                      Limpar Filtros
                    </button>
                  )}
                </div>
                <CardDescription>
                  Selecione o SKU e refine a consulta por categoria e volume.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Selecionar SKU</Label>
                  <SearchableSelect
                    options={uniqueSkuOptions}
                    value={skuModeFilters.sku}
                    onChange={(value) => setSkuModeFilters((prev) => ({ ...prev, sku: value }))}
                    placeholder="Selecione um SKU"
                    searchPlaceholder="Buscar SKU..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <SearchableSelect
                    options={categoryOptions}
                    value={skuModeFilters.category}
                    onChange={(value) => setSkuModeFilters((prev) => ({ ...prev, category: value }))}
                    placeholder="Todas as categorias"
                    searchPlaceholder="Buscar categoria..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku-volume">Volume</Label>
                  <select
                    id="sku-volume"
                    value={skuModeFilters.volume}
                    onChange={(event) => setSkuModeFilters((prev) => ({ ...prev, volume: event.target.value }))}
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

            {skuModeFilters.sku ? (
              <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">{skuModeFilters.sku}</CardTitle>
                  <CardDescription>Visualização fixa dos volumes 1.000, 3.000 e 5.000.</CardDescription>
                </CardHeader>
                <CardContent>
                  {renderTable(filteredSkuRows, 'Nenhuma linha encontrada para os filtros informados.')}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-800">
                <CardContent className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Selecione um SKU para visualizar os três volumes do catálogo.
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!loading && !errorMessage && mode === 'full' && (
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
                      onClick={() => setFullModeFilters({ sku: '', category: '', volume: '' })}
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
                  />
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
                <CardTitle className="text-gray-900 dark:text-white">Tabela completa</CardTitle>
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
            <DialogTitle className="text-gray-900 dark:text-white">Importar Excel</DialogTitle>
            <DialogDescription>
              Selecione um arquivo `.xlsx` no formato esperado para atualizar o catálogo.
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
                A ordem das colunas deve ser exatamente esta:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>- ID</p>
                <p>- SKU</p>
                <p>- Custo</p>
                <p>- Margem</p>
                <p>- Preço Líquido</p>
                <p>- Preço Bruto</p>
                <p>- Volume</p>
                <p>- Categoria</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Se a ordem estiver diferente, a importação pode falhar ou ignorar linhas. Volumes aceitos:
                `1000`, `1500`, `3000` e `5000`.
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
            <DialogTitle className="text-gray-900 dark:text-white">Editar registro do catálogo</DialogTitle>
            <DialogDescription>
              Atualize Margem, Preço Líquido e Preço Bruto para o registro selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{editingRow?.sku || '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ID: {editingRow?.simulation_id || '—'} | Volume: {formatVolume(editingRow?.volume)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-margin">Margem</Label>
              <Input
                id="edit-margin"
                value={editForm.catalog_margin}
                onChange={(event) => setEditForm((prev) => ({ ...prev, catalog_margin: event.target.value }))}
                placeholder="Ex.: 28,50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-net-price">Preço Líquido</Label>
              <Input
                id="edit-net-price"
                value={editForm.catalog_price}
                onChange={(event) => setEditForm((prev) => ({ ...prev, catalog_price: event.target.value }))}
                placeholder="Ex.: 39,90"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-gross-price">Preço Bruto</Label>
              <Input
                id="edit-gross-price"
                value={editForm.catalog_gross_price}
                onChange={(event) => setEditForm((prev) => ({ ...prev, catalog_gross_price: event.target.value }))}
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
