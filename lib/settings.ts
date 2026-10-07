import type { SupabaseClient } from '@supabase/supabase-js';
import type { Frequency } from './period';

export async function getFrequency(supabase: SupabaseClient): Promise<Frequency> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'inspection_frequency').maybeSingle();
  return data?.value === 'bulanan' ? 'bulanan' : 'harian';
}
