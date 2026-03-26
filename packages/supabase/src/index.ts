import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return url;
};

const getSupabaseAnonKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return key;
};

const getSupabaseServiceRoleKey = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return key;
};

export const createBrowserSupabaseClient = () =>
  createClient(getSupabaseUrl(), getSupabaseAnonKey());

export const createServiceRoleSupabaseClient = () =>
  createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
