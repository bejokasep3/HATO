import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { addPayment, getOrderPayments, newIdempotencyKey, reversePayment } from '@/lib/api';
import { persistentStorage } from '@/lib/auth';
import { OrderPaymentsResponse, PaymentRecord } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type Draft = {
  amount: string;
  method: PaymentRecord['method'];
  note: string;
  attempt: { signature: string; key: string } | null;
};

const initialDraft: Draft = { amount: '', method: 'cash', note: '', attempt: null };

export default function PaymentDetailScreen() {
  const { operationalSchema } = useAuth();
  const canMutate = operationalSchema === true;
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Array.isArray(id) ? id[0] : id;
  const storageKey = `hato.payment-draft.${orderId}`;
  const [data, setData] = useState<OrderPaymentsResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'payment' | 'reverse' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reverseAttempt, setReverseAttempt] = useState<{ signature: string; key: string } | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setError('');
    try {
      setData(await getOrderPayments(orderId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rincian pembayaran gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    let active = true;
    setDraftReady(false);
    persistentStorage.getItem(storageKey).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        setDraft({
          amount: typeof parsed.amount === 'string' ? parsed.amount : '',
          method: parsed.method === 'transfer' || parsed.method === 'other' ? parsed.method : 'cash',
          note: typeof parsed.note === 'string' ? parsed.note : '',
          attempt: parsed.attempt ?? null,
        });
      } catch { void persistentStorage.removeItem(storageKey); }
    }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => { void persistentStorage.setItem(storageKey, JSON.stringify(draft)); }, 250);
    return () => clearTimeout(timer);
  }, [draft, draftReady, storageKey]);

  function changeDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch, attempt: null }));
    setError('');
    setSuccess('');
  }

  async function savePayment() {
    if (!canMutate || !data || !orderId) return;
    const amount = draft.amount.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError('Isi nominal pembayaran yang valid.');
      return;
    }
    if (data.summary.outstandingAmount !== null && Number(amount) > Number(data.summary.outstandingAmount)) {
      setError(`Nominal melebihi sisa ${formatCurrency(data.summary.outstandingAmount)}.`);
      return;
    }
    const payload = { amount, method: draft.method, note: draft.note.trim() || null };
    const signature = JSON.stringify(payload);
    const attempt = draft.attempt?.signature === signature ? draft.attempt : { signature, key: newIdempotencyKey() };
    const persisted = { ...draft, amount, attempt };
    setDraft(persisted);
    await persistentStorage.setItem(storageKey, JSON.stringify(persisted));
    setSaving('payment');
    setError('');
    setSuccess('');
    try {
      await addPayment(orderId, payload, { idempotencyKey: attempt.key });
      await persistentStorage.removeItem(storageKey);
      setDraft(initialDraft);
      setDraftReady(false);
      setSuccess('Pembayaran tersimpan dan saldo telah diperbarui.');
      await load();
      setDraftReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pembayaran gagal. Draf tetap tersimpan untuk dicoba lagi.');
    } finally {
      setSaving(null);
    }
  }

  async function saveReversal(paymentId: string) {
    if (!canMutate) return;
    const reason = reversalReason.trim();
    if (!reason) {
      setError('Alasan pembalikan wajib diisi.');
      return;
    }
    const signature = JSON.stringify({ paymentId, reason });
    const attempt = reverseAttempt?.signature === signature ? reverseAttempt : { signature, key: newIdempotencyKey() };
    setReverseAttempt(attempt);
    setSaving('reverse');
    setError('');
    setSuccess('');
    try {
      await reversePayment(paymentId, reason, { idempotencyKey: attempt.key });
      setReversingId(null);
      setReversalReason('');
      setReverseAttempt(null);
      setSuccess('Pembayaran dibalik dan saldo telah diperbarui.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pembayaran gagal dibalik.');
    } finally {
      setSaving(null);
    }
  }

  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.errorText}>{error || 'Pesanan tidak ditemukan.'}</Text><Pressable onPress={() => void load()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Coba lagi</Text></Pressable></View>;

  const canPay = canMutate && !data.cancelledAt && data.summary.status !== 'paid' && data.summary.status !== 'unverified';
  const activeCount = data.payments.filter((payment) => !payment.reversedAt).length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.name}>{data.member.name}</Text>
          <Text style={styles.muted}>{data.member.groupName ?? 'Tanpa sub-grup'} · {data.cycle.label}</Text>
        </View>

        <View style={styles.balance}>
          <Balance label="Nilai pesanan" value={formatCurrency(data.totalAmount)} />
          <Balance label="Sudah dibayar" value={data.summary.paidAmount === null ? 'Belum diketahui' : formatCurrency(data.summary.paidAmount)} success />
          <Balance label="Sisa" value={data.summary.outstandingAmount === null ? 'Belum diketahui' : formatCurrency(data.summary.outstandingAmount)} danger />
        </View>

        {operationalSchema === false ? <View style={styles.warningBox}><Text style={styles.warningText}>Mode baca aktif. Pencatatan dan pembalikan pembayaran dinonaktifkan sampai schema operasional diperbarui.</Text></View> : null}

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}
        {data.summary.status === 'paid' ? <View style={styles.successBox}><Text style={styles.successTitle}>Lunas</Text><Text style={styles.successText}>Tidak ada sisa yang perlu dibayar.</Text></View> : null}
        {data.summary.status === 'unverified' ? <View style={styles.warningBox}><Text style={styles.warningText}>Saldo awal pesanan lama ini harus diverifikasi sebelum pembayaran baru dicatat.</Text></View> : null}
        {data.cancelledAt ? <View style={styles.errorBox}><Text style={styles.errorText}>Pesanan dibatalkan. Pembayaran baru tidak dapat dicatat.</Text></View> : null}

        {canPay ? <View style={styles.section}>
          <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.sectionTitle}>Catat pembayaran</Text><Text style={styles.muted}>Draf tersimpan di perangkat ini.</Text></View><Pressable onPress={() => changeDraft({ amount: data.summary.outstandingAmount ?? '' })} style={styles.smallButton}><Text style={styles.smallButtonText}>Lunasi sisa</Text></Pressable></View>
          <Text style={styles.label}>Nominal</Text>
          <TextInput value={draft.amount} onChangeText={(value) => changeDraft({ amount: value.replace(',', '.') })} keyboardType="decimal-pad" placeholder="Contoh: 50000" style={styles.input} />
          <Text style={styles.label}>Cara bayar</Text>
          <View style={styles.methods}>{(['cash', 'transfer', 'other'] as const).map((method) => <Pressable key={method} accessibilityState={{ selected: draft.method === method }} onPress={() => changeDraft({ method })} style={[styles.method, draft.method === method && styles.methodActive]}><Text style={[styles.methodText, draft.method === method && styles.methodTextActive]}>{method === 'cash' ? 'Tunai' : method === 'transfer' ? 'Transfer' : 'Lainnya'}</Text></Pressable>)}</View>
          <Text style={styles.label}>Catatan <Text style={styles.optional}>(opsional)</Text></Text>
          <TextInput value={draft.note} onChangeText={(value) => changeDraft({ note: value })} multiline maxLength={1000} style={[styles.input, styles.textArea]} />
          <Pressable disabled={saving !== null} onPress={() => void savePayment()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving !== null && styles.disabled]}><Text style={styles.primaryText}>{saving === 'payment' ? 'Menyimpan…' : 'Simpan pembayaran'}</Text></Pressable>
        </View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Riwayat pembayaran</Text>
          <Text style={styles.muted}>{activeCount} pembayaran aktif</Text>
          <View style={styles.history}>
            {data.payments.map((payment) => <View key={payment.id} style={[styles.historyRow, payment.reversedAt ? styles.reversed : null]}>
              <View style={styles.rowBetween}><View style={styles.flex}><Text style={[styles.historyAmount, payment.reversedAt ? styles.strike : null]}>{formatCurrency(payment.amount)}</Text><Text style={styles.muted}>{methodLabel(payment.method)} · {formatDateTime(payment.occurredAt ?? payment.createdAt ?? null)}</Text>{payment.note ? <Text style={styles.note}>{payment.note}</Text> : null}{payment.reversedAt ? <Text style={styles.reversalText}>Dibatalkan: {payment.reversalReason}</Text> : null}</View>{canMutate && !payment.reversedAt ? <Pressable onPress={() => { setReversingId(payment.id); setReversalReason(''); setReverseAttempt(null); }} style={styles.reverseButton}><SymbolView name="arrow.uturn.backward" size={15} tintColor="#9f1239" fallback={<Text>↶</Text>} /><Text style={styles.reverseText}>Balikkan</Text></Pressable> : null}</View>
              {reversingId === payment.id ? <View style={styles.reverseForm}><Text style={styles.reverseLabel}>Alasan pembalikan</Text><TextInput autoFocus value={reversalReason} onChangeText={(value) => { setReversalReason(value); setReverseAttempt(null); }} multiline maxLength={500} style={[styles.input, styles.textArea]} /><View style={styles.reverseActions}><Pressable onPress={() => { setReversingId(null); setReversalReason(''); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Batal</Text></Pressable><Pressable disabled={saving !== null} onPress={() => void saveReversal(payment.id)} style={[styles.dangerButton, saving !== null && styles.disabled]}><Text style={styles.dangerText}>{saving === 'reverse' ? 'Membalikkan…' : 'Konfirmasi'}</Text></Pressable></View></View> : null}
            </View>)}
            {data.payments.length === 0 ? <Text style={styles.empty}>Belum ada pembayaran.</Text> : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Balance({ label, value, success, danger }: { label: string; value: string; success?: boolean; danger?: boolean }) {
  return <View style={styles.balanceItem}><Text style={styles.balanceLabel}>{label}</Text><Text style={[styles.balanceValue, success && styles.green, danger && styles.red]}>{value}</Text></View>;
}

function methodLabel(method: PaymentRecord['method']) {
  if (method === 'cash') return 'Tunai';
  if (method === 'transfer') return 'Transfer';
  return 'Lainnya';
}

function formatDateTime(value: string | null) {
  if (!value) return 'Waktu tidak dicatat';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#f8fafc' },
  header: { paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  name: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  muted: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  balance: { marginTop: 14, flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12 },
  balanceItem: { flex: 1, gap: 4 },
  balanceLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' },
  balanceValue: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  green: { color: '#047857' }, red: { color: '#9f1239' },
  section: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 18 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1 },
  label: { marginTop: 14, marginBottom: 6, color: '#334155', fontSize: 12, fontWeight: '700' },
  optional: { color: '#64748b', fontWeight: '400' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 12, color: '#0f172a', fontSize: 15 },
  textArea: { minHeight: 72, paddingTop: 10, textAlignVertical: 'top' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff' },
  methodActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  methodText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  methodTextActive: { color: '#fff' },
  primaryButton: { minHeight: 48, marginTop: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#065f46' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  smallButtonText: { color: '#065f46', fontSize: 12, fontWeight: '800' },
  history: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  historyRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  historyAmount: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  note: { marginTop: 3, color: '#334155', fontSize: 12 },
  reversed: { opacity: 0.62 },
  strike: { textDecorationLine: 'line-through' },
  reversalText: { marginTop: 4, color: '#9f1239', fontSize: 12, fontWeight: '700' },
  reverseButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  reverseText: { color: '#9f1239', fontSize: 12, fontWeight: '800' },
  reverseForm: { marginTop: 10, backgroundColor: '#fff1f2', borderRadius: 10, padding: 12 },
  reverseLabel: { color: '#881337', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  reverseActions: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  secondaryText: { color: '#334155', fontSize: 13, fontWeight: '800' },
  dangerButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#ffe4e6', borderWidth: 1, borderColor: '#fecdd3' },
  dangerText: { color: '#9f1239', fontSize: 13, fontWeight: '800' },
  errorBox: { marginTop: 12, padding: 12, backgroundColor: '#fff1f2', borderRadius: 10 },
  errorText: { color: '#9f1239', fontSize: 12, lineHeight: 18 },
  successBox: { marginTop: 12, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 10 },
  successTitle: { color: '#065f46', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  successText: { color: '#065f46', fontSize: 12, lineHeight: 18 },
  warningBox: { marginTop: 12, padding: 12, backgroundColor: '#fffbeb', borderRadius: 10 },
  warningText: { color: '#78350f', fontSize: 12, lineHeight: 18 },
  empty: { paddingVertical: 20, textAlign: 'center', color: '#64748b', fontSize: 12 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
