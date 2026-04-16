import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PYTHON_API_BASE_URL } from '../config';

let supabaseInstance: SupabaseClient | null = null;
let cachedAccessToken: string | null = null;

console.log(`[supabase] fetching config from ${PYTHON_API_BASE_URL}/config`);

const supabaseReady: Promise<SupabaseClient> = fetch(`${PYTHON_API_BASE_URL}/config`)
  .then((res) => {
    console.log(`[supabase] /config response status: ${res.status}`);
    if (!res.ok) throw new Error(`/config request failed with status ${res.status}`);
    return res.json();
  })
  .then(({ SUPABASE_URL, SUPABASE_KEY }) => {
    console.log('[supabase] config received, SUPABASE_URL:', SUPABASE_URL);
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL or SUPABASE_KEY is missing from /config response');
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    // Cache the token whenever auth state changes (login, logout, token refresh)
    supabaseInstance.auth.onAuthStateChange((_event, session) => {
      cachedAccessToken = session?.access_token ?? null;
      console.log('[supabase] auth state changed, token cached:', cachedAccessToken ? 'yes' : 'no');
    });

    // Load the initial session from localStorage
    supabaseInstance.auth.getSession().then(({ data: { session } }) => {
      cachedAccessToken = session?.access_token ?? null;
      console.log('[supabase] initial session loaded, token cached:', cachedAccessToken ? 'yes' : 'no');
    });

    console.log('[supabase] client created successfully');
    return supabaseInstance;
  })
  .catch((err) => {
    console.error('[supabase] failed to initialize:', err);
    throw err;
  });

export const getSupabase = (): Promise<SupabaseClient> => supabaseReady;

/** Returns the current access token synchronously once the client is ready. */
export const getAccessToken = async (): Promise<string | null> => {
  await supabaseReady;
  return cachedAccessToken;
};
