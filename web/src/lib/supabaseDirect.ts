import { supabase } from './supabase';

/**
 * Direct HTTP interface to Supabase REST API
 * 
 * This bypasses the Supabase client's query builder which has a bug
 * in v2.98.0 where it appends ':1' to column parameters, causing 404 errors.
 * 
 * Instead, we use standard HTTP requests to the Supabase REST API with
 * manual authentication. This provides a reliable workaround until the
 * client bug is fixed.
 */

interface DirectInsertOptions {
  table: string;
  data: Record<string, unknown>[];
  headers?: Record<string, string>;
  onConflict?: string;
  returning?: 'minimal' | 'representation' | 'all';
}

interface DirectInsertResult {
  error: Error | null;
  data: unknown;
  status: number;
}

export async function directInsert(
  options: DirectInsertOptions
): Promise<DirectInsertResult> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('No active session');
    }

    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
    
    // Build URL
    let url = `${VITE_SUPABASE_URL}/rest/v1/${options.table}`;
    const params = new URLSearchParams();
    
    if (options.onConflict) {
      params.append('on_conflict', options.onConflict);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': options.returning ? `return=${options.returning}` : 'return=minimal',
      ...options.headers,
    };
    
    // Make request
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(options.data),
    });
    
    const status = response.status;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    return { error: null, data, status };
  } catch (error) {
    console.error('[DirectInsert] Error:', error);
    return { 
      error: error as Error, 
      data: null, 
      status: 0 
    };
  }
}

export async function directUpdate(
  table: string,
  filters: Record<string, unknown>,
  updates: Record<string, unknown>
): Promise<DirectInsertResult> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('No active session');
    }

    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
    
    // Build URL with filters
    let url = `${VITE_SUPABASE_URL}/rest/v1/${table}`;
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    return { error: null, data, status: response.status };
  } catch (error) {
    console.error('[DirectUpdate] Error:', error);
    return { error: error as Error, data: null, status: 0 };
  }
}

export async function directDelete(
  table: string,
  filters: Record<string, unknown>
): Promise<DirectInsertResult> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('No active session');
    }

    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
    
    let url = `${VITE_SUPABASE_URL}/rest/v1/${table}`;
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return { error: null, data: null, status: response.status };
  } catch (error) {
    console.error('[DirectDelete] Error:', error);
    return { error: error as Error, data: null, status: 0 };
  }
}
