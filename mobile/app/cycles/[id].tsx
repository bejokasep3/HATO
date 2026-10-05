import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { closeCycle, confirmSupplierRecap, getCyclePrices, getDashboard, getSupplierRecap, openCycle, updateCycleTargets } from '@/lib/api';
import { DashboardData, SupplierRecapResponse, WeeklyPrice } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

function allocationFor(recap: SupplierRecapResponse) {
  if (recap.confirmed) return Object.fromEntries(recap.confirmed.items.map((item) => [item.productId, item.quantity]));
  const values = Object.fromEntries(recap.items.map((item) => [item.productId, item.demand]));
  for (const group of recap.groups) {
    const lines = recap.items.filter((item) => item.groupCode === group.groupCode);
    const deficit = Math.max(0, Number(group.target) - Number(group.demand));
    if (lines[0] && deficit > 0) values[lines[0].productId] = (Number(values[lines[0].productId]) + deficit).toFixed(2);
  }
  return values;
}

export default function CycleDetailScreen() {
  const { operationalSchema } = useAuth();
  const canMutate = operationalSchema === true;
  const params = useLocalSearchParams<{ id: string }>();
  const cycleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [prices, setPrices] = useState<WeeklyPrice[]>([]);
  const [recap, setRecap] = useState<SupplierRecapResponse | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [ayamTarget, setAyamTarget] = useState('10');
  const [tahuTarget, setTahuTarget] = useState('10');
  const [reason, setReason] = useState('Penyesuaian target minggu ini');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!cycleId) return;
    setError('');
    try {
      const [summary, priceRows, recapData] = await Promise.all([getDashboard(cycleId), getCyclePrices(cycleId), getSupplierRecap(cycleId)]);
      setDashboard(summary);
      setPrices(priceRows);
      setRecap(recapData);
      setAllocations(allocationFor(recapData));
      setAyamTarget(recapData.groups.find((group) => group.groupCode === 'AYAM')?.target ?? '10');
      setTahuTarget(recapData.groups.find((group) => group.groupCode === 'TAHU')?.target ?? '10');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Siklus gagal dimuat.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [cycleId]);

  useEffect(() => { void load(); }, [load]);
  const cycle = dashboard?.currentCycle;

  const allocationErrors = useMemo(() => {
    if (!recap) return ['Rekap belum tersedia'];
    const errors: string[] = [];
    for (const item of recap.items) if (Number(allocations[item.productId] ?? 0) < Number(item.demand)) errors.push(`${item.productName} di bawah pesanan`);
    for (const group of recap.groups) {
      const actual = recap.items.filter((item) => item.groupCode === group.groupCode).reduce((sum, item) => sum + Number(allocations[item.productId] ?? 0), 0);
      const required = Math.max(Number(group.target), Number(group.demand));
      if (Math.abs(actual - required) > 0.001) errors.push(`Total ${group.groupCode.toLowerCase()} harus ${required.toLocaleString('id-ID')}`);
    }
    return errors;
  }, [allocations, recap]);

  async function changeState(next: 'open' | 'closed') {
    if (!canMutate || !cycleId || cycle?.version === undefined) return;
    setSaving(next);
    try { if (next === 'open') await openCycle(cycleId, cycle.version); else await closeCycle(cycleId, cycle.version); await load(); }
    catch (cause) { Alert.alert('Gagal', cause instanceof Error ? cause.message : 'Status tidak berubah.'); }
    finally { setSaving(''); }
  }

  async function saveTargets() {
    if (!canMutate || !cycleId || cycle?.version === undefined) return;
    setSaving('targets');
    try {
      await updateCycleTargets(cycleId, { expectedVersion: cycle.version, reason, targets: [{ groupCode: 'AYAM', quantity: Number(ayamTarget.replace(',', '.')).toFixed(2) }, { groupCode: 'TAHU', quantity: Number(tahuTarget).toFixed(2) }] });
      await load();
      Alert.alert('Tersimpan', 'Target minggu ini diperbarui.');
    } catch (cause) { Alert.alert('Gagal', cause instanceof Error ? cause.message : 'Target tidak tersimpan.'); }
    finally { setSaving(''); }
  }

  async function lockRecap() {
    if (!canMutate || !cycleId || !recap || allocationErrors.length) return;
    setSaving('recap');
    try {
      await confirmSupplierRecap(cycleId, { expectedVersion: recap.cycleVersion, items: recap.items.map((item) => ({ productId: item.productId, quantity: Number(allocations[item.productId] ?? 0).toFixed(2) })) });
      await load();
      Alert.alert('Rekap dikunci', 'Snapshot pembelian supplier sudah tersimpan.');
    } catch (cause) { Alert.alert('Gagal', cause instanceof Error ? cause.message : 'Rekap tidak tersimpan.'); }
    finally { setSaving(''); }
  }

  if (loading && !cycle) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /><Text style={styles.muted}>Memuat siklus…</Text></View>;
  if (!cycle || !recap) return <View style={styles.center}><Text style={styles.title}>Siklus belum dapat dibuka</Text><Text style={styles.muted}>{error}</Text><Pressable onPress={() => void load()} style={styles.primary}><Text style={styles.primaryText}>Coba lagi</Text></Pressable></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} keyboardShouldPersistTaps="handled">
      {operationalSchema === false ? <View style={styles.warning}><Text style={styles.warningText}>Mode baca aktif. Perubahan siklus dinonaktifkan sampai schema operasional diperbarui.</Text></View> : null}
      <View style={styles.header}><View style={styles.rowBetween}><Text style={styles.title}>{cycle.label}</Text><Text style={styles.phase}>{cycle.periodState ?? 'histori'}</Text></View><Text style={styles.muted}>{formatDate(cycle.periodStart)} sampai {formatDate(cycle.periodEnd ?? cycle.deliveryDate)} · versi {cycle.version}</Text><View style={styles.actions}>{cycle.periodState === 'draft' ? <Pressable disabled={!canMutate || Boolean(saving)} onPress={() => void changeState('open')} style={[styles.primary, !canMutate && styles.disabled]}><Text style={styles.primaryText}>Buka siklus</Text></Pressable> : null}{cycle.periodState === 'open' ? <Pressable disabled={!canMutate || Boolean(saving)} onPress={() => Alert.alert('Tutup siklus?', 'Pesanan baru akan ditolak, tetapi pembayaran tetap dapat dicatat.', [{ text: 'Batal', style: 'cancel' }, { text: 'Tutup', style: 'destructive', onPress: () => void changeState('closed') }])} style={[styles.secondary, !canMutate && styles.disabled]}><Text style={styles.secondaryText}>Tutup siklus</Text></Pressable> : null}</View></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Target minggu</Text><Text style={styles.muted}>Gabungan semua varian ayam dan tahu.</Text><View style={styles.targetGrid}><View style={styles.targetField}><Text style={styles.label}>Ayam (kg)</Text><TextInput editable={canMutate && cycle.periodState !== 'closed'} keyboardType="decimal-pad" value={ayamTarget} onChangeText={setAyamTarget} style={styles.input} /></View><View style={styles.targetField}><Text style={styles.label}>Tahu (bungkus)</Text><TextInput editable={canMutate && cycle.periodState !== 'closed'} keyboardType="number-pad" value={tahuTarget} onChangeText={setTahuTarget} style={styles.input} /></View></View>{cycle.periodState !== 'closed' ? <><TextInput editable={canMutate} value={reason} onChangeText={setReason} placeholder="Alasan perubahan" style={styles.inputWide} /><Pressable disabled={!canMutate || saving === 'targets'} onPress={() => void saveTargets()} style={[styles.secondary, !canMutate && styles.disabled]}><Text style={styles.secondaryText}>{saving === 'targets' ? 'Menyimpan…' : 'Simpan target'}</Text></Pressable></> : null}</View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Harga minggu ini</Text><View style={styles.grouped}>{prices.map((price) => <View key={price.id} style={styles.listRow}><View><Text style={styles.rowTitle}>{price.productName}</Text><Text style={styles.muted}>Konsumen {formatCurrency(price.consumerPrice)} · Pedagang {formatCurrency(price.traderPrice)}</Text></View></View>)}</View></View>

      <View style={styles.section}><View style={styles.rowBetween}><View><Text style={styles.sectionTitle}>Rekap supplier</Text><Text style={styles.muted}>Bagi minimum kelompok ke tiap varian.</Text></View>{recap.confirmed ? <Text style={styles.locked}>Dikunci</Text> : null}</View><View style={styles.grouped}>{recap.groups.map((group) => <View key={group.groupCode} style={styles.group}><Text style={styles.rowTitle}>{group.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'} · target {Number(group.target).toLocaleString('id-ID')}</Text>{recap.items.filter((item) => item.groupCode === group.groupCode).map((item) => <View key={item.productId} style={styles.allocationRow}><View style={styles.flex}><Text style={styles.rowTitle}>{item.productName}</Text><Text style={styles.muted}>Pesanan {Number(item.demand).toLocaleString('id-ID')} {item.unit}</Text></View>{recap.confirmed ? <Text style={styles.amount}>{Number(recap.confirmed.items.find((line) => line.productId === item.productId)?.quantity ?? 0).toLocaleString('id-ID')} {item.unit}</Text> : <View style={styles.quantity}><TextInput editable={canMutate} keyboardType={item.unit === 'bungkus' ? 'number-pad' : 'decimal-pad'} value={allocations[item.productId] ?? ''} onChangeText={(value) => setAllocations((current) => ({ ...current, [item.productId]: value.replace(',', '.') }))} style={styles.quantityInput} /><Text style={styles.muted}>{item.unit}</Text></View>}</View>)}</View>)}</View>{allocationErrors.map((message) => <Text key={message} style={styles.error}>{message}</Text>)}{!recap.confirmed ? <Pressable disabled={!canMutate || allocationErrors.length > 0 || recap.periodState !== 'open' || saving === 'recap'} onPress={() => Alert.alert('Kunci rekap?', 'Target, nama produk, dan jumlah pembelian akan menjadi snapshot.', [{ text: 'Batal', style: 'cancel' }, { text: 'Kunci', onPress: () => void lockRecap() }])} style={[styles.primary, (!canMutate || allocationErrors.length > 0 || recap.periodState !== 'open') && styles.disabled]}><Text style={styles.primaryText}>{saving === 'recap' ? 'Mengunci…' : 'Konfirmasi rekap'}</Text></Pressable> : <Pressable onPress={() => void Share.share({ message: recap.confirmed!.whatsappText })} style={styles.secondary}><Text style={styles.secondaryText}>Bagikan rekap</Text></Pressable>}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, paddingBottom: 48, gap: 24 }, center: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc' }, header: { paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#cbd5e1', gap: 8 },
  title: { flex: 1, color: '#0f172a', fontSize: 24, fontWeight: '800' }, phase: { color: '#065f46', backgroundColor: '#d1fae5', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '700' }, muted: { color: '#64748b', fontSize: 13, lineHeight: 18 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, actions: { flexDirection: 'row', gap: 10, marginTop: 8 }, primary: { minHeight: 44, backgroundColor: '#065f46', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12 }, primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' }, secondary: { minHeight: 44, borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12 }, secondaryText: { color: '#334155', fontSize: 14, fontWeight: '700' }, disabled: { opacity: 0.4 },
  section: { gap: 8 }, sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' }, targetGrid: { flexDirection: 'row', gap: 12, marginTop: 4 }, targetField: { flex: 1 }, label: { color: '#475569', fontSize: 13, fontWeight: '700' }, input: { minHeight: 44, marginTop: 6, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 9, backgroundColor: '#ffffff', paddingHorizontal: 12, color: '#0f172a', fontSize: 16 }, inputWide: { minHeight: 44, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 9, backgroundColor: '#ffffff', paddingHorizontal: 12, color: '#0f172a', fontSize: 14 },
  warning: { borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, backgroundColor: '#fffbeb', padding: 12 }, warningText: { color: '#78350f', fontSize: 12, lineHeight: 18 },
  grouped: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#cbd5e1' }, listRow: { minHeight: 56, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' }, rowTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' }, group: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#cbd5e1', paddingVertical: 14, gap: 8 }, allocationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }, flex: { flex: 1 }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 8 }, quantityInput: { minHeight: 44, width: 84, borderWidth: 1, borderColor: '#94a3b8', borderRadius: 9, backgroundColor: '#ffffff', paddingHorizontal: 10, color: '#0f172a', textAlign: 'right' }, amount: { color: '#0f172a', fontSize: 14, fontWeight: '800' }, locked: { color: '#065f46', fontSize: 12, fontWeight: '700' }, error: { color: '#be123c', fontSize: 12 },
});
