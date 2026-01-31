const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ptqptbsslyvytnnrgvqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cXB0YnNzbHl2eXRubnJndnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzM5NDEsImV4cCI6MjA3ODUwOTk0MX0.SvcC4lnQtt_ejE8dFxJQUVar9VF86rTcPDS5BfFNPoI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('--- DIAGNÓSTICO PRICING ---');

  // 1. Verificar Clientes
  const { data: clients, error: clientError } = await supabase.from('clients').select('*');
  if (clientError) console.error('Erro Clients:', clientError);
  else console.log(`Clientes encontrados: ${clients.length}`);
  if (clients.length > 0) console.log('Exemplo de cliente:', clients[0]);

  // 2. Verificar Pricing History (sem join)
  const { data: prices, error: priceError } = await supabase
    .from('pricing_history')
    .select('*')
    .limit(5);
  
  if (priceError) console.error('Erro Pricing:', priceError);
  else console.log(`Registros de preço (amostra): ${prices.length}`);
  if (prices.length > 0) console.log('Exemplo de preço:', prices[0]);

  // 3. Verificar Pricing History COM JOIN
  const { data: joinData, error: joinError } = await supabase
    .from('pricing_history')
    .select('*, clients!inner(name)')
    .limit(5);

  if (joinError) {
    console.error('ERRO NO JOIN:', joinError);
  } else {
    console.log(`Sucesso no Join! Registros retornados: ${joinData.length}`);
    if (joinData.length > 0) console.log('Exemplo com Join:', joinData[0]);
  }

  // 4. Verificar Contagem por Data (últimos 30 dias)
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const { count, error: countError } = await supabase
    .from('pricing_history')
    .select('*', { count: 'exact', head: true })
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .lte('date', today.toISOString().split('T')[0]);

  console.log(`Registros nos últimos 30 dias (${thirtyDaysAgo.toISOString().split('T')[0]} a ${today.toISOString().split('T')[0]}): ${count}`);

}

run();
