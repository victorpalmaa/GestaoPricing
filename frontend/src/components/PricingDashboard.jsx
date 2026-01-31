import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { Plus, Download, Upload, TrendingUp, DollarSign, Users, Package, Settings, BarChart3, LogOut, ArrowLeft, Edit2, Trash2, Briefcase, Filter, Search, Check, ChevronsUpDown, X, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import ClientAliasManager from './ClientAliasManager';
import Header from './Header';
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import SearchableSelect from './SearchableSelect';

const PricingDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [pricingData, setPricingData] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    client: '',
    sku: '',
    category: '',
    subcategory: '',
    size: '',
    dateFrom: '',
    dateTo: '',
    datasulCode: ''
  });
  const [showNewPriceModal, setShowNewPriceModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [newPriceForm, setNewPriceForm] = useState({
    client_id: '',
    sku: '',
    net_price: '',
    gross_price: '',
    margin_budget: '',
    size: '',
    manager: '',
    code: '',
    category: '',
    subcategory: '',
    month: '',
    date: new Date().toISOString().split('T')[0],
    obs: ''
  });
  const [showAliasManager, setShowAliasManager] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const CATEGORY_OPTIONS = ['Pó', 'Cápsula', 'Gel', 'Pastilha'];
  const SUBCATEGORY_OPTIONS = ['Creatina', 'Colágeno', 'Glutamina', 'Proteína', 'Gel', 'Cápsula', 'Pastilha', 'Outros'];

  const userArea = user?.area || user?.user_metadata?.area;
  const isSuper = userArea === 'Pricing';
  const canEdit = isSuper || userArea === 'Pricing';

  // Garantir que os dados estejam inicializados corretamente
  const safePricingData = pricingData || [];
  const safeClients = clients || [];

  // Opções para os selects
  const clientOptions = useMemo(() => {
    return safeClients.map(c => ({ label: c.name, value: c.id }));
  }, [safeClients]);

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(safePricingData.map(item => item.category).filter(Boolean))].sort();
    return categories.map(c => ({ label: c, value: c }));
  }, [safePricingData]);

  const subcategoryOptions = useMemo(() => {
    let data = safePricingData;
    if (filters.category) {
      data = data.filter(item => item.category === filters.category);
    }
    const subcategories = [...new Set(data.map(item => item.subcategory).filter(Boolean))].sort();
    return subcategories.map(s => ({ label: s, value: s }));
  }, [safePricingData, filters.category]);

  const sizeOptions = useMemo(() => {
    const sizes = [...new Set(safePricingData.map(item => item.size).filter(Boolean))].sort();
    return sizes.map(s => ({ label: s, value: s }));
  }, [safePricingData]);

  const skuOptions = useMemo(() => {
    // Filtrar dados baseados no cliente selecionado, se houver
    let data = safePricingData;
    if (filters.client) {
      data = data.filter(item => item.client_id === filters.client);
    }
    if (filters.category) {
      data = data.filter(item => item.category === filters.category);
    }
    if (filters.subcategory) {
      data = data.filter(item => item.subcategory === filters.subcategory);
    }
    if (filters.size) {
      data = data.filter(item => item.size === filters.size);
    }
    // Extrair SKUs únicos dos dados filtrados
    const uniqueSKUs = [...new Set(data.map(item => item.sku))].sort();
    return uniqueSKUs.map(sku => ({ label: sku, value: sku }));
  }, [safePricingData, filters.client, filters.category, filters.subcategory, filters.size]);

  useEffect(() => {
    loadData();
  }, [filters.dateFrom, filters.dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Carregar histórico de preços com joins e filtro de data
      let query = supabase
        .from('pricing_history')
        .select(`
          *,
          clients!inner(name)
        `)
        .order('date', { ascending: false });

      // Aplicar filtros de data no servidor
      if (filters.dateFrom) {
        query = query.gte('date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('date', filters.dateTo);
      }

      const { data: pricingDataRaw, error: pricingError } = await query;

      if (pricingError) throw pricingError;

      // Calcular vigência (mais recente por Cliente + SKU)
      const latestMap = new Map();
      (pricingDataRaw || []).forEach(item => {
        const key = `${item.client_id}-${item.sku}`;
        const existingDate = latestMap.get(key);
        if (!existingDate || new Date(item.date) > new Date(existingDate)) {
          latestMap.set(key, item.date);
        }
      });

      const enrichedData = (pricingDataRaw || []).map(item => ({
        ...item,
        isCurrent: item.date === latestMap.get(`${item.client_id}-${item.sku}`)
      }));

      setPricingData(enrichedData);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      // Se for filtro de data, apenas atualiza
      if (field === 'dateFrom' || field === 'dateTo') {
        return { ...prev, [field]: value };
      }

      // Lógica de limpeza dependente
      const newFilters = { ...prev, [field]: value };

      // Se mudou o cliente, limpa o SKU (pois o SKU pode não pertencer ao novo cliente)
      if (field === 'client') {
        newFilters.sku = '';
      }

      // Se mudou a categoria, limpa a subcategoria
      if (field === 'category') {
        newFilters.subcategory = '';
      }

      // Nota: Ao mudar SKU ou Subcategoria, NÃO limpamos os filtros "pais" (Cliente ou Categoria)
      // pois a seleção deve ser refinada, não resetada.
      
      return newFilters;
    });
  };

  const filteredData = safePricingData.filter(item => {
    const matchesClient = !filters.client || item.client_id === filters.client;
    const matchesSku = !filters.sku || item.sku === filters.sku;
    const matchesCategory = !filters.category || item.category === filters.category;
    const matchesSubcategory = !filters.subcategory || item.subcategory === filters.subcategory;
    const matchesSize = !filters.size || item.size === filters.size;
    const matchesDatasul = !filters.datasulCode || (item.code && item.code.includes(filters.datasulCode));
    const matchesDateFrom = !filters.dateFrom || new Date(item.date) >= new Date(filters.dateFrom);
    const matchesDateTo = !filters.dateTo || new Date(item.date) <= new Date(filters.dateTo);
    
    return matchesClient && matchesSku && matchesCategory && matchesSubcategory && matchesSize && matchesDatasul && matchesDateFrom && matchesDateTo;
  });

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredData.map(item => ({
        'Cliente': item.clients?.name || '',
        'Tamanho': item.size || '',
        'Gestora': item.manager || '',
        'Código': item.code || '',
        'SKU': item.sku,
        'Preço liquido': item.net_price,
        'Preço bruto': item.gross_price || '',
        'Moeda': item.currency || 'BRL',
        'Margem (Orçada)': item.margin_budget ? `${item.margin_budget}%` : '',
        'Mês': item.month || '',
        'Categoria': item.category || '',
        'Subcategoria': item.subcategory || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pricing Data");
      XLSX.writeFile(wb, "pricing_data.xlsx");
      toast.success('Exportação concluída com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar Excel');
    }
  };



  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportExcel = async () => {
    if (!importFile) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          // cellDates: true força o Excel a converter células de data para objetos Date nativos do JS
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Normalizar headers (chaves) para minúsculas e sem acentos/espaços extras para facilitar comparação
          const normalizeKey = (key) => key.toString().trim().toLowerCase();
          
          // Função auxiliar para parsear números (aceita formato BR 1.234,56 ou US 1234.56)
          const parseNumber = (value) => {
            if (typeof value === 'number') return value;
            if (!value) return 0;
            let str = value.toString().trim();
            // Remover R$, $, espaços
            str = str.replace(/[R$\s]/g, '');
            // Se tiver vírgula e ponto, assume formato BR (1.000,00) -> remove ponto, troca vírgula por ponto
            if (str.includes(',') && str.includes('.')) {
              return parseFloat(str.replace(/\./g, '').replace(',', '.'));
            }
            // Se só tiver vírgula, troca por ponto (1000,00 -> 1000.00)
            if (str.includes(',')) {
              return parseFloat(str.replace(',', '.'));
            }
            return parseFloat(str);
          };

          const normalizedData = jsonData.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
              // Mapeamento flexível de colunas
              const normKey = normalizeKey(key);
              if (normKey.includes('cliente')) newRow['client'] = row[key];
              else if (normKey.includes('sku')) newRow['sku'] = row[key];
              else if (normKey.includes('preço liquido') || normKey.includes('preco liquido') || normKey === 'net_price') newRow['net_price'] = row[key];
              else if (normKey.includes('preço bruto') || normKey.includes('preco bruto') || normKey === 'gross_price') newRow['gross_price'] = row[key];
              else if (normKey.includes('moeda')) newRow['currency'] = row[key];
              else if (normKey.includes('margem')) newRow['margin_budget'] = row[key];
              else if (normKey.includes('mês') || normKey.includes('mes')) newRow['month'] = row[key];
              else if (normKey.includes('data')) newRow['date'] = row[key];
              else if (normKey.includes('tamanho')) newRow['size'] = row[key];
              else if (normKey.includes('gestora')) newRow['manager'] = row[key];
              else if (normKey.includes('código') || normKey.includes('codigo')) newRow['code'] = row[key];
              else if (normKey.includes('categoria')) newRow['category'] = row[key];
              else if (normKey.includes('subcategoria')) newRow['subcategory'] = row[key];
              else if (normKey.includes('observações') || normKey.includes('observacoes') || normKey.includes('obs')) newRow['obs'] = row[key];
            });
            return newRow;
          });

          // Validar colunas necessárias
          const firstRow = normalizedData[0];
          if (!firstRow) {
            toast.error('O arquivo parece estar vazio.');
            return;
          }

          // Verificar se campos obrigatórios existem na primeira linha mapeada
          const missingFields = [];
          if (!('client' in firstRow)) missingFields.push('Cliente');
          if (!('sku' in firstRow)) missingFields.push('SKU');
          if (!('net_price' in firstRow)) missingFields.push('Preço Liquido');
          // Mês ou Data deve existir
          if (!('month' in firstRow) && !('date' in firstRow)) missingFields.push('Mês ou Data');

          if (missingFields.length > 0) {
            toast.error(`Colunas obrigatórias não identificadas: ${missingFields.join(', ')}. Verifique os nomes das colunas.`);
            return;
          }

          // Processar dados
          const processedData = [];
          let successCount = 0;
          let errorCount = 0;

          // Carregar cache de clientes e aliases para evitar N+1 queries
          const { data: allAliases } = await supabase.from('client_aliases').select('alias_name, client_id');
          const { data: allClients } = await supabase.from('clients').select('id, name');
          
          const aliasMap = new Map(allAliases?.map(a => [a.alias_name.toLowerCase(), a.client_id]));
          const clientMap = new Map(allClients?.map(c => [c.name.toLowerCase(), c.id]));

          for (const row of normalizedData) {
            // Normalizar nome do cliente
            const clientNameRaw = row['client']?.toString().trim();
            if (!clientNameRaw) continue;
            const clientNameLower = clientNameRaw.toLowerCase();

            // Validar SKU
            const sku = row['sku']?.toString().trim();
            if (!sku) {
              errorCount++;
              continue;
            }

            // Validar valores numéricos com parser robusto
            const netPrice = parseNumber(row['net_price']);
            const grossPrice = parseNumber(row['gross_price']);
            let marginBudget = parseNumber(row['margin_budget']);
            
            // Correção automática para porcentagens vindas do Excel
            // Se o valor for menor ou igual a 1 (ex: 0.3), assume que é decimal e multiplica por 100 para virar 30(%)
            // Exceto se for exatamente 0 ou negativo (pode ser margem zero ou negativa, mas 0.3 é claramente 30%)
            // Se o usuário digitou 30 no Excel, vem 30. Se digitou 30%, vem 0.3.
            if (marginBudget !== null && !isNaN(marginBudget)) {
               if (Math.abs(marginBudget) <= 1 && marginBudget !== 0) {
                 marginBudget = marginBudget * 100;
               }
            }
            
            if (isNaN(netPrice) || netPrice <= 0) {
              console.warn(`Preço inválido para ${clientNameRaw} - ${sku}: ${row['net_price']}`);
              errorCount++;
              continue;
            }
            
            // Validar/Gerar data
            let date = new Date();
            const monthVal = row['month'];
            let monthStr = null; // Declare monthStr variable to fix ReferenceError
            
            // Se monthVal já for um objeto Date (graças ao cellDates: true)
            if (monthVal instanceof Date && !isNaN(monthVal)) {
               date = monthVal;
               // Opcional: tentar formatar monthStr a partir da data para salvar no banco
               // monthStr = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            } 
            else if (typeof monthVal === 'string') {
               monthStr = monthVal.trim();
               if (monthStr) {
                 const months = {
                   'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                   'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11,
                   'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
                   'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
                 };
                 
                 const parts = monthStr.toLowerCase().split(/[-/ .]/);
                 if (parts.length >= 2) {
                   const monthPart = parts[0].substring(0, 3); // pegar 3 primeiras letras
                   let monthIndex = -1;
                   Object.keys(months).forEach(m => {
                      if (monthPart.includes(m)) monthIndex = months[m];
                   });
  
                   const yearPart = parts[1];
                   let year = parseInt(yearPart.replace(/\D/g, '')); // remover não-números
                   if (year < 100) year += 2000;
                   
                   if (monthIndex !== -1 && !isNaN(year)) {
                     date = new Date(year, monthIndex, 1);
                   }
                 }
               }
            } else if (row['date']) {
               // Fallback para coluna Date se Mês falhar ou não existir
               if (row['date'] instanceof Date && !isNaN(row['date'])) {
                  date = row['date'];
               } else if (typeof row['date'] === 'number') {
                  // Excel date serial conversion (caso cellDates não tenha pego)
                  date = new Date(Math.round((row['date'] - 25569) * 86400 * 1000));
               } else {
                  const parsedDate = new Date(row['date']);
                  if (!isNaN(parsedDate.getTime())) {
                    date = parsedDate;
                  }
               }
            }

            // Normalizar Moeda
            let currency = 'BRL';
            const currencyStr = row['currency']?.toString().trim().toUpperCase();
            if (currencyStr && (currencyStr.includes('DÓLAR') || currencyStr.includes('DOLAR') || currencyStr.includes('USD') || currencyStr.includes('$'))) {
              currency = 'USD';
            }

            // Resolver Client ID usando mapas em memória
            let clientId = aliasMap.get(clientNameLower);
            
            if (!clientId) {
              clientId = clientMap.get(clientNameLower);
              
              if (!clientId) {
                // Criar novo cliente se não existir (opcional, pode ser perigoso se for erro de digitação)
                // Aqui mantemos o comportamento original de criar
                try {
                    const { data: newClient, error: createError } = await supabase
                      .from('clients')
                      .insert({ name: clientNameRaw })
                      .select('id')
                      .single();
                    
                    if (!createError && newClient) {
                        clientId = newClient.id;
                        clientMap.set(clientNameLower, clientId); // Atualizar cache local
                    } else {
                        console.error('Erro ao criar cliente:', clientNameRaw, createError);
                        errorCount++;
                        continue;
                    }
                } catch (e) {
                    console.error('Exceção ao criar cliente:', e);
                    errorCount++;
                    continue;
                }
              }
            }

            processedData.push({
              client_id: clientId,
              sku: sku,
              net_price: netPrice,
              gross_price: isNaN(grossPrice) ? null : grossPrice,
              margin_budget: isNaN(marginBudget) ? null : marginBudget,
              size: row['size']?.toString().trim() || null,
              manager: row['manager']?.toString().trim() || null,
              code: row['code']?.toString().trim() || null,
              category: row['category']?.toString().trim() || null,
              subcategory: row['subcategory']?.toString().trim() || null,
              month: monthStr || null,
              date: date.toISOString().split('T')[0],
              obs: row['obs']?.toString().trim() || null,
              currency: currency
            });
            successCount++;
          }

          if (processedData.length === 0) {
            toast.warning(`Nenhum registro válido encontrado. ${errorCount} linhas ignoradas por erro ou dados faltantes.`);
            return;
          }

          // Inserir dados no banco
          const { error } = await supabase
            .from('pricing_history')
            .insert(processedData);

          if (error) throw error;

          if (errorCount > 0) {
             toast.success(`Importação parcial: ${successCount} registros importados, ${errorCount} ignorados.`);
          } else {
             toast.success(`Importação realizada com sucesso! ${successCount} registros importados.`);
          }
          
          setShowImportModal(false);
          setImportFile(null);
          loadData(); // Recarregar dados

        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          toast.error('Erro ao processar arquivo: ' + error.message);
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      console.error('Erro ao importar Excel:', error);
      toast.error('Erro ao importar Excel: ' + error.message);
    }
  };

  const handleNewPriceSubmit = async (e) => {
    e.preventDefault();
    
    // Validação de campos obrigatórios
    if (!newPriceForm.client_id || !newPriceForm.sku || !newPriceForm.net_price || !newPriceForm.date) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Validação de valores numéricos
    const netPrice = parseFloat(newPriceForm.net_price);
    const grossPrice = newPriceForm.gross_price ? parseFloat(newPriceForm.gross_price) : null;
    const marginBudget = newPriceForm.margin_budget ? parseFloat(newPriceForm.margin_budget) : null;
    
    if (isNaN(netPrice) || netPrice <= 0) {
      toast.error('Preço líquido deve ser um número positivo.');
      return;
    }
    
    try {
      const priceData = {
        client_id: newPriceForm.client_id,
        sku: newPriceForm.sku.trim(),
        net_price: netPrice,
        gross_price: grossPrice,
        margin_budget: marginBudget,
        size: newPriceForm.size?.trim() || null,
        manager: newPriceForm.manager?.trim() || null,
        code: newPriceForm.code?.trim() || null,
        category: newPriceForm.category?.trim() || null,
        subcategory: newPriceForm.subcategory?.trim() || null,
        month: newPriceForm.month?.trim() || null,
        date: newPriceForm.date,
        obs: newPriceForm.obs?.trim() || null,
        currency: 'BRL'
      };

      let error;
      
      if (editingId) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('pricing_history')
          .update(priceData)
          .eq('id', editingId);
        error = updateError;
      } else {
        // Inserir novo
        const { error: insertError } = await supabase
          .from('pricing_history')
          .insert(priceData);
        error = insertError;
      }

      if (error) throw error;

      toast.success(editingId ? 'Preço atualizado com sucesso!' : 'Preço cadastrado com sucesso!');
      setShowNewPriceModal(false);
      setEditingId(null);
      setNewPriceForm({
        client_id: '',
        sku: '',
        net_price: '',
        gross_price: '',
        margin_budget: '',
        size: '',
        manager: '',
        code: '',
        category: '',
        subcategory: '',
        month: '',
        date: new Date().toISOString().split('T')[0],
        obs: ''
      });
      loadData(); // Recarregar dados

    } catch (error) {
      console.error('Erro ao salvar preço:', error);
      toast.error('Erro ao salvar preço: ' + error.message);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setNewPriceForm({
      client_id: item.client_id,
      sku: item.sku,
      net_price: item.net_price,
      gross_price: item.gross_price || '',
      margin_budget: item.margin_budget || '',
      size: item.size || '',
      manager: item.manager || '',
      code: item.code || '',
      category: item.category || '',
      subcategory: item.subcategory || '',
      month: item.month || '',
      date: item.date.split('T')[0],
      obs: item.obs || ''
    });
    setShowNewPriceModal(true);
  };

  const handleDeleteClick = (item) => {
    if (!isSuper) {
        toast.error('Apenas usuários do time de Pricing podem excluir registros.');
        return;
    }
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      const { error } = await supabase
        .from('pricing_history')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      toast.success('Registro excluído com sucesso!');
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir registro');
    }
  };

  // Função para normalizar nome de cliente (adicionar alias automaticamente)
  const normalizeClientName = async (clientId, originalName) => {
    try {
      // Verificar se já existe alias para este nome
      const { data: existingAlias } = await supabase
        .from('client_aliases')
        .select('id')
        .eq('alias_name', originalName)
        .single();

      if (!existingAlias) {
        // Criar alias automaticamente
        await supabase
          .from('client_aliases')
          .insert({
            client_id: clientId,
            alias_name: originalName
          });
      }
    } catch (error) {
      console.error('Erro ao normalizar nome do cliente:', error);
    }
  };

  const handleNewPriceChange = (field, value) => {
    setNewPriceForm(prev => {
      const newData = { ...prev, [field]: value };
      // Limpar SKU automaticamente se o cliente for alterado
      if (field === 'client_id') {
        newData.sku = '';
      }
      return newData;
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Header 
        user={user} 
        title="Gestão de Pricing" 
        subtitle="Dados e análises" 
        showBack={true} 
        backPath="/select"
      />

      {/* Action Bar */}
      <div className="max-w-[110rem] mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* Botões principais à esquerda */}
            {canEdit && (
              <>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewPriceForm({
                      client_id: '',
                      sku: '',
                      net_price: '',
                      gross_price: '',
                      margin_budget: '',
                      size: '',
                      manager: '',
                      code: '',
                      category: '',
                      subcategory: '',
                      month: '',
                      date: new Date().toISOString().split('T')[0],
                      obs: ''
                    });
                    setShowNewPriceModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                >
                  <Plus size={18} />
                  Novo Preço
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-info)', color: 'white' }}
                >
                  <Upload size={18} />
                  Importar Excel
                </button>
                <button
                  onClick={() => navigate('/pricing/analytics')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  <BarChart3 size={18} />
                  Ver Dashboards/Análises
                </button>
              </>
            )}
          </div>
          
          {/* Botões à direita: Exportar e Gerenciar Aliases */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <button
                  onClick={handleExportExcel}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Exportar"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={() => setShowAliasManager(true)}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-warning)', color: 'var(--color-text-primary)', fontWeight: '700' }}
                >
                  <Settings size={20} />
                  Gerenciar Aliases
                </button>
              </>
            )}
          </div>
        </div>
      </div>

        {/* Cards de Resumo */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Clientes</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {new Set(filteredData.map(item => item.client_id)).size}
                  </p>
                </div>
                <Users className="text-blue-500" size={32} />
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total SKUs</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {new Set(filteredData.map(item => item.sku)).size}
                  </p>
                </div>
                <Package className="text-green-500" size={32} />
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Preço Médio</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    R$ {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + (item.net_price || 0), 0) / filteredData.length).toFixed(2) : '0.00'}
                  </p>
                </div>
                <DollarSign className="text-yellow-500" size={32} />
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm card-pronutrition hover-lift">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Margem Média</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {filteredData.length > 0 ? (filteredData.reduce((sum, item) => sum + Number(item.margin_budget || 0), 0) / filteredData.length).toFixed(1) : '0.0'}%
                  </p>
                </div>
                <TrendingUp className="text-purple-500" size={32} />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="bg-white rounded-lg p-6 shadow-sm mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Filtros
                </h3>
              </div>
              {(filters.client || filters.sku || filters.category || filters.subcategory || filters.size || filters.datasulCode || filters.dateFrom || filters.dateTo) && (
                <button
                  onClick={() => setFilters({
                    client: '',
                    sku: '',
                    category: '',
                    subcategory: '',
                    size: '',
                    datasulCode: '',
                    dateFrom: '',
                    dateTo: ''
                  })}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X size={14} />
                  Limpar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  SKU
                </label>
                <SearchableSelect
                  options={skuOptions}
                  value={filters.sku}
                  onChange={(value) => handleFilterChange('sku', value)}
                  placeholder="Todos os SKUs"
                  searchPlaceholder="Buscar SKU..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Cliente
                </label>
                <SearchableSelect
                  options={clientOptions}
                  value={filters.client}
                  onChange={(value) => handleFilterChange('client', value)}
                  placeholder="Todos os clientes"
                  searchPlaceholder="Buscar cliente..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Código Datasul
                </label>
                <input
                  type="text"
                  value={filters.datasulCode}
                  onChange={(e) => handleFilterChange('datasulCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Filtrar por código..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Categoria
                </label>
                <SearchableSelect
                  options={categoryOptions}
                  value={filters.category}
                  onChange={(value) => handleFilterChange('category', value)}
                  placeholder="Todas"
                  searchPlaceholder="Buscar..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Subcategoria
                </label>
                <SearchableSelect
                  options={subcategoryOptions}
                  value={filters.subcategory}
                  onChange={(value) => handleFilterChange('subcategory', value)}
                  placeholder="Todas"
                  searchPlaceholder="Buscar..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Tamanho
                </label>
                <SearchableSelect
                  options={sizeOptions}
                  value={filters.size}
                  onChange={(value) => handleFilterChange('size', value)}
                  placeholder="Todos"
                  searchPlaceholder="Buscar..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Data Final
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="max-w-[110rem] mx-auto px-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tamanho
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gestora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço liquido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço bruto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Moeda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margem (Orçada)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vigência
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mês
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subcategoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="13" className="px-6 py-4 text-center text-gray-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="px-6 py-4 text-center text-gray-500">
                        Nenhum dado encontrado
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {item.clients?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.size || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.manager || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.code || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.sku}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {item.currency === 'USD' ? '$' : 'R$'} {(Number(item.net_price) || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.currency === 'USD' ? '$' : 'R$'} {(Number(item.gross_price) || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.currency === 'USD' ? 'Dólar' : 'Real'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {(Number(item.margin_budget) || 0).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.month || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.category || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {item.subcategory || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help text-gray-400 hover:text-gray-600 flex justify-center">
                                  <Clock size={16} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Última alteração por: {item.updated_by || 'Sistema'}</p>
                                <p>Em: {item.updated_at ? format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm') : (item.created_at ? format(new Date(item.created_at), 'dd/MM/yyyy HH:mm') : '-')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/pricing/analytics?sku=${encodeURIComponent(item.sku)}&client=${encodeURIComponent(item.client_id)}`)}
                              className="p-2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                              style={{ color: 'var(--color-success)' }}
                              title="Ver Analytics"
                            >
                              <BarChart3 size={16} />
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors transition-transform hover:scale-105 active:scale-95"
                                  style={{ color: 'var(--color-info)' }}
                                  title="Editar"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(item)}
                                  className="p-2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors transition-transform hover:scale-105 active:scale-95"
                                  style={{ color: 'var(--color-danger)' }}
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
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
        </div>

        {/* Modal de Novo Preço */}
        {showNewPriceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-auto shadow-xl">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-2 border-b">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {editingId ? 'Editar Preço' : 'Novo Preço'}
                </h2>
                <button
                  onClick={() => {
                    setShowNewPriceModal(false);
                    setEditingId(null);
                  }}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleNewPriceSubmit} id="newPriceForm" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Cliente *
                    </label>
                    <select
                      value={newPriceForm.client_id}
                      onChange={(e) => handleNewPriceChange('client_id', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione um cliente</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      SKU *
                    </label>
                    <input
                      type="text"
                      value={newPriceForm.sku}
                      onChange={(e) => handleNewPriceChange('sku', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite o SKU"
                    />
                  </div>
                  
                  {/* Novos Campos */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Código
                    </label>
                    <input
                      type="text"
                      value={newPriceForm.code}
                      onChange={(e) => handleNewPriceChange('code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Código Datasul"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Gestora
                    </label>
                    <input
                      type="text"
                      value={newPriceForm.manager}
                      onChange={(e) => handleNewPriceChange('manager', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Gestora"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Tamanho
                    </label>
                    <input
                      type="text"
                      value={newPriceForm.size}
                      onChange={(e) => handleNewPriceChange('size', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: P, M, G"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Categoria
                    </label>
                    <select
                      value={newPriceForm.category}
                      onChange={(e) => handleNewPriceChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione uma categoria</option>
                      {CATEGORY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Subcategoria
                    </label>
                    <select
                      value={newPriceForm.subcategory}
                      onChange={(e) => handleNewPriceChange('subcategory', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione uma subcategoria</option>
                      {SUBCATEGORY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Mês
                    </label>
                    <input
                      type="date"
                      value={newPriceForm.month}
                      onChange={(e) => handleNewPriceChange('month', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Preço Líquido *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPriceForm.net_price}
                      onChange={(e) => handleNewPriceChange('net_price', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Preço Bruto
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPriceForm.gross_price}
                      onChange={(e) => handleNewPriceChange('gross_price', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Margem Orçada (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newPriceForm.margin_budget}
                      onChange={(e) => handleNewPriceChange('margin_budget', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Data *
                    </label>
                    <input
                      type="date"
                      value={newPriceForm.date}
                      onChange={(e) => handleNewPriceChange('date', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Observações
                    </label>
                    <textarea
                      value={newPriceForm.obs}
                      onChange={(e) => handleNewPriceChange('obs', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      placeholder="Observações opcionais"
                    />
                  </div>
                </div>
              </form>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPriceModal(false);
                    setEditingId(null);
                    setNewPriceForm({
                      client_id: '',
                      sku: '',
                      net_price: '',
                      gross_price: '',
                      margin_budget: '',
                      size: '',
                      manager: '',
                      code: '',
                      category: '',
                      subcategory: '',
                      month: '',
                      date: new Date().toISOString().split('T')[0],
                      obs: ''
                    });
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="newPriceForm"
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Exclusão */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto shadow-xl">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Confirmar Exclusão
              </h2>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors hover:bg-gray-100"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors hover:bg-red-600 text-white"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importação */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Importar Excel
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Arquivo Excel
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {importFile && (
                    <p className="text-sm text-green-600 mt-1">
                      Arquivo selecionado: {importFile.name}
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <p>Formato esperado das colunas:</p>
                  <ul className="list-disc list-inside mt-2 grid grid-cols-2 gap-x-4">
                    <li>Cliente</li>
                    <li>Tamanho</li>
                    <li>Gestora</li>
                    <li>Código</li>
                    <li>SKU</li>
                    <li>Preço liquido</li>
                    <li>Preço bruto</li>
                    <li>Moeda</li>
                    <li>Margem (Orçada)</li>
                    <li>Mês</li>
                    <li>Categoria</li>
                    <li>Subcategoria</li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile}
                  className="px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: 'var(--color-info)', color: 'white' }}
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal de Gerenciamento de Aliases */}
        {showAliasManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Gerenciar Aliases de Clientes
                </h2>
                <button
                  onClick={() => setShowAliasManager(false)}
                  className="text-gray-500 hover:text-gray-700 transition-transform hover:scale-110"
                >
                  ✕
                </button>
              </div>
              <ClientAliasManager />
            </div>
          </div>
        )}
    </div>
  );
};

export default PricingDashboard;