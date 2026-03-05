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
import { Lock, Calculator, ArrowRight, RefreshCcw, TrendingUp, DollarSign, Percent, Upload, History, HelpCircle, Info, Map, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// MOCK DATA for Simulation
const MOCK_PRODUCTS = [
  { sku: '100.200.300', name: 'Cimento CP II 50kg', cost: 25.00, margin: 15.0, price_net: 29.41, price_gross: 32.00 },
  { sku: '100.200.301', name: 'Areia Média 20kg', cost: 12.00, margin: 20.0, price_net: 15.00, price_gross: 16.50 },
  { sku: '100.200.302', name: 'Tijolo Baiano 6 furos', cost: 0.80, margin: 30.0, price_net: 1.14, price_gross: 1.25 },
  { sku: '100.200.303', name: 'Tinta Acrílica Branca 18L', cost: 180.00, margin: 25.0, price_net: 240.00, price_gross: 260.00 },
  { sku: '100.200.304', name: 'Piso Cerâmico 60x60 cx', cost: 45.00, margin: 18.0, price_net: 54.88, price_gross: 60.00 },
];

const SimulationPage = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  
  // State from navigation
  const initialState = location.state || {};
  
  const [selectedProductSku, setSelectedProductSku] = useState(initialState.sku || '');
  const [sku, setSku] = useState(initialState.sku || '');
  const [productName, setProductName] = useState(initialState.productName || '');
  const [cost, setCost] = useState(initialState.initialCost || '');
  const [price, setPrice] = useState(initialState.initialPrice || '');
  const [margin, setMargin] = useState(initialState.initialMargin || '');
  const [taxFactor, setTaxFactor] = useState(1);
  const [pis, setPis] = useState(1.65);
  const [cofins, setCofins] = useState(7.60);
  const [icms, setIcms] = useState(18.00);
  const [grossPrice, setGrossPrice] = useState('');
  const [mode, setMode] = useState('simularMargem'); // 'simularMargem', 'simularPreco' or 'simularPrecoBruto'
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const [history, setHistory] = useState([]);
  
  const userArea = user?.area || user?.user_metadata?.area;
  const isPricingUser = userArea === 'Pricing';

  const [availableSimulations, setAvailableSimulations] = useState([]);

  // Fetch simulations/products from DB
  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        const { data, error } = await supabase
          .from('simulations_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (error) throw error;
        if (data) {
          setAvailableSimulations(data);
        }
      } catch (err) {
        console.error('Error fetching simulations:', err);
      }
    };

    fetchSimulations();
  }, [history]); // Reload when history changes (e.g. after import)

  // Generate options for the select
  const productOptions = useMemo(() => {
    return availableSimulations.map(p => {
      // Determine display label based on data quality
      let label = p.product_name;
      if (p.sku === 'Importado' || p.sku === 'N/A') {
        label = p.version || p.product_name || 'Simulação sem nome';
      } else {
        label = p.product_name;
      }

      return {
        value: p.id, // Using ID as unique identifier
        label: label,
        keywords: `${p.product_name} ${p.sku} ${p.version || ''} ${p.id}`
      };
    });
  }, [availableSimulations]);

  // Handle product selection
  const handleProductSelect = (selectedId) => {
    // Check if selectedId matches an ID in availableSimulations
    let simulation = availableSimulations.find(p => p.id === selectedId);
    
    // Fallback: if not found by ID, try finding by SKU (for backward compatibility or external nav)
    if (!simulation) {
      simulation = availableSimulations.find(p => p.sku === selectedId);
    }

    if (simulation) {
      setSelectedProductSku(selectedId);
      setSku(simulation.sku || '');
      setProductName(simulation.product_name || '');
      
      // Ensure numeric values are displayed even if 0
      const formatValue = (val) => {
        if (val === null || val === undefined || val === '') return '0.00';
        const num = Number(val);
        return isNaN(num) ? '0.00' : num.toFixed(2);
      };

      setCost(formatValue(simulation.cost));
      setPrice(formatValue(simulation.price));
      setMargin(formatValue(simulation.margin));
      
      // Set Gross Price
      setGrossPrice(formatValue(simulation.gross_price));
      
      // Set Taxes if available
      setPis(formatValue(simulation.pis ?? 1.65));
      setCofins(formatValue(simulation.cofins ?? 7.60));
      setIcms(formatValue(simulation.icms ?? 18.00));
      
      // Calculate tax factor
      const priceVal = Number(simulation.price) || 0;
      const grossVal = Number(simulation.gross_price) || 0;
      
      if (priceVal > 0 && grossVal > 0) {
        setTaxFactor(grossVal / priceVal);
      } else {
        setTaxFactor(1);
      }
    }
  };

  // Calculate on change
  useEffect(() => {
    const costNum = Number(cost) || 0;
    const priceNum = Number(price) || 0;
    const marginNum = Number(margin) || 0;

    calculate(costNum, priceNum, marginNum);
  }, [price, margin, cost, mode, pis, cofins, icms, grossPrice]);

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
      setHistory(data || []);
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

  const calculate = (costNum, priceNum, marginNum) => {
    if (mode === 'simularMargem') {
      // Logic changed: User inputs Gross Price, system calculates Net Price and Margin
      // Formula: Net Price = Gross Price * ((1 - (PIS+COFINS)) * (1 - ICMS))
      
      const pisCofinsFactor = 1 - ((Number(pis) + Number(cofins)) / 100);
      const icmsFactor = 1 - (Number(icms) / 100);
      const grossNum = Number(grossPrice);
      
      if (grossNum > 0 && pisCofinsFactor > 0 && icmsFactor > 0) {
        const net = grossNum * pisCofinsFactor * icmsFactor;
        
        // Update Net Price if changed
        if (Math.abs(net - priceNum) > 0.01) {
          setPrice(net.toFixed(2));
          // Note: Updating price will trigger useEffect again, which will then calculate margin below
        } else {
          // If Net Price is stable, calculate Margin: (Net Price - Cost) / Net Price
          if (net > 0) {
            const m = ((net - costNum) / net) * 100;
            if (Math.abs(m - marginNum) > 0.01) setMargin(m.toFixed(2));
          }
        }
      }
    } else if (mode === 'simularPreco') {
      // Calculate Price: Cost / (1 - Margin)
      const mDecimal = marginNum / 100;
      if (mDecimal < 1) {
        const p = costNum / (1 - mDecimal);
        if (Math.abs(p - priceNum) > 0.01) setPrice(p.toFixed(2));
      }
    } else if (mode === 'simularPrecoBruto') {
      // Calculate Gross Price: Net Price / ((1 - (PIS+COFINS)) * (1 - ICMS))
      // Formula: Preço Bruto = Preço Líquido / (Fator PIS/COFINS * Fator ICMS)
      
      const pisCofinsFactor = 1 - ((Number(pis) + Number(cofins)) / 100);
      const icmsFactor = 1 - (Number(icms) / 100);
      
      if (pisCofinsFactor > 0 && icmsFactor > 0) {
        const gross = priceNum / (pisCofinsFactor * icmsFactor);
        if (Math.abs(gross - Number(grossPrice)) > 0.01) setGrossPrice(gross.toFixed(2));
      }
    }
  };

  const handleSaveSimulation = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('simulations_history')
        .insert({
          user_id: user.id,
          sku: sku || 'N/A',
          product_name: productName || 'Simulação Avulsa',
          price: Number(price),
          cost: Number(cost),
          margin: Number(margin),
          mode: mode,
          pis: mode === 'simularPrecoBruto' ? Number(pis) : null,
          cofins: mode === 'simularPrecoBruto' ? Number(cofins) : null,
          icms: mode === 'simularPrecoBruto' ? Number(icms) : null,
          gross_price: mode === 'simularPrecoBruto' ? Number(grossPrice) : null,
          user_email: user.email,
          user_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]
        });

      if (error) throw error;
      
      toast.success('Simulação salva com sucesso!');
      if (isPricingUser) loadHistory();
      
    } catch (error) {
      console.error('Error saving simulation:', error);
      toast.error(`Erro ao salvar simulação: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
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
              sku: 'Importado',
              product_name: `Importação ${version || ''}`.trim(),
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <Header 
        user={user} 
        title="Simulador de Preço e Margem" 
        subtitle="Ferramenta de cálculo e análise de rentabilidade" 
        showBack={true} 
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

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Produto Selecionado</Label>
                    <div className="font-medium truncate" title={productName}>{productName || '-'}</div>
                 </div>
                 {/* SKU code hidden as per request */}
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
                    <Label htmlFor="grossPrice">Preço Bruto de Venda (Novo)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                      <Input 
                        id="grossPrice" 
                        type="number" 
                        value={grossPrice} 
                        onChange={(e) => setGrossPrice(e.target.value)}
                        onBlur={(e) => handleBlur(setGrossPrice, e.target.value)}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : mode === 'simularPreco' ? (
                  <div className="space-y-2">
                    <Label htmlFor="margin">Margem Alvo (%)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                      <Input 
                        id="margin" 
                        type="number" 
                        value={margin} 
                        onChange={(e) => setMargin(e.target.value)}
                        onBlur={(e) => handleBlur(setMargin, e.target.value)}
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
                              <Map className="w-3.5 h-3.5" />
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
              <Button onClick={handleSaveSimulation} className="w-full bg-[#845AFA] hover:bg-[#6b46c1] text-white" disabled={loading}>
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
                  {mode === 'simularMargem' ? 'Margem Líquida Resultante' : 
                   mode === 'simularPreco' ? 'Preço Líquido Sugerido' : 
                   'Preço Bruto Calculado'}
                </span>
                <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {mode === 'simularMargem' ? (
                    isPricingUser ? (
                      <span className={Number(margin) < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}>
                        {formatPercent(Number(margin))}
                      </span>
                    ) : '***'
                  ) : mode === 'simularPreco' ? (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(price))}
                    </span>
                  ) : (
                    // simularPrecoBruto Result
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(grossPrice))}
                    </span>
                  )}
                </div>
                
                {/* Gross Price Estimate (only for simularPreco mode) */}
                {mode === 'simularPreco' && Number(price) > 0 && (
                   <div className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                      Preço Bruto Est.: <span className="font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(Number(price) * taxFactor)}</span>
                   </div>
                )}
                
                {/* Tax Breakdown (only for simularPrecoBruto mode) */}
                {mode === 'simularPrecoBruto' && Number(grossPrice) > 0 && (
                   <div className="mt-4 flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">PIS: {pis}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">COFINS: {cofins}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">ICMS: {icms}%</span>
                   </div>
                )}
                
                {!isPricingUser && mode === 'simularMargem' && (
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
                  Histórico de Simulações
                </CardTitle>
                <CardDescription>
                  Últimas 50 simulações realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[600px] -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Produto/Versão</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Preço Liq.</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhuma simulação registrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        history.map((item) => (
                          <TableRow key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <TableCell className="whitespace-nowrap text-xs">
                              {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-xs">
                             <div className="flex flex-col">
                                <span className="font-medium">{item.user_name || item.user_email?.split('@')[0] || 'Usuário'}</span>
                                <span className="text-[10px] text-muted-foreground">{item.user_email || 'N/A'}</span>
                             </div>
                          </TableCell>
                            <TableCell className="font-medium text-xs max-w-[150px] truncate" title={item.product_name}>
                              {item.version ? `Versão: ${item.version}` : item.product_name}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-xs">
                              {formatCurrency(item.cost)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-xs">
                              {formatCurrency(item.price)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap text-xs">
                              <Badge variant={item.margin < 10 ? "destructive" : "secondary"} className="text-[10px]">
                                {formatPercent(item.margin)}
                              </Badge>
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

      </div>
    </div>
  );
};

export default SimulationPage;
