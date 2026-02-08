import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/utils';
import { 
  LogOut, 
  ArrowLeft, 
  Info, 
  CalendarDays, 
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  TrendingUp,
  X,
  Edit,
  Save
} from 'lucide-react';
import Header from './Header';
import HistoryChartModal from './HistoryChartModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, addDays, differenceInDays, isSameMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// Dados Mock para desenvolvimento inicial
const MOCK_CS_CONTRACTS = [
  { id: 1, client_id: 'c1', client_name: 'Cliente A', sku: 'SKU-001', code: '1001', gate: 1, next_validity_date: '2024-02-01', observation: '' },
  { id: 2, client_id: 'c1', client_name: 'Cliente A', sku: 'SKU-002', code: '1002', gate: 2, next_validity_date: '2024-05-15', observation: 'Revisar margem' },
  { id: 3, client_id: 'c2', client_name: 'Cliente B', sku: 'SKU-003', code: '2001', gate: 3, next_validity_date: '2024-10-01', observation: '' },
  { id: 4, client_id: 'c3', client_name: 'Cliente C', sku: 'SKU-004', code: '3001', gate: 1, next_validity_date: '2024-02-20', observation: '' },
  { id: 5, client_id: 'c2', client_name: 'Cliente B', sku: 'SKU-005', code: '2002', gate: 2, next_validity_date: '2024-05-01', observation: '' },
];

