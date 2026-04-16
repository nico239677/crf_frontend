import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from './pages/Home';
import { AuthScreen } from './components/AuthScreen';
import { getSupabase } from './config/supabase';
import type { Session } from '@supabase/supabase-js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    getSupabase().then((client) => {
      console.log('[App] supabase client ready, checking session…');
      // Check current session
      client.auth.getSession().then(({ data: { session } }) => {
        console.log('[App] session:', session ? `logged in as ${session.user.email}` : 'no session');
        setSession(session);
        setLoading(false);
      }).catch((err) => {
        console.error('[App] getSession() failed:', err);
        setLoading(false);
      });

      // Listen for auth state changes
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        console.log('[App] auth state changed:', _event);
        setSession(session);
        setLoading(false);
      });

      unsubscribe = () => subscription.unsubscribe();
    }).catch((err) => {
      console.error('[App] getSupabase() failed:', err);
      setLoading(false);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleAuth = async (mode: 'login' | 'signup', email: string, password: string) => {
    setAuthLoading(true);
    try {
      const client = await getSupabase();
      let result;
      if (mode === 'signup') {
        result = await client.auth.signUp({ email, password });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }
      if (result.error) {
        return { error: result.error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Authentication failed' };
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const client = await getSupabase();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Google sign-in failed' };
    }
  };

  const handleSignOut = async () => {
    const client = await getSupabase();
    await client.auth.signOut({ scope: 'local' });
    // Clear Supabase localStorage entries
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
    setSession(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-blue-600 text-lg font-medium">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        onAuth={handleAuth}
        onGoogleAuth={handleGoogleAuth}
        loading={authLoading}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Home onSignOut={handleSignOut} userEmail={session.user.email} />
    </QueryClientProvider>
  );
}

export default function App() {
  return <AppContent />;
}
