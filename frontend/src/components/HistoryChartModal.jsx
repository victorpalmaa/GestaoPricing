import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/utils';

const HistoryChartModal = ({ isOpen, onClose, sku, clientId, clientName }) => {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && sku && clientId) {
      loadHistory();
    }
  }, [isOpen, sku, clientId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const { data: historyData, error } = await supabase
        .from('pricing_history')
        .select('*')
        .eq('client_id', clientId)
        .eq('sku', sku)
        .order('date', { ascending: true });

      if (error) throw error;

      const formattedData = (historyData || []).map(item => ({
        ...item,
        dateFormatted: format(new Date(item.date), 'dd/MM/yy', { locale: ptBR }),
        net_price: Number(item.net_price),
        margin_budget: Number(item.margin_budget)
      }));

      setData(formattedData);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = data.length > 0 && data[0].currency === 'USD' ? '$' : 'R$';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white dark:bg-[#171717] dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">
            Histórico de Preço e Margem - {sku} ({clientName})
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 h-[400px] w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis 
                  dataKey="dateFormatted" 
                  stroke="#6B7280"
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#6B7280"
                  tick={{ fill: '#6B7280' }}
                  tickFormatter={(value) => `${currencySymbol} ${value.toFixed(2)}`}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#6B7280"
                  tick={{ fill: '#6B7280' }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="net_price"
                  name="Preço Líquido"
                  stroke="#3b82f6"
                  activeDot={{ r: 8 }}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="margin_budget"
                  name="Margem Orçada"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Nenhum histórico encontrado para este item.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryChartModal;
