import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/utils';
import { TrendingUp, TrendingDown, Percent, DollarSign, Activity } from 'lucide-react';
import { WORKFLOW_STATUS_OPTIONS } from '../utils/pricingUtils';

const HistoryChartModal = ({ isOpen, onClose, sku, code, clientId, clientName, readjustmentStatus, onStatusChange }) => {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && clientId && (code || sku)) {
      loadHistory();
    }
  }, [isOpen, sku, code, clientId]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  const loadHistory = async () => {
    if (!clientId || (!code && !sku)) {
        console.warn('HistoryChartModal: Missing clientId or code/sku', { clientId, code, sku });
        return;
    }

    try {
      setLoading(true);
      console.log('HistoryChartModal: Loading history for', { clientId, code: code?.trim?.(), sku: sku?.trim?.() });
      
      let query = supabase
        .from('pricing_history')
        .select('*')
        .eq('client_id', clientId)
        .order('date', { ascending: true });

      if (code) {
        query = query.eq('code', code.trim());
      } else {
        query = query.eq('sku', sku.trim());
      }

      let { data: historyData, error } = await query;

      if (error) throw error;

      if (code && (!historyData || historyData.length === 0) && sku) {
        const fallbackResult = await supabase
          .from('pricing_history')
          .select('*')
          .eq('client_id', clientId)
          .eq('sku', sku.trim())
          .order('date', { ascending: true });
        if (fallbackResult.error) throw fallbackResult.error;
        historyData = fallbackResult.data || [];
      }
      
      console.log('HistoryChartModal: Loaded data', historyData?.length);

      const parseNumericValue = (value) => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isNaN(value) ? null : value;
        const normalized = Number(value);
        return Number.isNaN(normalized) ? null : normalized;
      };

      const formattedData = (historyData || []).map(item => ({
        ...item,
        dateFormatted: format(parseISO(item.date), 'MMM/yy', { locale: ptBR }),
        gross_price: parseNumericValue(item.gross_price),
        net_price: parseNumericValue(item.net_price),
        margin_budget: parseNumericValue(item.margin_budget)
      }));

      setData(formattedData);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const currentRow = data.find(row => Boolean(row.is_current));
    const hasCurrent = Boolean(currentRow);

    // Price Variation (12 months or all data) — ancorado na linha vigente (is_current)
    const sortedByDate = [...data].sort((a, b) => parseISO(a.date) - parseISO(b.date));

    let priceVariation = null;
    if (hasCurrent) {
      const currentDate = parseISO(currentRow.date);
      const oneYearAgo = subMonths(currentDate, 12);
      const eligibleForComparison = sortedByDate.filter(d => parseISO(d.date) <= currentDate);
      let comparisonPoint = eligibleForComparison.find(d => parseISO(d.date) >= oneYearAgo) || eligibleForComparison[0];

      if (comparisonPoint === currentRow && eligibleForComparison.length > 1) {
        comparisonPoint = eligibleForComparison[0];
      }

      const latestGross = Number(currentRow.gross_price);
      const comparisonGross = Number(comparisonPoint.gross_price);
      priceVariation = comparisonGross > 0 ? ((latestGross - comparisonGross) / comparisonGross) * 100 : 0;
    }

    // Average Margin
    const margins = data.map(curr => curr.margin_budget).filter(v => typeof v === 'number' && Number.isFinite(v));
    const avgMargin = margins.length > 0 ? (margins.reduce((acc, curr) => acc + curr, 0) / margins.length) : 0;

    // Preço vigente: vem exclusivamente da flag is_current. Sem fallback.
    const currentPrice = hasCurrent && Number.isFinite(Number(currentRow.gross_price))
      ? Number(currentRow.gross_price)
      : null;
    const currentMargin = hasCurrent && Number.isFinite(Number(currentRow.margin_budget))
      ? Number(currentRow.margin_budget)
      : null;

    return {
      hasCurrent,
      priceVariation,
      avgMargin,
      currentPrice,
      currentMargin,
      currentRowId: hasCurrent ? currentRow.id : null
    };
  }, [data]);

  const currencyCode = data.length > 0 && data[0].currency === 'USD' ? 'USD' : 'BRL';
  const currencySymbol = currencyCode === 'USD' ? '$' : 'R$';

  const CustomLegend = ({ payload }) => {
    return (
      <div className="flex items-center justify-center gap-6 mt-4">
        {payload.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            {entry.value === 'Preço Bruto' ? <DollarSign className="w-4 h-4" style={{ color: entry.color }} /> : <Percent className="w-4 h-4" style={{ color: entry.color }} />}
            <span style={{ color: entry.color }}>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white dark:bg-[#171717] dark:border-gray-800">
        <DialogHeader>
          <div className="flex items-center justify-between mr-8">
            <div className="flex flex-col gap-1">
                <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    Histórico Detalhado - {sku}
                </DialogTitle>
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{clientName}</span>
            </div>
            
            {/* Status Sync Selector */}
            {onStatusChange && (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Status:</span>
                    <Select
                        value={readjustmentStatus || 'Em Análise'}
                        onValueChange={(val) => onStatusChange(val)}
                    >
                        <SelectTrigger className={`w-[180px] h-8 text-xs font-medium border-0 focus:ring-0 focus:ring-offset-0 ${WORKFLOW_STATUS_OPTIONS.find(opt => opt.value === (readjustmentStatus || 'Em Análise'))?.color || 'bg-gray-100 text-gray-700'}`}>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {WORKFLOW_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></div>
                                    {option.label}
                                </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 mt-4">
            {/* Stats Summary */}
            {!loading && data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Preço Atual (Bruto)</p>
                        {stats && stats.hasCurrent && stats.currentPrice !== null ? (
                            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {currencySymbol} {stats.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h4>
                        ) : (
                            <h4 className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">
                                sem preço vigente
                            </h4>
                        )}
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Variação de Preço (12m)</p>
                        {stats && stats.hasCurrent && stats.priceVariation !== null ? (
                            <div className={`flex items-center gap-2 mt-1 font-bold text-lg ${stats.priceVariation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stats.priceVariation >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                {Math.abs(stats.priceVariation).toFixed(1)}%
                            </div>
                        ) : (
                            <h4 className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-1">
                                sem preço vigente
                            </h4>
                        )}
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Média de Margem</p>
                        {stats && (
                            <div className="flex items-center gap-2 mt-1 font-bold text-lg text-purple-600 dark:text-purple-400">
                                <Percent className="w-5 h-5" />
                                {stats.avgMargin.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="h-[400px] w-full">
            {loading ? (
                <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={data}
                    margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
                    <XAxis 
                    dataKey="dateFormatted" 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280' }}
                    />
                    <YAxis 
                    yAxisId="left"
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280' }}
                    tickFormatter={(value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: currencyCode })}
                    />
                    <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    stroke="#6B7280"
                    tick={{ fill: '#6B7280' }}
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    domain={[0, 'auto']} // Margin usually starts at 0 or can be negative, but better visual if 0 base or auto
                    />
                    <Tooltip 
                    formatter={(value, name) => {
                        if (name === 'Preço Bruto') return [`${currencySymbol} ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
                        if (name === 'Margem Orçada') return [`${Number(value).toFixed(1)}%`, name];
                        return [value, name];
                    }}
                    contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: 'none',
                        borderRadius: '0.5rem',
                        color: '#fff'
                    }}
                    />
                    <Legend content={<CustomLegend />} />
                    <Bar
                    yAxisId="left"
                    dataKey="gross_price"
                    name="Preço Bruto"
                    fill={COLORS[4]}
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                    />
                    <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="margin_budget"
                    name="Margem Orçada"
                    stroke={COLORS[1]}
                    strokeWidth={3}
                    activeDot={{ r: 6 }}
                    />
                     {stats && (
                        <ReferenceLine 
                            yAxisId="right" 
                            y={stats.avgMargin} 
                            stroke="#F59E0B" 
                            strokeDasharray="3 3" 
                            label={{ value: 'Média', position: 'right', fill: '#F59E0B', fontSize: 12 }} 
                        />
                     )}
                </ComposedChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                Nenhum histórico encontrado para este item.
                </div>
            )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryChartModal;
