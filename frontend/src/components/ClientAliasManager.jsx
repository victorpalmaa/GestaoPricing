import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/utils';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { addNotification } from '@/utils/notifications';

const ClientAliasManager = ({ user, refreshAliases }) => {
  const [clients, setClients] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [editingAlias, setEditingAlias] = useState(null);
  const [editAliasValue, setEditAliasValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar clientes
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      setClients(clientsData || []);

      // Carregar aliases
      const { data: aliasesData } = await supabase
        .from('client_aliases')
        .select(`
          *,
          clients!inner(name)
        `)
        .order('alias_name');
      
      setAliases(aliasesData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    
    if (!selectedClient || !newAlias.trim()) return;

    try {
      const { error } = await supabase
        .from('client_aliases')
        .insert({
          client_id: selectedClient,
          alias_name: newAlias.trim()
        });

      if (error) throw error;

      addNotification('alias', `Novo depara adicionado: ${newAlias.trim()}`, user?.id);
      setNewAlias('');
      loadData(); // Recarregar dados
      if (refreshAliases) refreshAliases();

    } catch (error) {
      console.error('Erro ao adicionar alias:', error);
      alert('Erro ao adicionar depara: ' + error.message);
    }
  };

  const handleDeleteAlias = async (aliasId) => {
    if (!confirm('Tem certeza que deseja excluir este depara?')) return;

    try {
      const { error } = await supabase
        .from('client_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;

      addNotification('alias', 'Depara excluído', user?.id);
      loadData(); // Recarregar dados
      if (refreshAliases) refreshAliases();

    } catch (error) {
      console.error('Erro ao excluir alias:', error);
      alert('Erro ao excluir depara: ' + error.message);
    }
  };

  const handleEditAlias = (alias) => {
    setEditingAlias(alias.id);
    setEditAliasValue(alias.alias_name);
  };

  const handleSaveEdit = async (aliasId) => {
    if (!editAliasValue.trim()) return;

    try {
      const { error } = await supabase
        .from('client_aliases')
        .update({ alias_name: editAliasValue.trim() })
        .eq('id', aliasId);

      if (error) throw error;

      addNotification('alias', `Depara atualizado: ${editAliasValue.trim()}`, user?.id);
      setEditingAlias(null);
      setEditAliasValue('');
      loadData(); // Recarregar dados
      if (refreshAliases) refreshAliases();

    } catch (error) {
      console.error('Erro ao editar alias:', error);
      alert('Erro ao editar depara: ' + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingAlias(null);
    setEditAliasValue('');
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente não encontrado';
  };

  const groupAliasesByClient = () => {
    const grouped = {};
    aliases.forEach(alias => {
      if (!grouped[alias.client_id]) {
        grouped[alias.client_id] = {
          clientName: getClientName(alias.client_id),
          aliases: []
        };
      }
      grouped[alias.client_id].aliases.push(alias);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-900 dark:text-white"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  const groupedAliases = groupAliasesByClient();

  return (
    <div className="bg-white dark:bg-[#171717] rounded-lg shadow-sm p-6 transition-colors duration-200">
      <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
        Gerenciar Depara de Clientes
      </h2>

      {/* Formulário para adicionar novo alias */}
      <form onSubmit={handleAddAlias} className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Adicionar Novo Depara
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Cliente *
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">Selecione um cliente</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Depara *
            </label>
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="Digite o depara do cliente"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!selectedClient || !newAlias.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>
        </div>
      </form>

      {/* Lista de aliases por cliente */}
      <div className="space-y-6">
        {Object.entries(groupedAliases).map(([clientId, data]) => (
          <div key={clientId} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              {data.clientName}
            </h4>
            {data.aliases.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum depara cadastrado</p>
            ) : (
              <div className="space-y-2">
                {data.aliases.map(alias => (
                  <div key={alias.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all">
                    {editingAlias === alias.id ? (
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="text"
                          value={editAliasValue}
                          onChange={(e) => setEditAliasValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => handleSaveEdit(alias.id)}
                          className="px-3 py-2 rounded-lg font-semibold transition-colors"
                          style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-2 rounded-lg font-semibold transition-colors text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between flex-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {alias.alias_name}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditAlias(alias)}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: 'var(--color-warning)' }}
                            title="Editar"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAlias(alias.id)}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: 'var(--color-danger)' }}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {Object.keys(groupedAliases).length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Nenhum depara cadastrado ainda.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Use o formulário acima para adicionar depara de clientes.
          </p>
        </div>
      )}
    </div>
  );
};

export default ClientAliasManager;