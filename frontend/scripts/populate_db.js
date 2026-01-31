const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (mesmas credenciais do arquivo original)
const SUPABASE_URL = 'https://ptqptbsslyvytnnrgvqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cXB0YnNzbHl2eXRubnJndnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzM5NDEsImV4cCI6MjA3ODUwOTk0MX0.SvcC4lnQtt_ejE8dFxJQUVar9VF86rTcPDS5BfFNPoI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const clients = [
  { name: 'Empresa Alpha' },
  { name: 'Comercial Beta' },
  { name: 'Industrias Gamma' },
  { name: 'Delta Logística' },
  { name: 'Epsilon Varejo' },
  { name: 'Zeta Distribuidora' },
  { name: 'Omega Suplementos' },
  { name: 'Farmácia Central' }
];

const categories = {
  'Proteínas': ['Whey Protein Isolado', 'Whey Protein Concentrado', 'Caseína', 'Albumina'],
  'Aminoácidos': ['BCAA', 'Glutamina', 'Creatina', 'Arginina'],
  'Vitaminas': ['Multivitamínico', 'Vitamina C', 'Vitamina D', 'Ômega 3'],
  'Acessórios': ['Coqueteleira', 'Camiseta', 'Strap']
};

const sizes = ['1', '2', '3', '4'];
const managers = ['Ana Silva', 'Carlos Souza', 'Mariana Oliveira', 'Roberto Santos', 'Fernanda Lima'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatMonth(date) {
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const year = date.toLocaleDateString('pt-BR', { year: '2-digit' });
  return `${month}-${year}`;
}

async function run() {
  console.log('Iniciando população de dados com novas colunas...');

  try {
    // 1. Verificar e inserir clientes
    let { data: existingClients, error: fetchError } = await supabase.from('clients').select('*');
    
    if (fetchError) {
      console.error('Erro ao buscar clientes:', fetchError);
      return;
    }
    
    // Se não houver clientes suficientes, inserir mais
    if (!existingClients || existingClients.length < clients.length) {
        console.log('Inserindo/Atualizando clientes...');
        const existingNames = new Set((existingClients || []).map(c => c.name));
        const newClients = clients.filter(c => !existingNames.has(c.name));
        
        if (newClients.length > 0) {
          const { data, error } = await supabase
            .from('clients')
            .insert(newClients)
            .select();
          
          if (error) {
            console.error('Erro ao inserir clientes:', error);
            return;
          }
          console.log(`${newClients.length} novos clientes inseridos.`);
          existingClients = [...(existingClients || []), ...data];
        }
    } else {
        console.log(`Encontrados ${existingClients.length} clientes.`);
    }

    // 2. Limpar dados antigos de pricing
    console.log('Limpando dados antigos...');
    await supabase.from('pricing_history').delete().neq('currency', 'XYZ_INVALID'); 

    // 3. Gerar dados de Histórico de Preços
    console.log('Gerando dados detalhados de histórico de preços...');
    const pricingData = [];
    const today = new Date();
    // 24 meses de histórico
    const monthsToGenerate = 24; 

    // Gerar SKUs fixos por cliente para ter histórico consistente
    const skusPerClient = {};
    existingClients.forEach(client => {
      skusPerClient[client.id] = [];
      // Criar 5 SKUs base para cada cliente
      for (let k = 0; k < 5; k++) {
        const category = getRandomElement(Object.keys(categories));
        const subcategory = getRandomElement(categories[category]);
        const flavor = getRandomElement(['Baunilha', 'Chocolate', 'Morango', 'Neutro', 'Coco']);
        const pack = getRandomElement(['Display c/10', 'Pote', 'Refil', 'Caixa']);
        const weight = getRandomElement(['400g', '900g', '1kg', '2kg']);
        const skuName = `${client.name} - ${subcategory} ${flavor} - ${pack} ${weight}`;
        
        skusPerClient[client.id].push({
          sku: skuName,
          category,
          subcategory,
          size: weight,
          basePrice: Math.random() * 200 + 30,
          baseMargin: Math.random() * 0.4 + 0.1
        });
      }
    });

    existingClients.forEach(client => {
      const clientSkus = skusPerClient[client.id];
      
      // Para cada SKU, gerar histórico de preços mensal
      clientSkus.forEach(skuItem => {
        let currentPrice = skuItem.basePrice;
        let currentMargin = skuItem.baseMargin;

        for (let i = 0; i < monthsToGenerate; i++) {
          // Data: i meses atrás
          const date = new Date(today.getFullYear(), today.getMonth() - i, Math.floor(Math.random() * 28) + 1);
          
          // Variação de preço e margem (random walk)
          // Variação maior para simular mudanças reais de preço
          const priceChange = 1 + (Math.random() * 0.15 - 0.05); // -5% a +10%
          const marginChange = 1 + (Math.random() * 0.1 - 0.05); // +/- 5%
          
          // Aplicar variação ocasionalmente (nem todo mês muda de preço)
          if (Math.random() > 0.3) {
             currentPrice = currentPrice * priceChange;
             currentMargin = currentMargin * marginChange;
          }

          const netPrice = parseFloat(currentPrice.toFixed(2));
          const grossPrice = parseFloat((netPrice * 1.1).toFixed(2));
          const marginBudget = parseFloat((currentMargin * 100).toFixed(1));
          
          pricingData.push({
            client_id: client.id,
            sku: skuItem.sku,
            net_price: netPrice,
            gross_price: grossPrice,
            margin_budget: marginBudget,
            size: skuItem.size,
            manager: getRandomElement(managers),
            code: `${Math.floor(Math.random() * 9000) + 1000}.${Math.floor(Math.random() * 9000) + 1000}.${Math.floor(Math.random() * 9000) + 1000}`,
            category: skuItem.category,
            subcategory: skuItem.subcategory,
            month: formatMonth(date),
            date: date.toISOString().split('T')[0],
            currency: Math.random() > 0.9 ? 'USD' : 'BRL'
          });
        }
      });
    });

    console.log(`Inserindo ${pricingData.length} novos registros de preço...`);
    
    // Inserir em lotes para evitar erro de payload muito grande
    const batchSize = 100;
    for (let i = 0; i < pricingData.length; i += batchSize) {
        const batch = pricingData.slice(i, i + batchSize);
        const { error: pricingError } = await supabase
          .from('pricing_history')
          .insert(batch);

        if (pricingError) {
          console.error(`Erro ao inserir lote ${i/batchSize + 1}:`, pricingError);
        } else {
          console.log(`Lote ${i/batchSize + 1} inserido.`);
        }
    }

    console.log('População de dados concluída com sucesso!');
    
  } catch (err) {
    console.error('Erro inesperado:', err);
  }
}

run();