const CS = ({ user }) => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    client: '',
    sku: '',
    gate: ''
  });
  
  // Estado para o modal de histórico
  const [selectedItem, setSelectedItem] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Estado para modal de edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [observation, setObservation] = useState('');

  // Carregar dados (Mock ou Real)
  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      // TODO: Substituir por chamada real ao Supabase quando a tabela cs_contracts existir
      // const { data, error } = await supabase.from('cs_contracts').select('*');
      // if (error) throw error;
      
      // Simulando delay de rede
      await new Promise(resolve => setTimeout(resolve, 500));
      setContracts(MOCK_CS_CONTRACTS);
      
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Lógica dos Gates
  const calculateGateDates = (gate, validityDateStr) => {
    if (!validityDateStr) return { communicationDate: null, analysisDate: null };
    
    const validityDate = new Date(validityDateStr);
    // Regra: Aviso prévio ~30 dias antes da vigência
    const communicationDate = addDays(validityDate, -30);
    // Análise: ~60 dias antes (estimativa baseada na descrição dos Gates)
    const analysisDate = addDays(validityDate, -60);

    return { communicationDate, analysisDate };
  };

  const getGateInfo = (gate) => {
    switch(gate) {
      case 1: return "Nov/Dez/Jan/Fev (Vigência Fev)";
      case 2: return "Mar/Abr/Mai/Jun (Vigência Mai)";
      case 3: return "Jul/Ago/Set/Out (Vigência Out)";
      default: return "N/A";
    }
  };

  // Processamento dos dados com cálculos
  const processedData = useMemo(() => {
    return contracts.map(contract => {
      const { communicationDate } = calculateGateDates(contract.gate, contract.next_validity_date);
      const daysRemaining = communicationDate ? differenceInDays(communicationDate, new Date()) : null;
      
      return {
        ...contract,
        communicationDate,
        daysRemaining,
        status: daysRemaining !== null && daysRemaining <= 30 ? 'critical' : 'normal'
      };
    });
  }, [contracts]);

  // Notificações (Stand-by)
  /*
  useEffect(() => {
    const checkNotifications = () => {
      processedData.forEach(item => {
        if (item.daysRemaining !== null && item.daysRemaining <= 30 && item.daysRemaining > 0) {
           // Lógica futura: disparar notificação visual ou email
           console.log(`Alerta: Contrato de ${item.client_name} (${item.sku}) vence em ${item.daysRemaining} dias!`);
        }
      });
    };
    
    if (processedData.length > 0) {
      checkNotifications();
    }
  }, [processedData]);
  */

  // Filtragem
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      const matchClient = !filters.client || item.client_name.toLowerCase().includes(filters.client.toLowerCase());
      const matchSku = !filters.sku || item.sku.toLowerCase().includes(filters.sku.toLowerCase());
      const matchGate = !filters.gate || item.gate.toString() === filters.gate;
      
      return matchClient && matchSku && matchGate;
    });
  }, [processedData, filters]);

  // KPIs
  const kpis = useMemo(() => {
    const totalContracts = filteredData.length;
    const criticalContracts = filteredData.filter(i => i.daysRemaining !== null && i.daysRemaining <= 30 && i.daysRemaining >= 0).length;
    const nextMonthReajust = filteredData.filter(i => i.next_validity_date && isSameMonth(new Date(i.next_validity_date), addMonths(new Date(), 1))).length;

    return { totalContracts, criticalContracts, nextMonthReajust };
  }, [filteredData]);

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  };

  const handleEditClick = (e, item) => {
    e.stopPropagation(); // Evita abrir o modal de histórico
    setEditingItem(item);
    setObservation(item.observation || '');
    setIsEditModalOpen(true);
  };

  const handleSaveObservation = () => {
    // Aqui iria a lógica de update no Supabase
    // await supabase.from('cs_contracts').update({ observation }).eq('id', editingItem.id);
    
    // Atualizando estado localmente para feedback imediato
    const updatedContracts = contracts.map(c => 
      c.id === editingItem.id ? { ...c, observation } : c
    );
    setContracts(updatedContracts);
    
    toast.success('Observação salva com sucesso (Simulação)');
    setIsEditModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717] transition-colors duration-200">
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle="Customer Success" 
        showBack={false} 
        logoRedirect="/select"
      />

      <div className="max-w-[1600px] mx-auto mt-8 px-6 pb-12">
        
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Contratos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{kpis.totalContracts}</h3>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Próximos 30 Dias (Comunicação)</p>
                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">{kpis.criticalContracts}</h3>
              </div>
              <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reajustes Próximo Mês</p>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">{kpis.nextMonthReajust}</h3>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros e Ações */}
        <div className="bg-white dark:bg-[#0a0a0a] p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 flex-1">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar Cliente..."
                  value={filters.client}
                  onChange={(e) => setFilters(prev => ({ ...prev, client: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="relative w-full md:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar SKU..."
                  value={filters.sku}
                  onChange={(e) => setFilters(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <select
                value={filters.gate}
                onChange={(e) => setFilters(prev => ({ ...prev, gate: e.target.value }))}
                className="w-full md:w-32 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Todos Gates</option>
                <option value="1">Gate 1</option>
                <option value="2">Gate 2</option>
                <option value="3">Gate 3</option>
              </select>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors">
                    <Info className="w-4 h-4" />
                    Regras de Gate
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-white dark:bg-gray-800 p-4 max-w-sm shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="space-y-2 text-sm">
                    <p className="font-bold border-b pb-1 mb-2">Lógica de Gates</p>
                    <p><span className="font-semibold text-blue-600">Gate 1:</span> Aniv. Nov-Fev → Vigência Fev</p>
                    <p><span className="font-semibold text-green-600">Gate 2:</span> Aniv. Mar-Jun → Vigência Mai</p>
                    <p><span className="font-semibold text-purple-600">Gate 3:</span> Aniv. Jul-Out → Vigência Out</p>
                    <p className="text-xs text-gray-500 mt-2">*Comunicação deve ocorrer ~30 dias antes da vigência.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Tabela de Contratos */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Código</th>
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold text-center">Gate</th>
                  <th className="px-6 py-4 font-semibold">Próx. Comunicação</th>
                  <th className="px-6 py-4 font-semibold">Próx. Vigência</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      Carregando dados...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr 
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="bg-white dark:bg-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {item.client_name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.code}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                          ${item.gate === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                            item.gate === 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                          G{item.gate}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex flex-col">
                          <span>{item.communicationDate ? format(item.communicationDate, 'dd/MM/yyyy') : '-'}</span>
                          {item.daysRemaining !== null && (
                            <span className={`text-xs font-medium mt-1 
                              ${item.daysRemaining <= 30 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                              {item.daysRemaining} dias restantes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {item.next_validity_date ? format(new Date(item.next_validity_date), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.status === 'critical' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Atenção
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Em dia
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={(e) => handleEditClick(e, item)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-blue-600"
                          title="Editar/Observar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Histórico */}
      <HistoryChartModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        sku={selectedItem?.sku}
        clientId={selectedItem?.client_id}
        clientName={selectedItem?.client_name}
      />

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#171717] dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Editar/Observar Reajuste</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none text-gray-900 dark:text-white">{editingItem?.client_name} - {editingItem?.sku}</h4>
              <p className="text-sm text-gray-500">
                Próxima Vigência: {editingItem?.next_validity_date ? format(new Date(editingItem.next_validity_date), 'dd/MM/yyyy') : '-'}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="obs" className="text-sm font-medium text-gray-900 dark:text-white">
                Observações
              </label>
              <textarea
                id="obs"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 text-gray-900 dark:text-white"
                placeholder="Adicione notas sobre este contrato..."
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleSaveObservation}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CS;
