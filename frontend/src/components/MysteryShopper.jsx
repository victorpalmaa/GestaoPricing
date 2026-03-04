import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, Minus, Search, ShoppingCart, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const MysteryShopper = ({ user, selectedCategory, selectedSubcategory, pricingData }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [competitors, setCompetitors] = useState([]);
  const [products, setProducts] = useState([]);
  const [quotes, setQuotes] = useState([]);


  // KPIs
  const kpis = useMemo(() => {
    if (!pricingData || pricingData.length === 0) return null;

    let filtered = pricingData;
    if (selectedCategory) filtered = filtered.filter(p => p.category === selectedCategory);
    if (selectedSubcategory) filtered = filtered.filter(p => p.subcategory === selectedSubcategory);

    if (filtered.length === 0) return null;

    const avgPrice = filtered.reduce((acc, curr) => acc + (Number(curr.net_price) || 0), 0) / filtered.length;
    const avgMargin = filtered.reduce((acc, curr) => acc + (Number(curr.margin_budget) || 0), 0) / filtered.length;
    
    // "Nosso Preço Ponta" - Assuming max price or most recent? Let's use Max for "Ponta" (High End)
    const maxPrice = Math.max(...filtered.map(p => Number(p.net_price) || 0));

    return {
      avgPrice,
      avgMargin,
      maxPrice,
      count: filtered.length
    };
  }, [pricingData, selectedCategory, selectedSubcategory]);

  const marketAvg = useMemo(() => {
    if (quotes.length === 0) return 0;
    return quotes.reduce((acc, q) => acc + Number(q.price), 0) / quotes.length;
  }, [quotes]);

  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch Competitors
      const { data: compData } = await supabase.from('competitors').select('*');
      setCompetitors(compData || []);

      // Fetch Products (linked to our SKUs)
      let prodQuery = supabase.from('competitor_products').select('*');
      // If we could filter by category here it would be better, but category is in our pricing_history/products, not directly in competitor_products mapping without join.
      // For now fetch all and filter in memory if needed, or if the list is small.
      const { data: prodData } = await supabase.from('competitor_products').select('*');
      setProducts(prodData || []);

      // Fetch Quotes
      const { data: quoteData } = await supabase
        .from('mystery_shopper_quotes')
        .select(`
          *,
          competitor_product:competitor_products (
            *,
            competitor:competitors (fantasy_name)
          )
        `)
        .order('quote_date', { ascending: false });
        
      setQuotes(quoteData || []);

    } catch (error) {
      console.error('Error loading mystery shopper data:', error);
      toast.error('Erro ao carregar dados de mercado');
    } finally {
      setLoading(false);
    }
  };

  // Filter quotes based on selection
  const filteredQuotes = useMemo(() => {
    let data = quotes;
    
    // Filter by category if possible (needs join with our products or inferred from SKU)
    // Here we rely on the fact that we might filter by SKU match in the future.
    // For now, if selectedCategory is set, we try to match our SKUs in pricingData that match that category
    if (selectedCategory && pricingData) {
      const categorySkus = new Set(
        pricingData
          .filter(p => p.category === selectedCategory)
          .map(p => p.sku)
      );
      
      data = data.filter(q => categorySkus.has(q.competitor_product?.our_sku));
    }

    return data;
  }, [quotes, selectedCategory, pricingData]);

  const handleSimulate = (quote) => {
    // Find our matching product to get cost
    const ourProduct = pricingData.find(p => p.sku === quote.competitor_product?.our_sku);
    
    // Sort pricingData by date desc to get latest
    const ourLatest = pricingData
      .filter(p => p.sku === quote.competitor_product?.our_sku)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const estimatedCost = ourLatest ? (Number(ourLatest.net_price) * (1 - (Number(ourLatest.margin_budget)/100))) : 0;

    navigate('/simulacao', {
      state: {
        sku: quote.competitor_product?.our_sku,
        productName: quote.competitor_product?.competitor_product_name,
        initialPrice: Number(quote.price),
        initialCost: estimatedCost,
        initialMargin: 0
      }
    });
  };

  const isPricingUser = user?.area === 'Pricing' || user?.user_metadata?.area === 'Pricing';

  return (
    <div className="space-y-6">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nosso Preço Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis ? `R$ ${kpis.avgPrice.toFixed(2)}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Baseado em {kpis?.count || 0} registros</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Preço Médio Mercado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketAvg ? `R$ ${marketAvg.toFixed(2)}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredQuotes.length} cotações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nosso Preço Ponta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis ? `R$ ${kpis.maxPrice.toFixed(2)}` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Maior preço praticado</p>
          </CardContent>
        </Card>

        <Card className={!isPricingUser ? "opacity-50 blur-[2px] select-none" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Margem Média CIA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isPricingUser && kpis ? `${kpis.avgMargin.toFixed(2)}%` : '***'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isPricingUser ? 'Ponderada por volume' : 'Restrito'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Competitividade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Grid de Competitividade
          </CardTitle>
          <CardDescription>
            Comparativo de preços com concorrentes monitorados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Cotação</TableHead>
                <TableHead>Concorrente</TableHead>
                <TableHead>Produto Concorrente</TableHead>
                <TableHead>Nosso SKU</TableHead>
                <TableHead>Preço Concorrente</TableHead>
                <TableHead>Nosso Preço (Ref)</TableHead>
                <TableHead>Delta %</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cotação encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((quote) => {
                  // Find matching SKU data
                  const ourData = pricingData?.find(p => p.sku === quote.competitor_product?.our_sku);
                  const ourPrice = ourData ? Number(ourData.net_price) : 0;
                  const compPrice = Number(quote.price);
                  const delta = ourPrice > 0 ? ((compPrice - ourPrice) / ourPrice) * 100 : 0;
                  
                  return (
                    <TableRow key={quote.id}>
                      <TableCell>{format(new Date(quote.quote_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">
                        {quote.competitor_product?.competitor?.fantasy_name}
                      </TableCell>
                      <TableCell>{quote.competitor_product?.competitor_product_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{quote.competitor_product?.our_sku}</Badge>
                      </TableCell>
                      <TableCell>R$ {compPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        {ourPrice > 0 ? `R$ ${ourPrice.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 font-bold ${
                          delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {delta > 0 ? <ArrowUpRight className="w-4 h-4" /> : delta < 0 ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          {Math.abs(delta).toFixed(1)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSimulate(quote)}
                        >
                          Simular Cenário
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MysteryShopper;
