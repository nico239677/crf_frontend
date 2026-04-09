import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PYTHON_API_BASE_URL } from '../config';

let supabaseInstance: SupabaseClient | null = null;

console.log(`Fetching config from ${PYTHON_API_BASE_URL}/config`);

const supabaseReady: Promise<SupabaseClient> = fetch(`${PYTHON_API_BASE_URL}/config`)
  .then((res) => {
    if (!res.ok) throw new Error(`/config request failed with status ${res.status}`);
    return res.json();
  })
  .then(({ SUPABASE_URL, SUPABASE_KEY }) => {
    console.log('[supabase] /config fetched successfully');
    console.log('[supabase] SUPABASE_URL:', SUPABASE_URL);
    console.log('[supabase] SUPABASE_KEY:', SUPABASE_KEY ? `${SUPABASE_KEY.slice(0, 20)}...` : 'MISSING');
    supabaseInstance =createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[supabase] client initialized:');
    return supabaseInstance;
  })
  .catch((err) => {
    console.error('[supabase] failed to initialize:', err);
    throw err;
  });


export const getSupabase = (): Promise<SupabaseClient> => supabaseReady;
