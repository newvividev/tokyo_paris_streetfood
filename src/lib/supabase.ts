import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseConnectionState = 'connected' | 'missing_env' | 'error';

let clientInstance: SupabaseClient | null = null;

const getSupabaseEnv = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return { url, anonKey };
};

export const isSupabaseConfigured = () => {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
};

export const getSupabaseClient = () => {
  if (clientInstance) return clientInstance;

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error('Supabase environment is not configured');
  }

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
};

export const checkSupabaseConnection = async (): Promise<SupabaseConnectionState> => {
  if (!isSupabaseConfigured()) return 'missing_env';

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.getSession();
    if (error) return 'error';
    return 'connected';
  } catch {
    return 'error';
  }
};

