import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getNativeSupabase, verifyManager } from './auth';
import { getManagerAuthEmail } from '../../shared/auth/manager';

type AuthStatus = 'loading' | 'signedOut' | 'verified' | 'error';
type AuthContextValue = {
  status: AuthStatus;
  error: string;
  operationalSchema: boolean | null;
  signIn: (userId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState('');
  const [operationalSchema, setOperationalSchema] = useState<boolean | null>(null);

  async function retry(preserveScreen = false) {
    if (!preserveScreen) setStatus('loading');
    setError('');
    try {
      const supabase = getNativeSupabase();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) { setStatus('signedOut'); return; }
      const access = await verifyManager(data.session.access_token);
      setOperationalSchema(access.operationalSchema);
      setStatus('verified');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sesi gagal diperiksa.');
      setStatus('error');
    }
  }

  useEffect(() => {
    void retry();
    const subscription = AppState.addEventListener('change', (state) => {
      try {
        const auth = getNativeSupabase().auth;
        if (state === 'active') { auth.startAutoRefresh(); void retry(true); }
        else auth.stopAutoRefresh();
      } catch { /* configuration is shown by retry */ }
    });
    return () => subscription.remove();
  }, []);

  async function signIn(userId: string, password: string) {
    setError('');
    const email = getManagerAuthEmail(userId);
    if (!email) throw new Error('User ID atau kata sandi tidak cocok');
    const supabase = getNativeSupabase();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.session) throw new Error('User ID atau kata sandi tidak cocok');
    try {
      const access = await verifyManager(data.session.access_token);
      setOperationalSchema(access.operationalSchema);
      setStatus('verified');
    } catch (reason) {
      if (reason instanceof Error && (reason.message.includes('akses manajer') || reason.message.includes('Sesi tidak berlaku'))) {
        await supabase.auth.signOut();
      }
      throw reason;
    }
  }

  async function signOut() {
    await getNativeSupabase().auth.signOut();
    setError('');
    setOperationalSchema(null);
    setStatus('signedOut');
  }

  return <AuthContext.Provider value={{ status, error, operationalSchema, signIn, signOut, retry }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider tidak tersedia');
  return value;
}
