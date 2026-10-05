import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

type Manifest = { generation: string; count: number };
const CHUNK_LENGTH = 500;
let client: SupabaseClient | null = null;

function storageKey(key: string, generation: string, index: number): string {
  return `${key}.${generation}.${index}`;
}

async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(`${key}.manifest`);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'generation' in parsed && 'count' in parsed &&
      typeof parsed.generation === 'string' && typeof parsed.count === 'number' &&
      parsed.count > 0 && parsed.count <= 128) return parsed as Manifest;
  } catch { return null; }
  return null;
}

export const persistentStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const manifest = await readManifest(key);
    if (!manifest) return null;
    const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
      SecureStore.getItemAsync(storageKey(key, manifest.generation, index))));
    return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(key, value); return; }
    const previous = await readManifest(key);
    const generation = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const chunks = value.match(new RegExp(`.{1,${CHUNK_LENGTH}}`, 'gs')) ?? [];
    if (chunks.length === 0 || chunks.length > 128) throw new Error('Ukuran sesi melebihi kapasitas penyimpanan aman');
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(storageKey(key, generation, index), chunk)));
    await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ generation, count: chunks.length }));
    if (previous) {
      await Promise.all(Array.from({ length: previous.count }, (_, index) =>
        SecureStore.deleteItemAsync(storageKey(key, previous.generation, index)).catch(() => undefined)));
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.removeItem(key); return; }
    const manifest = await readManifest(key);
    await SecureStore.deleteItemAsync(`${key}.manifest`);
    if (manifest) {
      await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
        SecureStore.deleteItemAsync(storageKey(key, manifest.generation, index))));
    }
  },
};

export function getNativeSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Konfigurasi login mobile belum tersedia');
  client = createClient(url, key, {
    auth: { storage: persistentStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  return client;
}

export async function verifyManager(token: string): Promise<{ operationalSchema: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 403) throw new Error('Akun ini belum diberi akses manajer');
  if (response.status === 401) throw new Error('Sesi tidak berlaku. Masuk kembali.');
  if (!response.ok) throw new Error('Verifikasi akses belum tersedia. Periksa koneksi lalu coba lagi.');
  const body: unknown = await response.json();
  return {
    operationalSchema: Boolean(body && typeof body === 'object' && 'operationalSchema' in body && body.operationalSchema),
  };
}
