import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PYTHON_API_BASE_URL } from '../config';

let supabaseInstance: SupabaseClient | null = null;

const supabaseReady: Promise<SupabaseClient> = fetch(`${PYTHON_API_BASE_URL}/config`)
  .then((res) => res.json())
  .then(({ SUPABASE_URL, SUPABASE_KEY }) => {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseInstance;
  });

export const getSupabase = (): Promise<SupabaseClient> => supabaseReady;
