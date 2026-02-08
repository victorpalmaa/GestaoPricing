
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkValues() {
  const { data, error } = await supabase
    .from('pricing_history')
    .select('currency')
    .limit(50);

  if (data) {
    const values = [...new Set(data.map(d => d.currency))];
    console.log('Currency values:', values);
  }
}

checkValues();
