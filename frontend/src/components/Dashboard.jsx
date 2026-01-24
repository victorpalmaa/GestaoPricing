import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
 
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  LogOut, 
  X,
  DollarSign,
  Package,
  TrendingUp,
  BarChart3,
  Filter,
  Download,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/utils';

const Dashboard = ({ user, setUser, permissions = { canAdd: true, canEdit: true, canDelete: true }, title = 'Leads' }) => {
  const navigate = useNavigate();
  const getToken = () => localStorage.getItem('pronutrition_token') || sessionStorage.getItem('pronutrition_token');
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [showMoney, setShowMoney] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(null);
  const [statusMenuPos, setStatusMenuPos] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('');
  const [showMoreMetrics, setShowMoreMetrics] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' });
  const [initialLoading, setInitialLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showAlert = (message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 3000);
  };
  const [formData, setFormData] = useState({
    cliente: '',
    sku: '',
    pricingId: '',
    precoLiquido: '',
    precoBruto: '',
    margemBruta: '',
    volume: '',
    status: 'em_aberto'
  });

  const parseDateInput = (val) => {
    if (!val) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    const t = new Date(val);
    if (!isNaN(t)) return t;
    return null;
  };

  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('prices')
        .select('id, cliente, sku, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat')
        .order('createdat', { ascending: false });
      if (error) {
        setLeads([]);
        setFilteredLeads([]);
        toast.error('Falha ao carregar preços');
      } else {
        const mapped = (data || []).map(r => ({
          id: r.id,
          cliente: r.cliente,
          sku: r.sku,
          pricingId: r.pricingid,
          precoLiquido: r.precoliquido,
          precoBruto: r.precobruto,
          margemBruta: r.margembruta,
          volume: r.volume,
          status: r.status,
          createdAt: r.createdat,
        }));
        setLeads(mapped);
        setFilteredLeads(mapped);
      }
      setInitialLoading(false);
    })();
  }, []);

  useEffect(() => {
    let data = [...leads];

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      data = data.filter(lead =>
        lead.cliente.toLowerCase().includes(term) ||
        lead.sku.toLowerCase().includes(term)
      );
    }

    if (filterStatus) {
      data = data.filter(l => (l.status || 'em_aberto') === filterStatus);
    }

    if (filterStartDate) {
      const start = parseDateInput(filterStartDate);
      if (start) {
        data = data.filter(l => new Date(l.createdAt) >= start);
      }
    }
    if (filterEndDate) {
      const end = parseDateInput(filterEndDate);
      if (end) {
        end.setHours(23,59,59,999);
        data = data.filter(l => new Date(l.createdAt) <= end);
      }
    }

    if (sortField && sortDir) {
      data.sort((a, b) => {
        const av = sortField === 'volume' ? a.volume
                 : sortField === 'margemBruta' ? a.margemBruta
                 : sortField === 'precoBruto' ? a.precoBruto
                 : 0;
        const bv = sortField === 'volume' ? b.volume
                 : sortField === 'margemBruta' ? b.margemBruta
                 : sortField === 'precoBruto' ? b.precoBruto
                 : 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }

    setFilteredLeads(data);
  }, [leads, searchTerm, filterStatus, filterStartDate, filterEndDate, sortField, sortDir]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('pronutrition_user');
      localStorage.removeItem('pronutrition_token');
      localStorage.removeItem('pronutrition_remember');
      sessionStorage.removeItem('pronutrition_user');
      sessionStorage.removeItem('pronutrition_token');
    } catch {}
    try { supabase.auth.signOut(); } catch {}
    setUser(null);
    navigate('/login');
  };

  const openModal = (lead = null) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        cliente: lead.cliente,
        sku: lead.sku,
        pricingId: lead.pricingId || '',
        precoLiquido: lead.precoLiquido,
        precoBruto: lead.precoBruto,
        margemBruta: lead.margemBruta,
        volume: lead.volume,
        status: lead.status || 'em_aberto'
      });
    } else {
      setEditingLead(null);
      setFormData({
        cliente: '',
        sku: '',
        pricingId: '',
        precoLiquido: '',
        precoBruto: '',
        margemBruta: '',
        volume: '',
        status: 'em_aberto'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const leadData = {
      ...formData,
      precoLiquido: parseFloat(formData.precoLiquido),
      precoBruto: parseFloat(formData.precoBruto),
      margemBruta: parseFloat(formData.margemBruta),
      volume: parseInt(formData.volume),
      status: formData.status
    };

    if (editingLead) {
      (async () => {
        const { data: updatedRows, error } = await supabase
          .from('prices')
          .update({
            cliente: leadData.cliente,
            sku: leadData.sku,
            pricingid: leadData.pricingId,
            precoliquido: leadData.precoLiquido,
            precobruto: leadData.precoBruto,
            margembruta: leadData.margemBruta,
            volume: leadData.volume,
            status: leadData.status
          })
          .eq('id', editingLead.id)
          .select('id, cliente, sku, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat');
        if (error) {
          showAlert(error.message || 'Falha ao atualizar', 'error');
          toast.error('Falha ao atualizar');
        } else {
          const r = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
          const updated = {
            id: r.id,
            cliente: r.cliente,
            sku: r.sku,
            pricingId: r.pricingid,
            precoLiquido: r.precoliquido,
            precoBruto: r.precobruto,
            margemBruta: r.margembruta,
            volume: r.volume,
            status: r.status,
            createdAt: r.createdat,
          };
          setLeads(leads.map(l => l.id === editingLead.id ? updated : l));
          showAlert('Lead atualizado com sucesso', 'success');
          toast.success('Lead atualizado');
        }
      })();
    } else {
      (async () => {
        const { data: insertedRows, error } = await supabase
          .from('prices')
          .insert([
            {
              cliente: leadData.cliente,
              sku: leadData.sku,
              pricingid: leadData.pricingId,
              precoliquido: leadData.precoLiquido,
              precobruto: leadData.precoBruto,
              margembruta: leadData.margemBruta,
              volume: leadData.volume,
              status: leadData.status
            }
          ])
          .select('id, cliente, sku, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat');
        if (error) {
          showAlert(error.message || 'Falha ao adicionar', 'error');
          toast.error('Falha ao adicionar');
        } else {
          const r = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
          const newLead = {
            id: r.id,
            cliente: r.cliente,
            sku: r.sku,
            pricingId: r.pricingid,
            precoLiquido: r.precoliquido,
            precoBruto: r.precobruto,
            margemBruta: r.margembruta,
            volume: r.volume,
            status: r.status,
            createdAt: r.createdat,
          };
          setLeads([newLead, ...leads]);
          setShowMoney(true);
          setTimeout(() => setShowMoney(false), 3000);
          showAlert('Lead adicionado com sucesso', 'success');
          toast.success('Lead adicionado');
        }
      })();
    }

    closeModal();
    setIsSubmitting(false);
  };

  const handleDelete = (id) => {
    setLeadToDelete(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (leadToDelete) {
      (async () => {
        const { error } = await supabase
          .from('prices')
          .delete()
          .eq('id', leadToDelete);
        if (error) {
          showAlert('Falha ao excluir', 'error');
          toast.error('Falha ao excluir');
        } else {
          setLeads(leads.filter(l => l.id !== leadToDelete));
          setLeadToDelete(null);
          showAlert('Lead excluído com sucesso', 'danger');
          toast.success('Lead excluído');
        }
      })();
    }
    setIsConfirmOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const exportToExcel = () => {
    const dataToExport = filteredLeads.map(l => ({
      'Cliente': l.cliente,
      'SKU': l.sku,
      'Precificacao': l.pricingId,
      'PrecoLiquido': l.precoLiquido,
      'PrecoBruto': l.precoBruto,
      'MargemBruta': l.margemBruta,
      'Volume': l.volume,
      'Status': l.status || 'em_aberto',
      'Data': new Date(l.createdAt).toLocaleDateString('pt-BR')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pre Vendas");
    XLSX.writeFile(wb, "pre-vendas.xlsx");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Header */}
      <header className="">
        <div className="max-w-[110rem] mx-auto px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/logo-pronutrition-symbol.png" 
                alt="PRONUTRITION" 
                className="h-20"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                PN
              </div>
              <div>
                <h2 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Gestão de Pricing
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.nome || user?.user_metadata?.nome} {user?.sobrenome || user?.user_metadata?.sobrenome}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {user?.area || user?.user_metadata?.area}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Money Animation Overlay */}
      {showMoney && (
        <div className="cash-animation-container">
          {[...Array(12)].map((_, i) => {
            const left = `${i * 8}vw`;
            const duration = `${2 + (i % 4) * 0.2}s`;
            const delay = `${i * 0.1}s`;
            const size = 22;
            const color = 'var(--color-success)';
            return (
              <DollarSign
                key={i}
                size={size}
                className="cash-icon"
                style={{ left, animationDuration: duration, animationDelay: delay, color }}
              />
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="flex items-center justify-end mb-1">
          <button
            onClick={() => setShowMoreMetrics(!showMoreMetrics)}
            className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
          >
            {showMoreMetrics ? 'Menos métricas' : 'Mais métricas'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Total de Leads
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {leads.length}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(132, 90, 250, 0.1)' }}>
                <BarChart3 size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  ROB Estimado
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  R$ {(leads.reduce((acc, lead) => acc + (lead.precoBruto * lead.volume), 0) / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(100, 208, 32, 0.1)' }}>
                <DollarSign size={24} style={{ color: 'var(--color-success)' }} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Taxa de Assertividade
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {(() => {
                    const aprovados = leads.filter(l => l.status === 'aprovado').length;
                    const reprovados = leads.filter(l => l.status === 'reprovado').length;
                    const base = aprovados + reprovados;
                    return base > 0 ? Math.round((aprovados / base) * 100) : 0;
                  })()}%
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(26, 198, 252, 0.1)' }}>
                <TrendingUp size={24} style={{ color: 'var(--color-info)' }} />
              </div>
            </div>
          </div>
        </div>

        {showMoreMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    MB Absoluta (Aprovados)
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    R$ {( 
                      leads
                        .filter(l => l.status === 'aprovado')
                        .reduce((acc, l) => acc + (l.precoBruto * l.volume * (l.margemBruta / 100)), 0) / 1000
                    ).toFixed(1)}k
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(100, 208, 32, 0.1)' }}>
                  <DollarSign size={24} style={{ color: 'var(--color-success)' }} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    MB Média
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {leads.length > 0 
                      ? (leads.reduce((acc, lead) => acc + lead.margemBruta, 0) / leads.length).toFixed(1)
                      : '0'}%
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(26, 198, 252, 0.1)' }}>
                  <TrendingUp size={24} style={{ color: 'var(--color-info)' }} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    ROL Estimado
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    R$ {(leads.reduce((acc, lead) => acc + (lead.precoLiquido * lead.volume), 0) / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(100, 208, 32, 0.1)' }}>
                  <DollarSign size={24} style={{ color: 'var(--color-success)' }} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift" style={{ padding: '1.25rem' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Volume Total
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {leads.reduce((acc, lead) => acc + lead.volume, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(100, 208, 32, 0.1)' }}>
                  <Package size={24} style={{ color: 'var(--color-success)' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="card-pronutrition mb-6" style={{ padding: '1.5rem' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar por cliente ou SKU..."
                  className="input-pronutrition pl-10 h-12 text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="relative flex items-center space-x-2">
              <button
                onClick={() => openModal()}
                className="btn-primary flex items-center space-x-2"
                style={{ transition: 'transform 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Plus size={20} />
                <span>Adicionar Novo Preço</span>
              </button>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 hover:bg-gray-100"
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                title="Filtros"
              >
                <Filter size={18} style={{ transition: 'transform 0.2s ease', transform: isFilterOpen ? 'rotate(90deg) scale(1.05)' : 'rotate(0deg)' }} />
              </button>
              <button
                onClick={exportToExcel}
                className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 hover:bg-gray-100"
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                title="Exportar CSV"
              >
                <Download size={18} />
              </button>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setIsFilterOpen(false)}></div>
                  <div className="card-pronutrition absolute right-0 top-12 w-80 text-xs" style={{ padding: '1.25rem', zIndex: 50 }} onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label-pronutrition text-xs" style={{ fontSize: '0.75rem' }}>Status</label>
                      <select
                        className="input-pronutrition text-xs"
                        style={{ fontSize: '0.75rem' }}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="">Todos</option>
                        <option value="em_aberto">Em aberto</option>
                        <option value="aprovado">Aprovado</option>
                        <option value="reprovado">Reprovado</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs" style={{ fontSize: '0.75rem' }}>Data início</label>
                      <input
                        type="date"
                        className="input-pronutrition text-xs"
                        style={{ fontSize: '0.75rem' }}
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs" style={{ fontSize: '0.75rem' }}>Data fim</label>
                      <input
                        type="date"
                        className="input-pronutrition text-xs"
                        style={{ fontSize: '0.75rem' }}
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs" style={{ fontSize: '0.75rem' }}>Ordenar por</label>
                      <select
                        className="input-pronutrition text-xs"
                        style={{ fontSize: '0.75rem' }}
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value)}
                      >
                        <option value="">Nenhum</option>
                        <option value="volume">Volume</option>
                        <option value="margemBruta">MB</option>
                        <option value="precoBruto">Preço Bruto</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs" style={{ fontSize: '0.75rem' }}>Direção</label>
                      <select
                        className="input-pronutrition text-xs"
                        style={{ fontSize: '0.75rem' }}
                        value={sortDir}
                        onChange={(e) => setSortDir(e.target.value)}
                      >
                        <option value="">Qualquer</option>
                        <option value="desc">Maior → menor</option>
                        <option value="asc">Menor → maior</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                      onClick={() => {
                        setFilterStatus('');
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setSortField('');
                        setSortDir('');
                      }}
                    >
                      Remover filtros
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card-pronutrition" style={{ padding: 0, overflow: 'visible' }}>
          {initialLoading && (
            <div className="px-6 py-4">
              <p style={{ color: 'var(--color-text-secondary)' }}>Carregando dados...</p>
            </div>
          )}
          <div className="overflow-x-hidden" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '2px solid var(--color-primary)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', width: '25%', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', width: '35%', backgroundColor: 'var(--color-bg-secondary)' }}>
                    SKU
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', width: '20%', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Precificação
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Preço Líquido
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Preço Bruto
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    MB (%)
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Volume
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', width: '180px', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Data
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold" 
                      style={{ color: 'var(--color-text-secondary)', width: '180px', backgroundColor: 'var(--color-bg-secondary)' }}>
                    Edição
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-12 text-center">
                      <p style={{ color: 'var(--color-text-muted)' }}>
                        {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum preço cadastrado ainda'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead, index) => (
                    <tr 
                      key={lead.id}
                      style={{ 
                        borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td className="px-6 py-4" style={{ color: 'var(--color-text-primary)', wordBreak: 'break-word', width: '25%' }}>
                        {lead.cliente}
                      </td>
                      <td className="px-6 py-4" style={{ width: '35%' }}>
                        <span className="px-3 py-1 rounded-lg text-sm font-medium"
                              style={{ 
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-secondary)',
                                wordBreak: 'break-word'
                              }}>
                          {lead.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4" style={{ width: '20%' }}>
                        <span className="px-3 py-1 rounded-lg text-sm font-medium"
                              style={{ 
                                backgroundColor: 'var(--color-bg-secondary)',
                                color: 'var(--color-text-secondary)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                          {lead.pricingId}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium" 
                          style={{ color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>
                        R$ {lead.precoLiquido.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right" 
                          style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        R$ {lead.precoBruto.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-3 py-1 rounded-lg text-sm font-semibold"
                              style={{ 
                                backgroundColor: lead.margemBruta >= 35 
                                  ? 'rgba(100, 208, 32, 0.15)' 
                                  : 'rgba(26, 198, 252, 0.15)',
                                color: lead.margemBruta >= 35 
                                  ? 'var(--color-success)' 
                                  : 'var(--color-info)'
                              }}>
                          {lead.margemBruta.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" 
                          style={{ color: 'var(--color-text-secondary)' }}>
                        {lead.volume.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-left">
                        {(() => {
                          const s = lead.status || 'em_aberto';
                          const label = s === 'aprovado' ? 'Aprovado' : s === 'reprovado' ? 'Reprovado' : 'Em aberto';
                          const color = s === 'aprovado' ? 'var(--color-success)' : s === 'reprovado' ? 'var(--color-danger)' : 'var(--color-info)';
                          const bg = s === 'aprovado' ? 'rgba(100, 208, 32, 0.15)' : s === 'reprovado' ? 'rgba(255, 86, 86, 0.15)' : 'rgba(26, 198, 252, 0.15)';
                          return (
                            <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: bg, color, whiteSpace: 'nowrap' }}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-left" style={{ color: 'var(--color-text-secondary)' }}>
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4" style={{ width: '180px' }}>
                        <div className="relative flex items-center justify-center gap-2 w-full px-2 overflow-visible">
                          {permissions.canEdit && (
                            <button
                              onClick={() => openModal(lead)}
                              className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                              style={{ color: 'var(--color-info)' }}
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {permissions.canEdit && (
                            <button
                              onClick={(e) => {
                                const nextOpen = statusMenuOpen === lead.id ? null : lead.id;
                                if (nextOpen) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const menuWidth = 224;
                                  const menuHeight = 180;
                                  let top = rect.bottom + 8 + window.scrollY;
                                  if (top + menuHeight > window.innerHeight + window.scrollY) {
                                    top = rect.top - menuHeight - 8 + window.scrollY;
                                  }
                                  let left = rect.right - menuWidth + window.scrollX;
                                  const maxLeft = window.innerWidth - menuWidth - 8 + window.scrollX;
                                  left = Math.min(Math.max(8 + window.scrollX, left), maxLeft);
                                  setStatusMenuPos({ top, left });
                                }
                                setStatusMenuOpen(nextOpen);
                              }}
                              className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                              style={{ color: 'var(--color-success)' }}
                              title="Alterar Status"
                            >
                              <DollarSign size={18} />
                            </button>
                          )}
                          {statusMenuOpen === lead.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setStatusMenuOpen(null)}></div>
                              <div className="card-pronutrition fixed z-50 w-56" style={{ padding: '0.5rem', top: statusMenuPos?.top, left: statusMenuPos?.left, overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
                                <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Definir status:</p>
                                <div className="space-y-2">
                                  {[
                                    { key: 'em_aberto', label: 'Em aberto', color: 'var(--color-info)' },
                                    { key: 'aprovado', label: 'Aprovado', color: 'var(--color-success)' },
                                    { key: 'reprovado', label: 'Reprovado', color: 'var(--color-danger)' },
                                  ].map(opt => (
                                    <button
                                      key={opt.key}
                                      className="w-full px-3 py-2 rounded-lg hover:bg-gray-100 text-left"
                                      style={{ color: opt.color }}
                                      onClick={() => {
                                        (async () => {
                                          const { data: updatedRows, error } = await supabase
                                            .from('prices')
                                            .update({ status: opt.key })
                                            .eq('id', lead.id)
                                            .select('id, cliente, sku, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat');
                                          if (error) {
                                            setStatusMenuOpen(null);
                                            showAlert('Falha ao atualizar status', 'error');
                                            toast.error('Falha ao atualizar status');
                                          } else {
                                            const r = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
                                            const updated = {
                                              id: r.id,
                                              cliente: r.cliente,
                                              sku: r.sku,
                                              pricingId: r.pricingid,
                                              precoLiquido: r.precoliquido,
                                              precoBruto: r.precobruto,
                                              margemBruta: r.margembruta,
                                              volume: r.volume,
                                              status: r.status,
                                              createdAt: r.createdat,
                                            };
                                            setLeads(leads.map(l => l.id === lead.id ? updated : l));
                                            if (opt.key === 'aprovado') {
                                              setShowMoney(true);
                                              setTimeout(() => setShowMoney(false), 2500);
                                            }
                                            setStatusMenuOpen(null);
                                            showAlert('Status atualizado com sucesso', 'success');
                                            toast.success('Status atualizado');
                                          }
                                        })();
                                      }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                          {permissions.canDelete && (
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                              style={{ color: 'var(--color-danger)' }}
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {alert?.show && (
        <div className="fixed bottom-4 right-4 z-[60]">
          {(() => {
            const colorMap = {
              success: 'var(--color-success)',
              error: 'var(--color-danger)',
              danger: 'var(--color-danger)',
              info: 'var(--color-info)'
            };
            const bgMap = {
              success: 'rgba(100, 208, 32, 0.15)',
              error: 'rgba(255, 86, 86, 0.15)',
              danger: 'rgba(255, 86, 86, 0.15)',
              info: 'rgba(26, 198, 252, 0.15)'
            };
            const iconMap = {
              success: <CheckCircle size={16} />,
              error: <AlertTriangle size={16} />,
              danger: <AlertTriangle size={16} />,
              info: <Info size={16} />
            };
            const c = colorMap[alert.type] || 'var(--color-info)';
            const bg = bgMap[alert.type] || 'rgba(26, 198, 252, 0.15)';
            const ic = iconMap[alert.type] || <Info size={16} />;
            return (
              <div className="p-3 rounded-lg shadow flex items-center gap-2" style={{ backgroundColor: bg, border: `1px solid ${c}` }}>
                <div style={{ color: c }}>{ic}</div>
                <p className="text-sm" style={{ color: c }}>{alert.message}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => setIsConfirmOpen(false)}>
          <div className="card-pronutrition max-w-md w-full fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Confirmar exclusão
              </h3>
              <button onClick={() => setIsConfirmOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Tem certeza que deseja excluir este preço?
            </p>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-6 py-3 rounded-lg font-semibold transition-colors" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} className="btn-danger">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
             onClick={closeModal}>
          <div className="card-pronutrition max-w-2xl w-full fade-in"
               style={{ padding: '1.5rem' }}
               onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {editingLead ? 'Editar Preço' : 'Adicionar Novo Preço'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cliente */}
              <div>
                <label htmlFor="cliente" className="label-pronutrition">
                  Nome do Cliente
                </label>
                <input
                  id="cliente"
                  name="cliente"
                  type="text"
                  required
                  className="input-pronutrition"
                  style={{ padding: '0.75rem' }}
                  placeholder="Ex: Farmácia São Paulo LTDA"
                  value={formData.cliente}
                  onChange={handleChange}
                />
              </div>

              {/* SKU */}
              <div>
                <label htmlFor="sku" className="label-pronutrition">
                  SKU
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  required
                  className="input-pronutrition"
                  style={{ padding: '0.75rem' }}
                  placeholder="Ex: PRO-WHEY-1KG"
                  value={formData.sku}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="pricingId" className="label-pronutrition">
                  ID da Precificação
                </label>
                <input
                  id="pricingId"
                  name="pricingId"
                  type="text"
                  required
                  className="input-pronutrition"
                  style={{ padding: '0.75rem' }}
                  placeholder="Ex: PRC-2025-0001"
                  value={formData.pricingId}
                  onChange={handleChange}
                />
              </div>

              {/* Preços (lado a lado) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="precoLiquido" className="label-pronutrition">
                    Preço Líquido (R$)
                  </label>
                  <input
                    id="precoLiquido"
                    name="precoLiquido"
                    type="number"
                    step="0.01"
                    required
                    className="input-pronutrition"
                    style={{ padding: '0.75rem' }}
                    placeholder="89.90"
                    value={formData.precoLiquido}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="precoBruto" className="label-pronutrition">
                    Preço Bruto (R$)
                  </label>
                  <input
                    id="precoBruto"
                    name="precoBruto"
                    type="number"
                    step="0.01"
                    required
                    className="input-pronutrition"
                    style={{ padding: '0.75rem' }}
                    placeholder="129.90"
                    value={formData.precoBruto}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Margem e Volume (lado a lado) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="margemBruta" className="label-pronutrition">
                    Margem Bruta (%)
                  </label>
                  <input
                    id="margemBruta"
                    name="margemBruta"
                    type="number"
                    step="0.1"
                    required
                    className="input-pronutrition"
                    style={{ padding: '0.75rem' }}
                    placeholder="30.8"
                    value={formData.margemBruta}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="volume" className="label-pronutrition">
                    Volume
                  </label>
                  <input
                    id="volume"
                    name="volume"
                    type="number"
                    required
                    className="input-pronutrition"
                    style={{ padding: '0.75rem' }}
                    placeholder="500"
                    value={formData.volume}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 rounded-lg font-semibold transition-colors"
                  style={{ 
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (editingLead ? 'Salvando...' : 'Adicionando...') : (editingLead ? 'Salvar Alterações' : 'Adicionar Preço')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;