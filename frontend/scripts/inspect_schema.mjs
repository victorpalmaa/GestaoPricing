
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listColumns() {
  console.log('Fetching columns for pricing_history...');
  
  // Fetch one row to inspect keys (columns)
  const { data, error } = await supabase
    .from('pricing_history')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('Current columns:', columns);
  } else {
    console.log('Table is empty, cannot infer columns from data directly via client. Assuming standard columns exist or using recent knowledge.');
    // If empty, we might need to rely on the previous analysis or try to insert a dummy row (risky). 
    // However, the user previously said "confira se a tabela... contem". The previous agent ran a check and it worked, so there must be data.
  }
}

listColumns();
