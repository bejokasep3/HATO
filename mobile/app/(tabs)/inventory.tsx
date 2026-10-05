import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { confirmReceipt, getCycles, getInventory, getOrders, newIdempotencyKey, saveReceiptDraft, updateOrderFulfillment } from '@/lib/api';
import { persistentStorage } from '@/lib/auth';
import { Cycle, InventoryResponse, Order } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

type Line = { receivedQty: string; damagedQty: string; purchasePrice: string; notes: string };
type Draft = { lines: Record<string, Line>; supplierNote: string; attempt: { signature: string; key: string } | null };

export default function InventoryScreen() {
  const { operationalSchema } = useAuth();
  const canMutate = operationalSchema === true;
  const params = useLocalSearchParams<{ cycleId?: string }>();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState(params.cycleId ?? '');
  const [detail, setDetail] = useState<InventoryResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [draft, setDraft] = useState<Draft>({ lines: {}, supplierNote: '', attempt: null });
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirming, setConfirming] = useState(false);
  const storageKey = cycleId ? `hato.receipt-draft.${cycleId}` : '';

  const loadCycle = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    try {
      const [nextDetail, nextOrders] = await Promise.all([getInventory(id), getOrders(id)]);
      setDetail(nextDetail);
      setOrders(nextOrders.filter((order) => !order.cancelledAt));
      const saved = new Map(nextDetail.receipt?.items.map((item) => [item.productId, item]) ?? []);
      const serverLines = Object.fromEntries(nextDetail.items.map((item) => {
        const existing = saved.get(item.productId);
        return [item.productId, {
          receivedQty: existing?.receivedQty ?? item.capacity ?? '0',
          damagedQty: existing?.damagedQty ?? '0',
          purchasePrice: existing?.purchasePrice ?? '0',
          notes: existing?.notes ?? '',
        }];
      }));
      let nextDraft: Draft = { lines: serverLines, supplierNote: nextDetail.receipt?.supplierNote ?? '', attempt: null };
      if (nextDetail.receipt?.status !== 'confirmed') {
        const raw = await persistentStorage.getItem(`hato.receipt-draft.${id}`);
        if (raw) {
          try {
            const local = JSON.parse(raw) as Draft;
            nextDraft = { lines: { ...serverLines, ...local.lines }, supplierNote: local.supplierNote ?? '', attempt: local.attempt ?? null };
          } catch { void persistentStorage.removeItem(`hato.receipt-draft.${id}`); }
        }
      }
      setDraft(nextDraft);
      setDraftReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data barang gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const items = await getCycles();
      setCycles(items);
      const selected = params.cycleId || cycleId || items[0]?.id || '';
      setCycleId(selected);
      if (selected) await loadCycle(selected);
      else setLoading(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Daftar siklus gagal dimuat.');
      setLoading(false);
    }
  }, [cycleId, loadCycle, params.cycleId]);

  useFocusEffect(useCallback(() => { void loadInitial(); }, [loadInitial]));

  useEffect(() => {
    if (!storageKey || !draftReady || detail?.receipt?.status === 'confirmed') return;
    const timer = setTimeout(() => { void persistentStorage.setItem(storageKey, JSON.stringify(draft)); }, 250);
    return () => clearTimeout(timer);
  }, [detail?.receipt?.status, draft, draftReady, storageKey]);

  const summary = useMemo(() => {
    return detail?.items.reduce((acc, item) => {
      const line = draft.lines[item.productId];
      acc.products += 1;
      if (Number(line?.receivedQty ?? 0) > 0) acc.received += 1;
      if (Number(line?.damagedQty ?? 0) > 0 || Number(item.shortage ?? 0) > 0) acc.issues += 1;
      acc.cost += Number(line?.receivedQty ?? 0) * Number(line?.purchasePrice ?? 0);
      return acc;
    }, { products: 0, received: 0, issues: 0, cost: 0 }) ?? { products: 0, received: 0, issues: 0, cost: 0 };
  }, [detail, draft.lines]);

  function changeLine(productId: string, field: keyof Line, value: string) {
    setDraft((current) => ({ ...current, lines: { ...current.lines, [productId]: { ...current.lines[productId], [field]: field === 'notes' ? value : value.replace(',', '.') } }, attempt: null }));
    setError(''); setSuccess('');
  }

  function validate() {
    if (!detail) return 'Data barang belum tersedia.';
    for (const item of detail.items) {
      const line = draft.lines[item.productId];
      if (!line || !/^\d+(?:\.\d{1,2})?$/.test(line.receivedQty) || !/^\d+(?:\.\d{1,2})?$/.test(line.damagedQty) || !/^\d+(?:\.\d{1,2})?$/.test(line.purchasePrice)) return `Periksa angka ${item.productName}.`;
      if (Number(line.damagedQty) > Number(line.receivedQty)) return `Jumlah rusak ${item.productName} melebihi barang diterima.`;
      if (item.unit === 'bungkus' && (!Number.isInteger(Number(line.receivedQty)) || !Number.isInteger(Number(line.damagedQty)))) return `${item.productName} harus berupa bungkus utuh.`;
    }
    return '';
  }

  async function saveDraft() {
    if (!canMutate || !detail || detail.receipt?.status === 'confirmed') return;
    const validation = validate();
    if (validation) { setError(validation); return; }
    const payload = { cycleId: detail.cycleId, expectedVersion: detail.cycleVersion, supplierNote: draft.supplierNote.trim() || null, items: detail.items.map((item) => ({ productId: item.productId, ...draft.lines[item.productId], notes: draft.lines[item.productId].notes.trim() || null })) };
    const signature = JSON.stringify(payload);
    const attempt = draft.attempt?.signature === signature ? draft.attempt : { signature, key: newIdempotencyKey() };
    const persisted = { ...draft, attempt };
    setDraft(persisted);
    await persistentStorage.setItem(storageKey, JSON.stringify(persisted));
    setSaving('draft'); setError(''); setSuccess('');
    try {
      await saveReceiptDraft(payload, { idempotencyKey: attempt.key });
      await persistentStorage.removeItem(storageKey);
      setDraftReady(false);
      setSuccess('Draf penerimaan tersimpan. Periksa lagi sebelum konfirmasi.');
      await loadCycle(cycleId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Draf gagal disimpan. Isian tetap tersedia.'); }
    finally { setSaving(null); }
  }

  async function confirm() {
    if (!canMutate || !detail) return;
    setSaving('confirm'); setError(''); setSuccess('');
    try {
      await confirmReceipt(detail.cycleId, detail.cycleVersion, { idempotencyKey: newIdempotencyKey() });
      setConfirming(false);
      setSuccess('Barang datang dikonfirmasi. Stok fisik kini aktif.');
      await loadCycle(cycleId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Penerimaan gagal dikonfirmasi.'); }
    finally { setSaving(null); }
  }

  async function advanceOrder(order: Order) {
    if (!canMutate) return;
    const next = ({ pending: 'confirmed', confirmed: 'shipped', shipped: 'delivered' } as const)[order.orderStatus as 'pending' | 'confirmed' | 'shipped'];
    if (!next) return;
    setSaving(order.id); setError(''); setSuccess('');
    try {
      await updateOrderFulfillment(order.id, { expectedVersion: order.version ?? 0, status: next }, { idempotencyKey: newIdempotencyKey() });
      setSuccess(next === 'confirmed' ? 'Pesanan dikonfirmasi.' : next === 'shipped' ? 'Pesanan ditandai keluar.' : 'Pesanan ditandai diterima.');
      await loadCycle(cycleId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Status distribusi gagal diperbarui.'); }
    finally { setSaving(null); }
  }

  if (loading && !detail) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadCycle(cycleId); }} tintColor="#047857" />}>
      <Text style={styles.eyebrow}>BARANG MINGGUAN</Text><Text style={styles.title}>Penerimaan dan distribusi</Text><Text style={styles.muted}>Catat barang yang benar-benar datang sebelum membagikannya.</Text>
      {operationalSchema === false ? <View style={styles.warningBox}><Text style={styles.warningText}>Mode baca aktif. Penerimaan dan perubahan status distribusi dinonaktifkan sampai schema operasional diperbarui.</Text></View> : null}
      {cycles.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{cycles.map((cycle) => <Pressable key={cycle.id} onPress={() => { setCycleId(cycle.id); setDetail(null); setLoading(true); setDraftReady(false); void loadCycle(cycle.id); }} style={[styles.chip, cycleId === cycle.id && styles.chipActive]}><Text style={[styles.chipText, cycleId === cycle.id && styles.chipTextActive]}>{cycle.label}</Text></Pressable>)}</ScrollView> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}{success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}
      {!detail ? <ActivityIndicator style={styles.loader} color="#047857" /> : <>
        <View style={styles.summary}><Metric label="Produk" value={String(summary.products)} /><Metric label="Tercatat datang" value={String(summary.received)} /><Metric label="Bermasalah" value={String(summary.issues)} danger={summary.issues > 0} /><Metric label="Modal" value={formatCurrency(summary.cost)} /></View>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Penerimaan per produk</Text><Text style={styles.muted}>Rencana dan jumlah tetap dipisah per satuan.</Text></View><Text style={styles.status}>{detail.receipt?.status === 'confirmed' ? 'Dikonfirmasi' : detail.receipt?.status === 'draft' ? 'Draf' : 'Belum dicatat'}</Text></View>
        <View style={styles.grouped}>{detail.items.map((item) => { const line = draft.lines[item.productId]; const locked = !canMutate || detail.receipt?.status === 'confirmed'; return <View key={item.productId} style={styles.product}><Text style={styles.productName}>{item.productName}</Text><Text style={styles.muted}>Rencana {Number(item.capacity ?? 0).toLocaleString('id-ID')} {item.unit}{item.source === 'received' ? ` · fisik tersisa ${Number(item.physicalRemaining ?? 0).toLocaleString('id-ID')} ${item.unit}` : ''}</Text>{Number(item.shortage ?? 0) > 0 ? <Text style={styles.issue}>Kurang {Number(item.shortage).toLocaleString('id-ID')} {item.unit}</Text> : null}<View style={styles.inputs}><NumberField label="Diterima" value={line?.receivedQty ?? ''} unit={item.unit} disabled={locked} onChange={(value) => changeLine(item.productId, 'receivedQty', value)} /><NumberField label="Rusak" value={line?.damagedQty ?? ''} unit={item.unit} disabled={locked} onChange={(value) => changeLine(item.productId, 'damagedQty', value)} /><NumberField label="Harga beli/unit" value={line?.purchasePrice ?? ''} unit="Rp" disabled={locked} onChange={(value) => changeLine(item.productId, 'purchasePrice', value)} /></View></View>})}</View>
        <Text style={styles.label}>Catatan supplier <Text style={styles.optional}>(opsional)</Text></Text><TextInput editable={canMutate && detail.receipt?.status !== 'confirmed'} value={draft.supplierNote} onChangeText={(value) => setDraft((current) => ({ ...current, supplierNote: value, attempt: null }))} multiline style={[styles.input, styles.noteInput]} />
        {detail.receipt?.status !== 'confirmed' ? <View style={styles.actions}><Pressable disabled={!canMutate || Boolean(saving)} onPress={() => void saveDraft()} style={[styles.secondaryButton, (!canMutate || saving) && styles.disabled]}><Text style={styles.secondaryText}>{saving === 'draft' ? 'Menyimpan…' : 'Simpan draf'}</Text></Pressable><Pressable disabled={!canMutate || detail.receipt?.status !== 'draft' || Boolean(saving)} onPress={() => setConfirming(true)} style={[styles.primaryButton, (!canMutate || detail.receipt?.status !== 'draft' || saving) && styles.disabled]}><Text style={styles.primaryText}>Konfirmasi barang datang</Text></Pressable></View> : null}
        {confirming ? <View style={styles.confirmBox}><Text style={styles.confirmTitle}>Konfirmasi barang datang?</Text><Text style={styles.confirmText}>Setelah dikonfirmasi, jumlah diterima, rusak, dan harga beli tidak dapat diubah.</Text>{summary.issues > 0 ? <Text style={styles.issue}>Ada produk dengan selisih atau kerusakan. Catatan itu akan tetap terlihat.</Text> : null}<View style={styles.actions}><Pressable onPress={() => setConfirming(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Periksa lagi</Text></Pressable><Pressable disabled={Boolean(saving)} onPress={() => void confirm()} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryText}>{saving === 'confirm' ? 'Mengonfirmasi…' : 'Ya, konfirmasi'}</Text></Pressable></View></View> : null}
        <View style={styles.distribution}><Text style={styles.sectionTitle}>Distribusi pesanan lengkap</Text><Text style={styles.muted}>Barang hanya dapat ditandai keluar setelah penerimaan dikonfirmasi.</Text><View style={styles.orderList}>{orders.map((order) => { const label = order.orderStatus === 'pending' ? 'Konfirmasi pesanan' : order.orderStatus === 'confirmed' ? 'Tandai keluar' : order.orderStatus === 'shipped' ? 'Tandai diterima' : null; const disabled = !canMutate || Boolean(saving) || (order.orderStatus === 'confirmed' && detail.receipt?.status !== 'confirmed'); return <View key={order.id} style={styles.orderRow}><View style={styles.flex}><Text style={styles.orderName}>{order.memberName || order.member?.name || 'Anggota'}</Text><Text style={styles.muted}>{order.items?.length ?? 0} produk · {formatCurrency(order.totalAmount)}</Text><Text style={styles.orderStatus}>{statusLabel(order.orderStatus)}</Text></View>{label ? <Pressable disabled={disabled} onPress={() => void advanceOrder(order)} style={[styles.smallButton, disabled && styles.disabled]}><Text style={styles.smallButtonText}>{saving === order.id ? 'Memproses…' : label}</Text></Pressable> : null}</View>})}{orders.length === 0 ? <Text style={styles.empty}>Belum ada pesanan aktif.</Text> : null}</View></View>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function NumberField({ label, value, unit, disabled, onChange }: { label: string; value: string; unit: string; disabled: boolean; onChange: (value: string) => void }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputRow}><TextInput editable={!disabled} keyboardType={unit === 'bungkus' ? 'number-pad' : 'decimal-pad'} value={value} onChangeText={onChange} style={styles.numberInput} /><Text style={styles.unit}>{unit}</Text></View></View>; }
function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, danger && styles.red]}>{value}</Text></View>; }
function statusLabel(status: string) { return status === 'pending' ? 'Menunggu' : status === 'confirmed' ? 'Siap dibagikan' : status === 'shipped' ? 'Sudah keluar' : 'Diterima'; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, paddingBottom: 48 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  eyebrow: { color: '#047857', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }, title: { marginTop: 3, color: '#0f172a', fontSize: 23, fontWeight: '800' }, muted: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  chips: { gap: 8, paddingVertical: 14 }, chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 22, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' }, chipActive: { backgroundColor: '#065f46', borderColor: '#065f46' }, chipText: { color: '#475569', fontSize: 12, fontWeight: '700' }, chipTextActive: { color: '#fff' },
  loader: { marginTop: 40 }, summary: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#fff', padding: 12 }, metricLabel: { color: '#64748b', fontSize: 10, fontWeight: '700' }, metricValue: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginTop: 3 }, red: { color: '#9f1239' },
  sectionHeader: { marginTop: 20, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' }, status: { color: '#065f46', fontSize: 11, fontWeight: '800', backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  grouped: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' }, product: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, productName: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, issue: { color: '#9f1239', fontSize: 12, fontWeight: '700', marginTop: 4 }, inputs: { marginTop: 10, gap: 10 }, field: { flex: 1 }, fieldLabel: { color: '#475569', fontSize: 11, fontWeight: '700', marginBottom: 5 }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, numberInput: { minHeight: 46, flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, backgroundColor: '#fff', paddingHorizontal: 11, color: '#0f172a', fontSize: 14 }, unit: { width: 58, color: '#64748b', fontSize: 11 },
  label: { color: '#334155', fontSize: 12, fontWeight: '700', marginTop: 16, marginBottom: 6 }, optional: { color: '#64748b', fontWeight: '400' }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, backgroundColor: '#fff', padding: 11, color: '#0f172a' }, noteInput: { minHeight: 70, textAlignVertical: 'top' },
  actions: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, primaryButton: { minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: '#065f46', borderRadius: 10, paddingHorizontal: 14 }, primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' }, secondaryButton: { minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14 }, secondaryText: { color: '#334155', fontSize: 12, fontWeight: '800' }, disabled: { opacity: 0.42 },
  confirmBox: { marginTop: 14, borderWidth: 1, borderColor: '#fcd34d', borderRadius: 12, backgroundColor: '#fffbeb', padding: 14 }, confirmTitle: { color: '#78350f', fontSize: 15, fontWeight: '800' }, confirmText: { marginTop: 4, color: '#78350f', fontSize: 12, lineHeight: 18 },
  distribution: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' }, orderList: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }, orderRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, flex: { flex: 1 }, orderName: { color: '#0f172a', fontSize: 14, fontWeight: '800' }, orderStatus: { color: '#475569', fontSize: 11, fontWeight: '700', marginTop: 3 }, smallButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }, smallButtonText: { color: '#065f46', fontSize: 11, fontWeight: '800' }, empty: { paddingVertical: 24, textAlign: 'center', color: '#64748b', fontSize: 12 },
  errorBox: { marginTop: 12, padding: 11, borderRadius: 9, backgroundColor: '#fff1f2' }, errorText: { color: '#9f1239', fontSize: 12, lineHeight: 18 }, successBox: { marginTop: 12, padding: 11, borderRadius: 9, backgroundColor: '#ecfdf5' }, successText: { color: '#065f46', fontSize: 12, lineHeight: 18 },
  warningBox: { marginTop: 12, padding: 11, borderRadius: 9, borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fffbeb' }, warningText: { color: '#78350f', fontSize: 12, lineHeight: 18 },
});
