
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ptqptbsslyvytnnrgvqp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cXB0YnNzbHl2eXRubnJndnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzM5NDEsImV4cCI6MjA3ODUwOTk0MX0.SvcC4lnQtt_ejE8dFxJQUVar9VF86rTcPDS5BfFNPoI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Searching for client "Delta Logistica"...');
  
  // 1. Find the client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%Delta Logistica%');

  if (clientError) {
    console.error('Error finding client:', clientError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('Client "Delta Logistica" not found.');
    return;
  }

  const client = clients[0];
  console.log(`Found client: ${client.name} (ID: ${client.id})`);

  // 2. Count distinct SKUs
  const { data: pricingData, error: pricingError } = await supabase
    .from('pricing_history')
    .select('sku')
    .eq('client_id', client.id);

  if (pricingError) {
    console.error('Error fetching pricing:', pricingError);
    return;
  }

  const uniqueSkus = new Set(pricingData.map(p => p.sku));
  console.log(`Total records: ${pricingData.length}`);
  console.log(`Unique SKUs: ${uniqueSkus.size}`);
  console.log('SKUs:', [...uniqueSkus].sort());
}

run();
