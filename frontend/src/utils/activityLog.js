import { supabase } from '@/lib/utils';

export async function logExport(tableName, rowCount, details = null) {
  try {
    const { error } = await supabase.rpc('log_export', {
      p_table_name: tableName,
      p_count: rowCount,
      p_details: details,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Erro ao registrar exportação no activity_log:', error);
  }
}
