import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Lock, Calculator, ArrowRight, RefreshCcw, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';

const PriceSimulator = ({ 
  user, 
  initialSku = '', 
  initialCost = 0, 
  initialPrice = 0,
  initialMargin = 0,
  productName = '',
  isOpen = false,
  onClose
}) => {
  const { isPricing: isPricingUser } = useAuth();

  const [cost, setCost] = useState(initialCost || 0);
  const [price, setPrice] = useState(initialPrice || 0);
  const [margin, setMargin] = useState(initialMargin || 0);
  const [mode, setMode] = useState('findMargin'); // 'findMargin' (Given Price -> Calc Margin) or 'findPrice' (Given Margin -> Calc Price)

  // Update internal state when props change
  useEffect(() => {
    if (initialCost) setCost(initialCost);
    if (initialPrice) setPrice(initialPrice);
    if (initialMargin) setMargin(initialMargin);
    
    // Auto-calculate margin if we have price and cost
    if (initialPrice && initialCost && !initialMargin) {
      const m = ((initialPrice - initialCost) / initialPrice) * 100;
      setMargin(m);
    }
  }, [initialCost, initialPrice, initialMargin]);

  const calculate = () => {
    if (mode === 'findMargin') {
      // Calculate Margin: (Price - Cost) / Price
      if (price > 0) {
        const m = ((price - cost) / price) * 100;
        setMargin(m);
      }
    } else {
      // Calculate Price: Cost / (1 - Margin)
      // Margin is in percentage, so divided by 100
      const mDecimal = margin / 100;
      if (mDecimal < 1) {
        const p = cost / (1 - mDecimal);
        setPrice(p);
      }
    }
  };

  // Auto-calculate on changes
  useEffect(() => {
    calculate();
  }, [price, margin, cost, mode]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-t-4 border-t-blue-600">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              Simulador de Preço
            </CardTitle>
            <CardDescription>
              {productName || initialSku || 'Simule cenários de precificação'}
            </CardDescription>
          </div>
          {initialSku && (
            <Badge variant="outline" className="font-mono">
              {initialSku}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Tabs value={mode} onValueChange={setMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="findMargin">Calcular Margem</TabsTrigger>
            <TabsTrigger value="findPrice">Calcular Preço</TabsTrigger>
          </TabsList>
          
          <div className="mt-6 space-y-6">
            {/* CUSTO (Hidden for non-Pricing) */}
            <div className="space-y-2 relative">
              <Label htmlFor="cost" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Custo Base
                {!isPricingUser && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <div className="relative">
                <Input 
                  id="cost" 
                  type="number" 
                  value={cost} 
                  onChange={(e) => setCost(Number(e.target.value))}
                  disabled={!isPricingUser} // Only Pricing can edit cost
                  className={cn(
                    "pl-8",
                    !isPricingUser && "bg-muted text-transparent select-none"
                  )}
                />
                <span className="absolute left-3 top-2.5 text-muted-foreground">R$</span>
                {!isPricingUser && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground font-medium bg-muted/50 rounded-md backdrop-blur-[2px]">
                    Confidencial
                  </div>
                )}
              </div>
            </div>

            {/* PREÇO (Editable in findMargin, ReadOnly in findPrice) */}
            <div className="space-y-2">
              <Label htmlFor="price" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Preço de Venda
              </Label>
              <div className="relative">
                <Input 
                  id="price" 
                  type="number" 
                  value={price || ''} 
                  onChange={(e) => setMode('findMargin') || setPrice(Number(e.target.value))}
                  className={cn(
                    "pl-8 font-bold text-lg",
                    mode === 'findPrice' && "bg-blue-50 dark:bg-blue-900/20 border-blue-200"
                  )}
                />
                <span className="absolute left-3 top-3 text-muted-foreground">R$</span>
              </div>
              {mode === 'findPrice' && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Calculado automaticamente com base na margem alvo
                </p>
              )}
            </div>

            {/* MARGEM (Editable in findPrice, ReadOnly in findMargin, Hidden for non-Pricing) */}
            <div className="space-y-2 relative">
              <Label htmlFor="margin" className="flex items-center gap-2">
                <Percent className="w-4 h-4" /> Margem (%)
                {!isPricingUser && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              
              {isPricingUser ? (
                <>
                  <div className="relative">
                    <Input 
                      id="margin" 
                      type="number" 
                      value={margin ? margin.toFixed(2) : ''} 
                      onChange={(e) => setMode('findPrice') || setMargin(Number(e.target.value))}
                      className={cn(
                        "pl-8",
                        mode === 'findMargin' && "bg-green-50 dark:bg-green-900/20 border-green-200 font-bold"
                      )}
                    />
                    <span className="absolute left-3 top-2.5 text-muted-foreground">%</span>
                  </div>
                  
                  {mode === 'findPrice' && (
                    <Slider 
                      value={[margin]} 
                      min={0} 
                      max={100} 
                      step={0.5} 
                      onValueChange={(vals) => setMargin(vals[0])}
                      className="mt-4"
                    />
                  )}
                </>
              ) : (
                <div className="relative">
                  <Input disabled className="bg-muted text-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground font-medium bg-muted/50 rounded-md backdrop-blur-[2px]">
                    Confidencial
                  </div>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </CardContent>

      <CardFooter className="bg-muted/30 flex justify-between items-center py-3">
        <div className="text-xs text-muted-foreground">
          {mode === 'findMargin' ? 'Simulando impacto na margem' : 'Calculando preço ideal'}
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          setCost(initialCost);
          setPrice(initialPrice);
          setMargin(initialMargin);
        }}>
          <RefreshCcw className="w-3 h-3 mr-2" /> Resetar
        </Button>
      </CardFooter>
    </Card>
  );
};

export default PriceSimulator;
