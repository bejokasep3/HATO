import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPost, getCycles, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Cycle } from '@/lib/types';
import { currentWeekStart } from '../../../src/lib/domain/calendar';

export default function StartWeekScreen() {
  const router = useRouter();
  const { operationalSchema } = useAuth();
  const [ayam, setAyam] = useState('');
  const [tahu, setTahu] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  async function start() {
    if (operationalSchema !== true || busy) return;
    setBusy(true);
    setError('');
    const periodStart = currentWeekStart(new Date());
    try {
      let week = (await getCycles()).find((cycle) => cycle.periodStart.slice(0, 10) === periodStart);
      if (!week) {
        if (!/^\d+(?:[,.]\d{1,2})?$/.test(ayam) || !/^\d+$/.test(tahu)) throw new Error('Isi target ayam dalam kg dan target tahu dalam bungkus. Gunakan angka nol atau lebih.');
        const body = { periodStart, copyPreviousPrices: false, targets: [
          { groupCode: 'AYAM', quantity: Number(ayam.replace(',', '.')).toFixed(2) },
          { groupCode: 'TAHU', quantity: Number(tahu).toFixed(2) },
        ] };
        const signature = JSON.stringify(body);
        if (attempt.current?.signature !== signature) attempt.current = { signature, key: newIdempotencyKey() };
        try { week = await apiPost<Cycle>('/api/cycles', body, { idempotencyKey: attempt.current.key }); }
        catch (cause) {
          week = (await getCycles()).find((cycle) => cycle.periodStart.slice(0, 10) === periodStart);
          if (!week) throw cause;
        }
      }
      attempt.current = null;
      router.replace({ pathname: '/orders/new', params: { cycleId: week.id } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Minggu kerja gagal dimulai. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Mulai minggu ini</Text>
    <Text style={styles.body}>Minggu dimulai Senin, {currentWeekStart(new Date())}. Isi target, lalu catat pesanan. Harga dapat diisi nanti.</Text>
    <Text style={styles.label}>Target ayam (kg)</Text>
    <TextInput accessibilityLabel="Target ayam dalam kg" editable={!busy} keyboardType="decimal-pad" value={ayam} onChangeText={setAyam} style={styles.input} />
    <Text style={styles.label}>Target tahu (bungkus)</Text>
    <TextInput accessibilityLabel="Target tahu dalam bungkus" editable={!busy} keyboardType="number-pad" value={tahu} onChangeText={setTahu} style={styles.input} />
    <Text style={styles.body}>Tagihan dihitung setelah harga diisi dan dikunci. Jika minggu ini sudah ada, pesanan minggu tersebut akan dibuka.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy || operationalSchema !== true} onPress={() => void start()} style={[styles.button, (busy || operationalSchema !== true) && styles.disabled]}>{busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Mulai & input pesanan</Text>}</Pressable>
    {operationalSchema !== true ? <Text style={styles.body}>Input minggu tersedia setelah database operasional siap.</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, backgroundColor: '#f8fafc', flexGrow: 1 },
  title: { color: '#0f172a', fontSize: 24, fontWeight: '800' },
  body: { color: '#475569', fontSize: 14, lineHeight: 21 },
  label: { color: '#0f172a', fontSize: 14, fontWeight: '700', marginTop: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#64748b', borderRadius: 8, backgroundColor: '#ffffff', paddingHorizontal: 12, color: '#0f172a', fontSize: 16 },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: '#065f46', alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 }, error: { color: '#9f1239', fontSize: 14, lineHeight: 21 },
});
