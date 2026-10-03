import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchableSelect from './SearchableSelect';
import Header from './Header';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  Info,
  Clock,
  Activity,
  Check,
  XCircle,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/utils';
import { toast } from 'sonner';
import { logExport } from '@/utils/activityLog';
import { montarPayloadPreco, validarMacoPct } from '../lib/pricing/montarPayloadPreco';

const CLIENTS_PAGE_SIZE = 1000;

const normalizeLookupValue = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const loadAllRows = async (tableName, selectClause, orderColumn) => {
  let rows = [];
  let from = 0;

  while (true) {
    const to = from + CLIENTS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select(selectClause)
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const batch = data || [];
    rows = rows.concat(batch);

    if (batch.length < CLIENTS_PAGE_SIZE) {
      break;
    }

    from += CLIENTS_PAGE_SIZE;
  }

  return rows;
};

const loadAllClients = async () => {
  return loadAllRows('clients', 'id, name', 'name');
};

const loadAllClientAliases = async () => {
  return loadAllRows('client_aliases', 'id, alias, canonical_name', 'alias');
};

const Dashboard = ({ user, setUser, permissions = { canAdd: true, canEdit: true, canDelete: true }, title = 'Leads' }) => {
  const navigate = useNavigate();
  const getToken = () => localStorage.getItem('pronutrition_token') || sessionStorage.getItem('pronutrition_token');
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [clientFilter, setClientFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [precoBrutoFilter, setPrecoBrutoFilter] = useState('');
  const [margemBrutaFilter, setMargemBrutaFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [clients, setClients] = useState([]);
  const [clientAliases, setClientAliases] = useState([]);

  const clientOptions = useMemo(() => {
    const uniqueClients = [...new Set(leads.map(lead => lead.cliente))].filter(Boolean).sort();
    return uniqueClients.map(client => ({ label: client, value: client }));
  }, [leads]);

  const clientBaseOptions = useMemo(() => {
    const canonicalFromAliases = new Map();
    for (const a of clientAliases || []) {
      if (!a || !a.alias || !a.canonical_name) continue;
      canonicalFromAliases.set(String(a.alias).trim(), String(a.canonical_name).trim());
    }
    const canonicalByName = new Map();
    for (const c of clients || []) {
      if (!c || !c.name) continue;
      canonicalByName.set(String(c.name).trim(), String(c.name).trim());
    }
    const merged = new Map();
    for (const [, v] of canonicalByName) merged.set(v, v);
    for (const [, v] of canonicalFromAliases) merged.set(v, v);
    const list = Array.from(merged.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return list.map(n => ({ label: n, value: n }));
  }, [clients, clientAliases]);

  const skuOptions = useMemo(() => {
    let data = leads;
    if (clientFilter) {
      data = data.filter(lead => lead.cliente === clientFilter);
    }
    const uniqueSKUs = [...new Set(data.map(lead => lead.sku))].filter(Boolean).sort();
    return uniqueSKUs.map(sku => ({ label: sku, value: sku }));
  }, [leads, clientFilter]);

  const precoBrutoOptions = useMemo(() => {
    const uniquePrices = [...new Set(leads.map(lead => lead.precoBruto))].filter(p => p != null).sort((a, b) => a - b);
    return uniquePrices.map(p => ({ label: `R$ ${p.toFixed(2)}`, value: p.toString() }));
  }, [leads]);

  const margemBrutaOptions = useMemo(() => {
    const uniqueMargins = [...new Set(leads.map(lead => lead.margemBruta))].filter(m => m != null).sort((a, b) => a - b);
    return uniqueMargins.map(m => ({ label: `${m.toFixed(1)}%`, value: m.toString() }));
  }, [leads]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [leadToReject, setLeadToReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showMoney, setShowMoney] = useState(false);
  const [decisionEffect, setDecisionEffect] = useState({ visible: false, status: '', tokens: [], logoTokens: [] });
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
  const [initialLoading, setInitialLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basePriceId, setBasePriceId] = useState('');
  const [modoMercado, setModoMercado] = useState('nacional');

  // Prepare options for base price selection
  const basePriceOptions = useMemo(() => {
    return leads.map(l => ({
      value: l.id,
      label: `${l.sku} - ${l.cliente} - R$ ${l.precoBruto.toFixed(2)}`
    }));
  }, [leads]);

  const handleBasePriceChange = (value) => {
    setBasePriceId(value);
    const selectedPrice = leads.find(l => l.id === value);
    if (selectedPrice) {
      setModoMercado(selectedPrice.mercado === 'exportacao' ? 'exportacao' : 'nacional');
      setFormData(prev => ({
        ...prev,
        cliente: selectedPrice.cliente,
        sku: selectedPrice.sku,
        category: selectedPrice.category,
        subcategory: selectedPrice.subcategory,
        pricingId: selectedPrice.pricingId,
        precoLiquido: selectedPrice.precoLiquido,
        precoBruto: selectedPrice.precoBruto,
        precoBRL: selectedPrice.mercado === 'exportacao' ? (selectedPrice.precoBruto ?? '') : '',
        precoUSD: selectedPrice.precoUSD ?? '',
        ptax: selectedPrice.ptax ?? '',
        macoPct: selectedPrice.macoPct ?? '',
        margemBruta: selectedPrice.margemBruta,
        volume: selectedPrice.volume,
        status: 'em_aberto', // Reset status for new entry
        originType: selectedPrice.originType
      }));
    }
  };

  // Constants
  const CATEGORY_OPTIONS = ['Pó', 'Gel', 'Goma', 'Cápsula', 'Pastilha', 'Softgel'];
  const SUBCATEGORY_OPTIONS = ['Goma', 'Cápsula', 'Colágeno', 'Creatina', 'Gel', 'Glutamina', 'Outros', 'Pastilha', 'Proteína'];

  const [formData, setFormData] = useState({
    cliente: '',
    sku: '',
    category: '',
    subcategory: '',
    pricingId: '',
    precoLiquido: '',
    precoBruto: '',
    precoBRL: '',
    precoUSD: '',
    ptax: '',
    macoPct: '',
    margemBruta: '',
    volume: '',
    status: 'em_aberto',
    originType: ''
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
      const [
        pricesRes,
        clientsRes,
        aliasesRes,
      ] = await Promise.all([
        supabase
          .from('prices')
          .select('id, cliente, sku, category, subcategory, pricingid, precoliquido, precobruto, margembruta, maco_pct, volume, status, createdat, origin_type, origin_tag, mercado, preco_usd, ptax')
          .order('createdat', { ascending: false }),
        loadAllClients().catch(() => []),
        loadAllClientAliases().catch(() => []),
      ]);
      setClients(clientsRes || []);
      setClientAliases(aliasesRes || []);
      const { data, error } = pricesRes;
      if (error) {
        setLeads([]);
        setFilteredLeads([]);
        toast.error('Falha ao carregar preços');
      } else {
        const mapped = (data || []).map(r => ({
          id: r.id,
          cliente: r.cliente,
          sku: r.sku,
          category: r.category,
          subcategory: r.subcategory,
          pricingId: r.pricingid,
          precoLiquido: r.precoliquido,
          precoBruto: r.precobruto,
          margemBruta: r.margembruta,
          macoPct: r.maco_pct,
          volume: r.volume,
          status: r.status,
          createdAt: r.createdat,
          originType: r.origin_type || '',
          originTag: r.origin_tag || '',
          mercado: r.mercado || 'nacional',
          precoUSD: r.preco_usd,
          ptax: r.ptax,
        }));
        setLeads(mapped);
        setFilteredLeads(mapped);
      }
      setInitialLoading(false);
    })();
  }, []);

  useEffect(() => {
    let data = [...leads];

    if (clientFilter) {
      data = data.filter(lead => lead.cliente === clientFilter);
    }

    if (skuFilter) {
      data = data.filter(lead => lead.sku === skuFilter);
    }

    if (precoBrutoFilter) {
      data = data.filter(lead => lead.precoBruto?.toString().includes(precoBrutoFilter));
    }

    if (margemBrutaFilter) {
      data = data.filter(lead => lead.margemBruta?.toString().includes(margemBrutaFilter));
    }

    if (filterStatus) {
      data = data.filter(l => (l.status || 'em_aberto') === filterStatus);
    }

    if (originFilter) {
      data = data.filter(l => (l.originType || '') === originFilter);
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
  }, [leads, clientFilter, skuFilter, precoBrutoFilter, margemBrutaFilter, filterStatus, originFilter, filterStartDate, filterEndDate, sortField, sortDir]);

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
    setBasePriceId(''); // Reset base price selection
    if (lead && !permissions?.canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }
    if (!lead && !permissions?.canAdd) {
      toast.error('Você não tem permissão para adicionar');
      return;
    }
    if (lead) {
      setEditingLead(lead);
      setModoMercado(lead.mercado === 'exportacao' ? 'exportacao' : 'nacional');
      setFormData({
        cliente: lead.cliente,
        sku: lead.sku,
        category: lead.category || '',
        subcategory: lead.subcategory || '',
        pricingId: lead.pricingId || '',
        precoLiquido: lead.precoLiquido,
        precoBruto: lead.precoBruto,
        precoBRL: lead.mercado === 'exportacao' ? (lead.precoBruto ?? '') : '',
        precoUSD: lead.precoUSD ?? '',
        ptax: lead.ptax ?? '',
        macoPct: lead.macoPct ?? '',
        margemBruta: lead.margemBruta,
        volume: lead.volume,
        status: lead.status || 'em_aberto',
        originType: lead.originType || ''
      });
    } else {
      setEditingLead(null);
      setModoMercado('nacional');
      setFormData({
        cliente: '',
        sku: '',
        category: '',
        subcategory: '',
        pricingId: '',
        precoLiquido: '',
        precoBruto: '',
        precoBRL: '',
        precoUSD: '',
        ptax: '',
        macoPct: '',
        margemBruta: '',
        volume: '',
        status: 'em_aberto',
        originType: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLead(null);
    setBasePriceId('');
    setModoMercado('nacional');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isEdit = Boolean(editingLead);
    if (isEdit && !permissions?.canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }
    if (!isEdit && !permissions?.canAdd) {
      toast.error('Você não tem permissão para adicionar');
      return;
    }

    // Validações específicas
    if (modoMercado === 'exportacao') {
      const brlNum = Number(String(formData.precoBRL || '').replace(',', '.'));
      const usdNum = Number(String(formData.precoUSD || '').replace(',', '.'));
      const ptaxNum = Number(String(formData.ptax || '').replace(',', '.'));
      if (!brlNum || brlNum <= 0 || !Number.isFinite(brlNum)) {
        toast.error('Preço BRL deve ser maior que 0.');
        return;
      }
      if (!usdNum || usdNum <= 0 || !Number.isFinite(usdNum)) {
        toast.error('Preço USD deve ser maior que 0.');
        return;
      }
      if (!ptaxNum || ptaxNum <= 0 || !Number.isFinite(ptaxNum)) {
        toast.error('PTAX deve ser maior que 0.');
        return;
      }
    }

    if (formData.originType === 'novo_sku' && !formData.cliente) {
      toast.error('Selecione um cliente (obrigatório para a origem Novos SKUs na base).');
      return;
    }

    const isEditSemMacoAnterior = isEdit && (editingLead?.macoPct === null || editingLead?.macoPct === undefined);
    const validacaoMaco = validarMacoPct(formData.macoPct, isEditSemMacoAnterior);
    if (!validacaoMaco.valido) {
      toast.error(validacaoMaco.erro);
      return;
    }

    setIsSubmitting(true);

    const payload = montarPayloadPreco({
      modo: modoMercado,
      cliente: formData.cliente,
      sku: formData.sku,
      category: formData.category,
      subcategory: formData.subcategory,
      pricingId: formData.pricingId,
      precoLiquido: formData.precoLiquido,
      precoBruto: formData.precoBruto,
      precoBRL: formData.precoBRL,
      precoUSD: formData.precoUSD,
      ptax: formData.ptax,
      margemBruta: formData.margemBruta,
      macoPct: formData.macoPct,
      volume: formData.volume,
      status: formData.status,
      originType: formData.originType,
    });

    const SELECT_COLUMNS = 'id, cliente, sku, category, subcategory, pricingid, precoliquido, precobruto, margembruta, maco_pct, volume, status, createdat, origin_type, origin_tag, mercado, preco_usd, ptax';
    const mapRow = (r) => ({
      id: r.id,
      cliente: r.cliente,
      sku: r.sku,
      category: r.category,
      subcategory: r.subcategory,
      pricingId: r.pricingid,
      precoLiquido: r.precoliquido,
      precoBruto: r.precobruto,
      margemBruta: r.margembruta,
      macoPct: r.maco_pct,
      volume: r.volume,
      status: r.status,
      createdAt: r.createdat,
      originType: r.origin_type || '',
      originTag: r.origin_tag || '',
      mercado: r.mercado || 'nacional',
      precoUSD: r.preco_usd,
      ptax: r.ptax,
    });

    const saveDb = {
      cliente: payload.cliente,
      sku: payload.sku,
      category: payload.category,
      subcategory: payload.subcategory,
      pricingid: payload.pricingid,
      precoliquido: payload.precoliquido,
      precobruto: payload.precobruto,
      margembruta: payload.margembruta,
      maco_pct: payload.maco_pct,
      volume: payload.volume,
      status: payload.status,
      origin_type: payload.origin_type,
      mercado: payload.mercado,
      preco_usd: payload.preco_usd,
      ptax: payload.ptax,
    };

    if (editingLead) {
      (async () => {
        const { data: updatedRows, error } = await supabase
          .from('prices')
          .update(saveDb)
          .eq('id', editingLead.id)
          .select(SELECT_COLUMNS);
        if (error) {
          toast.error('Falha ao atualizar');
        } else {
          const r = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
          const updated = mapRow(r);
          setLeads(leads.map(l => l.id === editingLead.id ? updated : l));
          toast.success('Lead atualizado');
        }
      })();
    } else {
      (async () => {
        const { data: insertedRows, error } = await supabase
          .from('prices')
          .insert([saveDb])
          .select(SELECT_COLUMNS);
        if (error) {
          toast.error('Falha ao adicionar');
        } else {
          const r = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
          const newLead = mapRow(r);
          setLeads([newLead, ...leads]);
          setShowMoney(true);
          setTimeout(() => setShowMoney(false), 3000);
          toast.success('Lead adicionado');
        }
      })();
    }

    closeModal();
    setIsSubmitting(false);
  };

  const handleRejectionSubmit = async () => {
    if (!permissions?.canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }
    if (!leadToReject || !rejectionReason) {
      toast.error('Selecione um motivo para a reprovação');
      return;
    }

    try {
      // 1. Atualizar status na tabela prices
      const { data: updatedRows, error: updateError } = await supabase
        .from('prices')
        .update({ status: 'reprovado' })
        .eq('id', leadToReject.id)
        .select('id, cliente, sku, category, subcategory, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat');

      if (updateError) throw updateError;

      // 2. Inserir na tabela price_rejections
      const { error: insertError } = await supabase
        .from('price_rejections')
        .insert({
          price_id: leadToReject.id,
          cliente: leadToReject.cliente,
          sku: leadToReject.sku,
          preco_bruto: leadToReject.precoBruto,
          margem_bruta: leadToReject.margemBruta,
          motivo: rejectionReason,
          user_id: user?.id
        });

      if (insertError) {
        console.error('Erro ao salvar motivo de reprovação:', insertError);
        // Não impede o fluxo, apenas loga
      }

      // 3. Atualizar estado local
      const r = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
      const updated = {
        id: r.id,
        cliente: r.cliente,
        sku: r.sku,
        category: r.category,
        subcategory: r.subcategory,
        pricingId: r.pricingid,
        precoLiquido: r.precoliquido,
        precoBruto: r.precobruto,
        margemBruta: r.margembruta,
        volume: r.volume,
        status: r.status,
        createdAt: r.createdat,
      };
      setLeads(leads.map(l => l.id === leadToReject.id ? updated : l));
      triggerDecisionEffect('rejected');
      toast.success('Lead reprovado');
      
      // 4. Limpar e fechar
      setIsRejectionModalOpen(false);
      setLeadToReject(null);
      setRejectionReason('');

    } catch (error) {
      console.error('Erro ao reprovar lead:', error);
      toast.error(`Falha ao reprovar lead: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleDelete = (id) => {
    if (!permissions?.canDelete) {
      toast.error('Você não tem permissão para excluir');
      return;
    }
    setLeadToDelete(id);
    setIsConfirmOpen(true);
  };

  const triggerDecisionEffect = (status) => {
    const tokens = status === 'approved'
      ? Array.from({ length: 28 }, (_, idx) => ({
          id: `${Date.now()}-${idx}`,
          left: Math.random() * 100,
          delay: Math.random() * 0.7,
          duration: 1.4 + Math.random() * 1.3,
          size: 14 + Math.random() * 18
        }))
      : [];
    const logoTokens = status === 'approved'
      ? Array.from({ length: 10 }, (_, idx) => ({
          id: `logo-${Date.now()}-${idx}`,
          left: Math.random() * 100,
          delay: Math.random() * 0.8,
          duration: 1.8 + Math.random() * 1.4,
          size: 22 + Math.random() * 24
        }))
      : [];
    setDecisionEffect({ visible: true, status, tokens, logoTokens });
    setTimeout(() => {
      setDecisionEffect({ visible: false, status: '', tokens: [], logoTokens: [] });
    }, status === 'approved' ? 2600 : 900);
  };

  const confirmDelete = () => {
    if (!permissions?.canDelete) {
      toast.error('Você não tem permissão para excluir');
      setIsConfirmOpen(false);
      return;
    }
    if (leadToDelete) {
      (async () => {
        const { error } = await supabase
          .from('prices')
          .delete()
          .eq('id', leadToDelete);
        if (error) {
          toast.error('Falha ao excluir');
        } else {
          setLeads(leads.filter(l => l.id !== leadToDelete));
          setLeadToDelete(null);
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

  const exportToExcel = async () => {
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
    await logExport('prices', dataToExport.length, {
      format: 'xlsx',
      file_name: 'pre-vendas.xlsx',
    });
  };

  const metricsByOrigin = useMemo(() => {
    const novosClientesRows = filteredLeads.filter(l => l.originType === 'novo_cliente');
    const novosSkusBaseRows = filteredLeads.filter(l => l.originType === 'novo_sku');

    const novosClientesProjetos = novosClientesRows.length;
    const novosSkusBaseProjetos = novosSkusBaseRows.length;
    const novosClientesUnicos = new Set(novosClientesRows.map(l => l.cliente).filter(Boolean)).size;
    const novosSkusBaseUnicos = new Set(novosSkusBaseRows.map(l => l.sku).filter(Boolean)).size;
    const relacaoProjetos = novosSkusBaseProjetos > 0
      ? (novosClientesProjetos / novosSkusBaseProjetos).toFixed(2)
      : '-';

    return {
      novosClientesProjetos,
      novosSkusBaseProjetos,
      novosClientesUnicos,
      novosSkusBaseUnicos,
      relacaoProjetos
    };
  }, [filteredLeads]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717] transition-colors duration-200">
      {/* Header */}
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle={title} 
        showBack={false} 
        logoRedirect="/select"
      />

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
      {decisionEffect.visible && (
        <div className="fixed inset-0 z-[70] pointer-events-none overflow-hidden">
          <div className={decisionEffect.status === 'approved' ? "absolute inset-0 bg-emerald-500/10" : "absolute inset-0 bg-red-500/10"} />
          {decisionEffect.status === 'approved' ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/logo-pronutrition-symbol.png"
                  alt="PRO Nutrition"
                  className="w-36 h-36 object-contain drop-shadow-2xl pro-logo-spotlight"
                />
              </div>
              {decisionEffect.tokens.map((token) => (
                <span
                  key={token.id}
                  className="absolute top-[-10%] text-emerald-400 font-bold pro-dollar-fall"
                  style={{
                    left: `${token.left}%`,
                    animationDelay: `${token.delay}s`,
                    animationDuration: `${token.duration}s`,
                    fontSize: `${token.size}px`
                  }}
                >
                  $
                </span>
              ))}
              {decisionEffect.logoTokens.map((token) => (
                <img
                  key={token.id}
                  src="/logo-pronutrition-symbol.png"
                  alt="PRO"
                  className="absolute top-[-10%] object-contain opacity-90 pro-logo-fall"
                  style={{
                    left: `${token.left}%`,
                    animationDelay: `${token.delay}s`,
                    animationDuration: `${token.duration}s`,
                    width: `${token.size}px`,
                    height: `${token.size}px`
                  }}
                />
              ))}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/90 text-white pro-reject-pop">
                  <XCircle className="w-5 h-5" />
                <span className="font-semibold">Simulação Reprovada</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="flex flex-col gap-3 mb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOriginFilter('novo_cliente')}
                className="inline-flex items-center justify-center gap-2 px-3 h-11 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors transition-transform hover:scale-105 active:scale-95 text-white"
                style={{ backgroundColor: 'var(--color-success)' }}
                title="Filtrar: Novos clientes"
              >
                <CheckCircle size={16} />
                <span className="leading-none whitespace-nowrap">Novos clientes</span>
              </button>
              <button
                type="button"
                onClick={() => setOriginFilter('novo_sku')}
                className="inline-flex items-center justify-center gap-2 px-3 h-11 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors transition-transform hover:scale-105 active:scale-95 text-white"
                style={{ backgroundColor: 'var(--color-info)' }}
                title="Filtrar: Novos SKUs dentro da base"
              >
                <Package size={16} />
                <span className="leading-none whitespace-nowrap">Novos SKUs na base</span>
              </button>
              <button
                type="button"
                onClick={() => setOriginFilter('')}
                className="inline-flex items-center justify-center gap-2 px-3 h-11 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors transition-transform hover:scale-105 active:scale-95 text-white min-w-[110px]"
                style={{ backgroundColor: 'var(--color-primary)' }}
                title="Mostrar todos"
              >
                <BarChart3 size={16} />
                <span className="leading-none whitespace-nowrap">Todos</span>
              </button>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={() => setShowMoreMetrics(!showMoreMetrics)}
                className="inline-flex items-center gap-2 px-3 h-11 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                <Activity size={16} />
                {showMoreMetrics ? 'Menos métricas' : 'Mais métricas'}
              </button>
            </div>
          </div>
        </div>

        {showMoreMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total de Clientes Únicos
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  {new Set(filteredLeads.map(l => l.cliente)).size}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <BarChart3 size={20} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ROB Estimado
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  R$ {(filteredLeads.reduce((acc, lead) => acc + (lead.precoBruto * lead.volume), 0) / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500">
                <DollarSign size={20} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Taxa de Assertividade
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  {(() => {
                    const aprovados = filteredLeads.filter(l => l.status === 'aprovado').length;
                    const reprovados = filteredLeads.filter(l => l.status === 'reprovado').length;
                    const base = aprovados + reprovados;
                    return base > 0 ? Math.round((aprovados / base) * 100) : 0;
                  })()}%
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Novos clientes (projetos)
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  {metricsByOrigin.novosClientesProjetos}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {metricsByOrigin.novosClientesUnicos} clientes únicos
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle size={20} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Novos SKUs base (projetos)
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  {metricsByOrigin.novosSkusBaseProjetos}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {metricsByOrigin.novosSkusBaseUnicos} SKUs únicos
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
                <Package size={20} />
              </div>
            </div>
          </div>

          <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Relação novos clientes/SKUs base
                </p>
                <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                  {metricsByOrigin.relacaoProjetos}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                <Activity size={20} />
              </div>
            </div>
          </div>
        </div>
        )}

        {showMoreMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Leads Aprovados
                  </p>
                  <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                    R$ {( 
                      filteredLeads
                        .filter(l => l.status === 'aprovado')
                        .reduce((acc, l) => acc + (l.precoBruto * l.volume * (l.margemBruta / 100)), 0) / 1000
                    ).toFixed(1)}k
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500">
                  <DollarSign size={20} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    MB Média
                  </p>
                  <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                    {filteredLeads.length > 0 
                      ? (filteredLeads.reduce((acc, lead) => acc + lead.margemBruta, 0) / filteredLeads.length).toFixed(1)
                      : '0'}%
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <TrendingUp size={20} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ROL Estimado
                  </p>
                  <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                    R$ {(filteredLeads.reduce((acc, lead) => acc + (lead.precoLiquido * lead.volume), 0) / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500">
                  <DollarSign size={20} />
                </div>
              </div>
            </div>

            <div className="card-pronutrition hover-lift p-4 dark:bg-[#0a0a0a] dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Volume Total
                  </p>
                  <p className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
                    {filteredLeads.reduce((acc, lead) => acc + lead.volume, 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-green-500/10 text-green-500">
                  <Package size={20} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="card-pronutrition mb-6 p-6 dark:bg-[#0a0a0a] dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Filters */}
            <div className="flex-1">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                <SearchableSelect
                  options={clientOptions}
                  value={clientFilter}
                  onChange={(val) => {
                    setClientFilter(val);
                    setSkuFilter(''); // Reset SKU when client changes
                  }}
                  placeholder="Filtrar por Cliente"
                  searchPlaceholder="Buscar cliente..."
                />
                <SearchableSelect
                  options={skuOptions}
                  value={skuFilter}
                  onChange={setSkuFilter}
                  placeholder="Filtrar por SKU"
                  searchPlaceholder="Buscar SKU..."
                />
                <input
                  type="number"
                  placeholder="Preço Bruto"
                  value={precoBrutoFilter}
                  onChange={(e) => setPrecoBrutoFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <input
                  type="number"
                  placeholder="Margem %"
                  value={margemBrutaFilter}
                  onChange={(e) => setMargemBrutaFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="relative flex items-center space-x-2">
              {permissions.canAdd && (
                <button
                  onClick={() => openModal()}
                  className="btn-primary flex items-center space-x-2 transition-transform hover:scale-105 active:scale-95"
                >
                  <Plus size={20} />
                  <span>Novo Preço</span>
                </button>
              )}
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 hover:bg-gray-100 dark:hover:bg-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                title="Filtros"
              >
                <Filter size={18} style={{ transition: 'transform 0.2s ease', transform: isFilterOpen ? 'rotate(90deg) scale(1.05)' : 'rotate(0deg)' }} />
              </button>
              <button
                onClick={exportToExcel}
                className="px-3 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 hover:bg-gray-100 dark:hover:bg-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                title="Exportar CSV"
              >
                <Download size={18} />
              </button>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                  <div className="card-pronutrition absolute right-0 top-12 w-80 text-xs p-5 z-50 dark:bg-[#0a0a0a] dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="label-pronutrition text-xs">Status</label>
                      <select
                        className="input-pronutrition text-xs p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
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
                      <label className="label-pronutrition text-xs">Data início</label>
                      <input
                        type="date"
                        className="input-pronutrition text-xs p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs">Data fim</label>
                      <input
                        type="date"
                        className="input-pronutrition text-xs p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-pronutrition text-xs">Ordenar por</label>
                      <select
                        className="input-pronutrition text-xs p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
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
                      <label className="label-pronutrition text-xs">Direção</label>
                      <select
                        className="input-pronutrition text-xs p-2 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100"
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
                      className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                      onClick={() => {
                        setFilterStatus('');
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setSortField('');
                        setSortDir('');
                      }}
                    >
                      Limpar Filtros
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card-pronutrition dark:bg-[#0a0a0a] dark:border-gray-800 overflow-hidden p-0">
          {initialLoading && (
            <div className="px-6 py-4">
              <p className="text-gray-500 dark:text-gray-400">Carregando dados...</p>
            </div>
          )}
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full text-[13px]">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-[18%]">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-[40%]">
                    SKU
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 w-[10%] whitespace-nowrap">
                    Precificação
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    Preço Líquido
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    Preço Bruto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    MACO %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                    MB (%)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Volume
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-[150px]">
                    Data
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 w-[160px]">
                    Edição
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">
                        {(clientFilter || skuFilter) ? 'Nenhum resultado encontrado' : 'Nenhum preço cadastrado ainda'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr 
                      key={lead.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-[13px] text-gray-900 dark:text-gray-100 break-words w-[18%] leading-snug">
                        {lead.cliente}
                      </td>
                      <td className="px-4 py-3 w-[40%]">
                        <span className="px-2.5 py-1 rounded-lg text-[13px] font-medium leading-snug bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 break-words inline-block">
                          {lead.sku}
                        </span>
                      </td>
                      <td className="px-3 py-3 w-[10%] text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          {lead.pricingId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {lead.mercado === 'exportacao' ? (
                          <span>R$ {Number(lead.precoLiquido ?? 0).toFixed(2)}</span>
                        ) : (
                          <span>R$ {Number(lead.precoLiquido ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {lead.mercado === 'exportacao' ? (
                          <span>US$ {Number(lead.precoUSD ?? 0).toFixed(2)}</span>
                        ) : (
                          <span>R$ {Number(lead.precoBruto ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {lead.macoPct === null || lead.macoPct === undefined || lead.macoPct === '' ? (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ 
                                  backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                  color: 'var(--color-muted-foreground, inherit)'
                                }}>
                            {Number(lead.macoPct).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
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
                      <td className="px-4 py-3 text-right text-[13px] text-gray-500 dark:text-gray-400">
                        {lead.volume.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-left">
                        {(() => {
                          const s = lead.status || 'em_aberto';
                          const label = s === 'aprovado' ? 'Aprovado' : s === 'reprovado' ? 'Reprovado' : 'Em aberto';
                          const color = s === 'aprovado' ? 'var(--color-success)' : s === 'reprovado' ? 'var(--color-danger)' : 'var(--color-info)';
                          const bg = s === 'aprovado' ? 'rgba(100, 208, 32, 0.15)' : s === 'reprovado' ? 'rgba(255, 86, 86, 0.15)' : 'rgba(26, 198, 252, 0.15)';
                          return (
                            <span className="px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: bg, color }}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-left text-gray-500 dark:text-gray-400">
                        {format(new Date(lead.createdAt), 'MMM/yy', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 text-left">
                        {(() => {
                          const days = differenceInDays(new Date(), new Date(lead.createdAt));
                          const isDelayed = days > 3; // Regra de exemplo: alerta após 3 dias
                          return (
                            <div className="flex items-center gap-2" title={`${days} dias neste status`}>
                              <Clock size={16} className={isDelayed ? "text-orange-500" : "text-gray-400"} />
                              <span className={`text-sm font-medium ${isDelayed ? "text-orange-600" : "text-gray-600"}`}>
                                {days} dias
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 w-[180px]">
                        <div className="relative flex items-center justify-center gap-2 w-full px-2">
                          {permissions.canEdit && (
                            <button
                              onClick={() => openModal(lead)}
                              className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-blue-500"
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
                                  let top = rect.bottom + 8;
                                  if (top + menuHeight > window.innerHeight) {
                                    top = rect.top - menuHeight - 8;
                                  }
                                  let left = rect.right - menuWidth;
                                  const maxLeft = window.innerWidth - menuWidth - 8;
                                  left = Math.min(Math.max(8, left), maxLeft);
                                  setStatusMenuPos({ top, left });
                                }
                                setStatusMenuOpen(nextOpen);
                              }}
                              className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-green-500"
                              title="Alterar Status"
                            >
                              <DollarSign size={18} />
                            </button>
                          )}
                          {statusMenuOpen === lead.id && (
                            <>
                              <div className="fixed inset-0 z-[100]" onClick={() => setStatusMenuOpen(null)}></div>
                              <div 
                                className="fixed z-[101] w-64 p-3 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200" 
                                style={{ top: statusMenuPos?.top, left: statusMenuPos?.left }} 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400 px-2">Definir status</p>
                                {[
                                  { key: 'em_aberto', label: 'Em aberto', color: 'text-blue-600 dark:text-blue-400', bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20', icon: Clock },
                                  { key: 'aprovado', label: 'Aprovado', color: 'text-green-600 dark:text-green-400', bgHover: 'hover:bg-green-50 dark:hover:bg-green-900/20', icon: CheckCircle },
                                  { key: 'reprovado', label: 'Reprovado', color: 'text-red-600 dark:text-red-400', bgHover: 'hover:bg-red-50 dark:hover:bg-red-900/20', icon: XCircle },
                                ].map(opt => (
                                  <button
                                    key={opt.key}
                                    className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg ${opt.bgHover} transition-all duration-200 group`}
                                    onClick={() => {
                                      if (opt.key === 'reprovado') {
                                        setStatusMenuOpen(null);
                                        setLeadToReject(lead);
                                        setIsRejectionModalOpen(true);
                                      } else {
                                        (async () => {
                                          const { data: updatedRows, error } = await supabase
                                            .from('prices')
                                            .update({ status: opt.key })
                                            .eq('id', lead.id)
                                            .select('id, cliente, sku, category, subcategory, pricingid, precoliquido, precobruto, margembruta, volume, status, createdat');
                                          if (error) {
                                            setStatusMenuOpen(null);
                                            toast.error(`Falha ao atualizar status: ${error.message}`);
                                          } else {
                                            const r = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
                                            const updated = {
                                              id: r.id,
                                              cliente: r.cliente,
                                              sku: r.sku,
                                              category: r.category,
                                              subcategory: r.subcategory,
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
                                              triggerDecisionEffect('approved');
                                            }
                                            setStatusMenuOpen(null);
                                            toast.success('Status atualizado');
                                          }
                                        })();
                                      }
                                    }}
                                  >
                                    <opt.icon size={18} className={`${opt.color} group-hover:scale-110 transition-transform`} />
                                    <span className={`text-sm font-medium ${opt.color}`}>{opt.label}</span>
                                    {lead.status === opt.key && <Check size={16} className="ml-auto text-gray-400" />}
                                  </button>
                                ))}
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

      {/* Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsConfirmOpen(false)}>
          <div className="card-pronutrition max-w-md w-full fade-in dark:bg-[#171717] dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Confirmar exclusão
              </h3>
              <button onClick={() => setIsConfirmOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Tem certeza que deseja excluir este preço?
            </p>
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={() => setIsConfirmOpen(false)} className="px-6 py-3 rounded-lg font-semibold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
             onClick={closeModal}>
          <div className="card-pronutrition max-w-2xl w-full fade-in dark:bg-[#171717] dark:border dark:border-gray-800 max-h-[85vh] flex flex-col overflow-hidden"
               style={{ padding: 0 }}
               onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-800 shrink-0 bg-white dark:bg-[#171717]">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingLead ? 'Editar Preço' : 'Novo Preço'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingLead && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Upload size={16} className="text-gray-500" />
                      Usar preço existente como base
                    </label>
                    <SearchableSelect
                      options={basePriceOptions}
                      value={basePriceId}
                      onChange={handleBasePriceChange}
                      placeholder="Selecione um preço para copiar..."
                      searchPlaceholder="Buscar por SKU, cliente..."
                    />
                  </div>
                )}

                {/* Modo Mercado */}
                <div>
                  <label className="label-pronutrition dark:text-gray-300">
                    Mercado
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModoMercado('nacional')}
                      className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        modoMercado === 'nacional'
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white dark:bg-[#0a0a0a] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      Nacional
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoMercado('exportacao')}
                      className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        modoMercado === 'exportacao'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white dark:bg-[#0a0a0a] text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      Exportação
                    </button>
                  </div>
                </div>

                {/* Cliente */}
                <div>
                  <label htmlFor="cliente" className="label-pronutrition dark:text-gray-300">
                    Nome do Cliente
                  </label>
                  {formData.originType === 'novo_sku' ? (
                    <SearchableSelect
                      options={clientBaseOptions}
                      value={formData.cliente}
                      onChange={(val) => setFormData(prev => ({ ...prev, cliente: val ?? '' }))}
                      placeholder="Selecione um cliente da base..."
                      searchPlaceholder="Buscar cliente..."
                      className="dark:bg-[#0a0a0a]"
                    />
                  ) : (
                    <input
                      id="cliente"
                      name="cliente"
                      type="text"
                      required
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                      style={{ padding: '0.75rem' }}
                      placeholder="Ex: Farmácia São Paulo LTDA"
                      value={formData.cliente}
                      onChange={handleChange}
                    />
                  )}
                </div>

                {/* SKU */}
                <div>
                  <label htmlFor="sku" className="label-pronutrition dark:text-gray-300">
                    SKU
                  </label>
                  <input
                    id="sku"
                    name="sku"
                    type="text"
                    required
                    className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                    style={{ padding: '0.75rem' }}
                    placeholder="Ex: PRO-WHEY-1KG"
                    value={formData.sku}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-pronutrition dark:text-gray-300">
                      Origem do Projeto
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, originType: 'novo_cliente' }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                          formData.originType === 'novo_cliente'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-[#0a0a0a] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        Novos clientes
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, originType: 'novo_sku' }))}
                        className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                          formData.originType === 'novo_sku'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-[#0a0a0a] text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                        }`}
                      >
                        Novos SKUs base
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categoria */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="label-pronutrition dark:text-gray-300">
                      Categoria
                    </label>
                    <select
                      id="category"
                      name="category"
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                      style={{ padding: '0.75rem' }}
                      value={formData.category}
                      onChange={handleChange}
                    >
                      <option value="">Selecione...</option>
                      {CATEGORY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="subcategory" className="label-pronutrition dark:text-gray-300">
                      Subcategoria
                    </label>
                    <select
                      id="subcategory"
                      name="subcategory"
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                      style={{ padding: '0.75rem' }}
                      value={formData.subcategory}
                      onChange={handleChange}
                    >
                      <option value="">Selecione...</option>
                      {SUBCATEGORY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="pricingId" className="label-pronutrition dark:text-gray-300">
                    ID da Precificação
                  </label>
                  <input
                    id="pricingId"
                    name="pricingId"
                    type="text"
                    required
                    className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                    style={{ padding: '0.75rem' }}
                    placeholder="Ex: PRC-2025-0001"
                    value={formData.pricingId}
                    onChange={handleChange}
                  />
                </div>

                {/* Preços por modo */}
                {modoMercado === 'nacional' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="precoLiquido" className="label-pronutrition dark:text-gray-300">
                        Preço Líquido (R$)
                      </label>
                      <input
                        id="precoLiquido"
                        name="precoLiquido"
                        type="number"
                        step="0.01"
                        required
                        className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                        style={{ padding: '0.75rem' }}
                        placeholder="89.90"
                        value={formData.precoLiquido}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="precoBruto" className="label-pronutrition dark:text-gray-300">
                        Preço Bruto (R$)
                      </label>
                      <input
                        id="precoBruto"
                        name="precoBruto"
                        type="number"
                        step="0.01"
                        required
                        className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                        style={{ padding: '0.75rem' }}
                        placeholder="129.90"
                        value={formData.precoBruto}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="precoBRL" className="label-pronutrition dark:text-gray-300">
                        Preço BRL
                      </label>
                      <input
                        id="precoBRL"
                        name="precoBRL"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                        style={{ padding: '0.75rem' }}
                        placeholder="100.00"
                        value={formData.precoBRL}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="precoUSD" className="label-pronutrition dark:text-gray-300">
                        Preço USD
                      </label>
                      <input
                        id="precoUSD"
                        name="precoUSD"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                        style={{ padding: '0.75rem' }}
                        placeholder="20.00"
                        value={formData.precoUSD}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label htmlFor="ptax" className="label-pronutrition dark:text-gray-300">
                        PTAX
                      </label>
                      <input
                        id="ptax"
                        name="ptax"
                        type="number"
                        step="0.0001"
                        min="0"
                        required
                        className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                        style={{ padding: '0.75rem' }}
                        placeholder="5.0000"
                        value={formData.ptax}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                )}

                {/* MACO% e MB% (lado a lado); MACO vem antes de MB */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="macoPct" className="label-pronutrition dark:text-gray-300">
                      MACO %
                    </label>
                    <input
                      id="macoPct"
                      name="macoPct"
                      type="number"
                      step="0.1"
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                      style={{ padding: '0.75rem' }}
                      placeholder="12.5"
                      value={formData.macoPct}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label htmlFor="margemBruta" className="label-pronutrition dark:text-gray-300">
                      Margem Bruta (%)
                    </label>
                    <input
                      id="margemBruta"
                      name="margemBruta"
                      type="number"
                      step="0.1"
                      required
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
                      style={{ padding: '0.75rem' }}
                      placeholder="30.8"
                      value={formData.margemBruta}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Volume (lado a lado com nada, full width para alinhar, mas pode ser 2 colunas para manter grid) */}
                <div className="grid grid-cols-2 gap-4">
                  <div></div>
                  <div>
                    <label htmlFor="volume" className="label-pronutrition dark:text-gray-300">
                      Volume
                    </label>
                    <input
                      id="volume"
                      name="volume"
                      type="number"
                      required
                      className="input-pronutrition dark:bg-[#0a0a0a] dark:border-gray-700 dark:text-white"
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
                    className="px-6 py-3 rounded-lg font-semibold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
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
        </div>
      )}
      {isRejectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setIsRejectionModalOpen(false)}>
          <div className="card-pronutrition max-w-md w-full fade-in dark:bg-[#171717] dark:border dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Reprovar Preço
              </h3>
              <button onClick={() => setIsRejectionModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Selecione o motivo da reprovação para o SKU <strong>{leadToReject?.sku}</strong>
            </p>
            
            <div className="space-y-3">
              {['Fora do target', 'Desistência do projeto', 'Seguiu com concorrente', 'Retrabalho/reprecificação'].map(reason => (
                <label key={reason} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="rejectionReason"
                    value={reason}
                    checked={rejectionReason === reason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className="text-gray-700 dark:text-gray-200">{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <button 
                type="button" 
                onClick={() => setIsRejectionModalOpen(false)} 
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleRejectionSubmit} 
                className="px-4 py-2 rounded-lg font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white shadow-sm"
                disabled={!rejectionReason}
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes proLogoSpotlight {
          0% { transform: scale(0.62); opacity: 0; filter: brightness(1); }
          18% { transform: scale(1.06); opacity: 1; filter: brightness(1.1); }
          76% { transform: scale(1); opacity: 1; filter: brightness(1); }
          100% { transform: scale(0.9); opacity: 0; filter: brightness(0.95); }
        }
        @keyframes proDollarFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(120vh) rotate(360deg); opacity: 0; }
        }
        @keyframes proLogoFall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(0.75); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateY(120vh) rotate(320deg) scale(1); opacity: 0; }
        }
        @keyframes proRejectPop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pro-logo-spotlight { animation: proLogoSpotlight 2.4s ease-in-out forwards; }
        .pro-dollar-fall { animation-name: proDollarFall; animation-timing-function: linear; animation-fill-mode: forwards; }
        .pro-logo-fall { animation-name: proLogoFall; animation-timing-function: linear; animation-fill-mode: forwards; }
        .pro-reject-pop { animation: proRejectPop 220ms ease-out; }
      `}</style>
    </div>
  );
};

export default Dashboard;
