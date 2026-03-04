import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase, cn } from '@/lib/utils';
import Header from './Header';
import SearchableSelect from './SearchableSelect';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Calculator, ArrowRight, RefreshCcw, TrendingUp, DollarSign, Percent, Upload, History, HelpCircle, Info, Map } from 'lucide-react';
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
  
  // State from navigation (Mystery Shopper integration)
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
  const [mode, setMode] = useState('findMargin'); // 'findMargin', 'findPrice' or 'findGrossPrice'
  
  const [history, setHistory] = useState([]);
  
  const userArea = user?.area || user?.user_metadata?.area;
  const isPricingUser = userArea === 'Pricing';

  // Generate options for the select
  const productOptions = useMemo(() => {
    return MOCK_PRODUCTS.map(p => ({
      value: p.sku,
      label: p.name,
      keywords: p.name
    }));
  }, []);

  // Handle product selection
  const handleProductSelect = (selectedSku) => {
    setSelectedProductSku(selectedSku);
    const product = MOCK_PRODUCTS.find(p => p.sku === selectedSku);
    
    if (product) {
      setSku(product.sku);
      setProductName(product.name);
      setCost(product.cost);
      setPrice(product.price_net);
      setMargin(product.margin);
      
      // Calculate tax factor based on mock data
      if (product.price_net > 0 && product.price_gross > 0) {
        setTaxFactor(product.price_gross / product.price_net);
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
  }, [price, margin, cost, mode, pis, cofins, icms]);

  // Load history on mount (only for Pricing users)
  useEffect(() => {
    if (isPricingUser) {
      loadHistory();
    }
  }, [isPricingUser]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('simulations_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Erro ao carregar histórico de simulações');
    }
  };

  const calculate = (costNum, priceNum, marginNum) => {
    if (mode === 'findMargin') {
      // Calculate Margin: (Price - Cost) / Price
      if (priceNum > 0) {
        const m = ((priceNum - costNum) / priceNum) * 100;
        // Avoid infinite loop by checking difference
        if (Math.abs(m - marginNum) > 0.01) setMargin(m.toFixed(2));
      }
    } else if (mode === 'findPrice') {
      // Calculate Price: Cost / (1 - Margin)
      const mDecimal = marginNum / 100;
      if (mDecimal < 1) {
        const p = costNum / (1 - mDecimal);
        if (Math.abs(p - priceNum) > 0.01) setPrice(p.toFixed(2));
      }
    } else if (mode === 'findGrossPrice') {
      // Calculate Gross Price: Net Price / (1 - (Taxes/100))
      // Assuming 'price' (Net Price) is the input base.
      // But in this mode, user enters Net Price (or uses SKU's) and Taxes.
      // We update grossPrice state.
      
      const totalTax = (Number(pis) + Number(cofins) + Number(icms)) / 100;
      if (totalTax < 1) {
        const gross = priceNum / (1 - totalTax);
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
          pis: mode === 'findGrossPrice' ? Number(pis) : null,
          cofins: mode === 'findGrossPrice' ? Number(cofins) : null,
          icms: mode === 'findGrossPrice' ? Number(icms) : null,
          gross_price: mode === 'findGrossPrice' ? Number(grossPrice) : null
        });

      if (error) throw error;
      
      toast.success('Simulação salva com sucesso!');
      if (isPricingUser) loadHistory();
      
    } catch (error) {
      console.error('Error saving simulation:', error);
      toast.error('Erro ao salvar simulação');
    } finally {
      setLoading(false);
    }
  };

  const handleImportTable = () => {
    // Stub for future implementation
    toast.info('Funcionalidade de importação em desenvolvimento.');
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);
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
                  <TabsTrigger value="findMargin">Encontrar Margem</TabsTrigger>
                  <TabsTrigger value="findPrice">Encontrar Preço</TabsTrigger>
                  <TabsTrigger value="findGrossPrice">Simular Preço Bruto</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                {/* Cost Input - Restricted View (Hidden in findGrossPrice mode) */}
                {mode !== 'findGrossPrice' && (
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
                        disabled={!isPricingUser}
                        className={cn(
                          "pl-8",
                          !isPricingUser && "bg-muted text-transparent select-none"
                        )}
                      />
                      {!isPricingUser && (
                        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground font-medium bg-muted/50 rounded-md backdrop-blur-[2px]">
                          Confidencial
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dynamic Inputs based on Mode */}
                {mode === 'findMargin' ? (
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço Líquido de Venda (Novo)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                      <Input 
                        id="price" 
                        type="number" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : mode === 'findPrice' ? (
                  <div className="space-y-2">
                    <Label htmlFor="margin">Margem Alvo (%)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                      <Input 
                        id="margin" 
                        type="number" 
                        value={margin} 
                        onChange={(e) => setMargin(e.target.value)}
                        className="pl-8 font-semibold text-lg"
                      />
                    </div>
                  </div>
                ) : (
                  // Mode: findGrossPrice
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
                                  Interestadual (Origem Sul/Sudeste)
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Destino N/NE/CO/ES</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">7%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Destino S/SE (exceto ES)</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">12%</span>
                                  </div>
                                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                    <span className="text-gray-600 dark:text-gray-400">Importados (4%)</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">4%</span>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                  Interna (Exemplos)
                                </h5>
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 text-xs space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">SP, MG, PR, RS, SC</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">18%*</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">RJ (com FECP)</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">20%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">Maioria N/NE</span>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">18% - 20%</span>
                                  </div>
                                </div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-1">
                                  *Alíquotas podem variar (17% a 19%) conforme legislação estadual vigente.
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
                          className="pl-8 font-semibold"
                        />
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
                  {mode === 'findMargin' ? 'Margem Líquida Resultante' : 
                   mode === 'findPrice' ? 'Preço Líquido Sugerido' : 
                   'Preço Bruto Calculado'}
                </span>
                <div className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {mode === 'findMargin' ? (
                    isPricingUser ? (
                      <span className={Number(margin) < 0 ? "text-red-500" : "text-gray-900 dark:text-white"}>
                        {formatPercent(Number(margin))}
                      </span>
                    ) : '***'
                  ) : mode === 'findPrice' ? (
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(price))}
                    </span>
                  ) : (
                    // findGrossPrice Result
                    <span className="text-[#845AFA]">
                      {formatCurrency(Number(grossPrice))}
                    </span>
                  )}
                </div>
                
                {/* Gross Price Estimate (only for findPrice mode) */}
                {mode === 'findPrice' && Number(price) > 0 && (
                   <div className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                      Preço Bruto Est.: <span className="font-semibold text-gray-700 dark:text-slate-300">{formatCurrency(Number(price) * taxFactor)}</span>
                   </div>
                )}
                
                {/* Tax Breakdown (only for findGrossPrice mode) */}
                {mode === 'findGrossPrice' && Number(grossPrice) > 0 && (
                   <div className="mt-4 flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">PIS: {pis}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">COFINS: {cofins}%</span>
                      <span className="px-2 py-1 bg-gray-200 dark:bg-slate-700 rounded">ICMS: {icms}%</span>
                   </div>
                )}
                
                {!isPricingUser && mode === 'findMargin' && (
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
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <History className="w-5 h-5 text-gray-500" />
              Histórico de Simulações
            </h3>
            <Card>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto/SKU</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preço Simulado</TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>Modo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhuma simulação registrada recentemente.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((sim) => (
                        <TableRow key={sim.id}>
                          <TableCell>{format(new Date(sim.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{sim.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(sim.cost)}</TableCell>
                          <TableCell>{formatCurrency(sim.price)}</TableCell>
                          <TableCell>
                            <Badge variant={sim.margin < 0 ? "destructive" : "secondary"}>
                              {formatPercent(sim.margin)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {sim.mode === 'findMargin' ? 'Margem' : 'Preço'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
};

export default SimulationPage;
