import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDashboard } from '@/lib/api';
import { DashboardData, TargetItem } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';

function phaseLabel(value?: string | null) {
  if (value === 'open') return 'Dibuka';
  if (value === 'draft') return 'Draf';
  if (value === 'closed') return 'Ditutup';
  return 'Perlu verifikasi';
}

function TargetRow({ target }: { target: TargetItem }) {
  if (target.status === 'unknown' || !target.progress || target.target === null || target.demand === null) {
    return <View style={styles.targetRow}><View><Text style={styles.rowTitle}>{target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</Text><Text style={styles.muted}>Target histori belum diverifikasi</Text></View></View>;
  }
  const reached = Number(target.progress.shortfall) === 0;
  const percentage = target.progress.percentage;
  return (
    <View style={styles.targetRow}>
      <View style={styles.rowBetween}><Text style={styles.rowTitle}>{target.groupCode === 'AYAM' ? 'Ayam' : 'Tahu'}</Text><Text style={[styles.statusText, reached ? styles.success : styles.warning]}>{percentage === null ? 'Tidak ditargetkan' : reached ? 'Tercapai' : `Kurang ${Number(target.progress.shortfall).toLocaleString('id-ID')} ${target.unit}`}</Text></View>
      <Text style={styles.targetNumber}>{Number(target.demand).toLocaleString('id-ID')} <Text style={styles.targetContext}>dari {Number(target.target).toLocaleString('id-ID')} {target.unit}</Text></Text>
      {percentage !== null ? <><View style={styles.track}><View style={[styles.fill, reached ? styles.fillSuccess : styles.fillWarning, { width: `${Math.min(100, percentage)}%` }]} /></View><View style={styles.rowBetween}><Text style={styles.caption}>Beli minimal {Number(target.progress.plannedPurchase).toLocaleString('id-ID')} {target.unit}</Text><Text style={styles.captionStrong}>{percentage}%</Text></View></> : null}
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [cycleId, setCycleId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (selected?: string) => {
    setError('');
    try {
      const result = await getDashboard(selected);
      setData(result);
      setCycleId(result.currentCycle?.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ringkasan gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { if (!loading) void load(cycleId); }, [cycleId, load, loading]));

  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /><Text style={styles.loadingText}>Memuat minggu ini…</Text></View>;
  if (error && !data) return <View style={styles.center}><Text style={styles.errorTitle}>Ringkasan belum dapat dimuat</Text><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Coba lagi</Text></Pressable></View>;
  if (!data?.hasCycle || !data.currentCycle) return <View style={styles.center}><Text style={styles.emptyTitle}>Belum ada siklus</Text><Text style={styles.errorText}>Buat siklus melalui web untuk mulai menerima pesanan.</Text></View>;

  const cycle = data.currentCycle;
  const finances = data.finances;
  const nextTitle = cycle.periodState === 'draft' ? 'Periksa harga lalu buka siklus' : !cycle.recapConfirmedAt ? 'Input pesanan dan siapkan rekap Selasa' : cycle.receiptStatus !== 'confirmed' ? 'Catat barang yang datang Kamis' : 'Pantau distribusi dan cicilan';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(cycleId); }} />} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Minggu ini</Text>
        <View style={styles.rowBetween}><Text style={styles.title}>{cycle.label}</Text><Text style={styles.phase}>{phaseLabel(cycle.periodState)}</Text></View>
        <Text style={styles.subtitle}>{formatDate(cycle.periodStart)}–{formatDate(cycle.periodEnd ?? cycle.deliveryDate)} · tiba {formatDate(cycle.deliveryDate)}</Text>
      </View>

      {data.allCycles.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cyclePicker}>{data.allCycles.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === cycle.id }} onPress={() => { setLoading(true); void load(item.id); }} style={({ pressed }) => [styles.cycleChip, item.id === cycle.id && styles.cycleChipActive, pressed && styles.pressed]}><Text style={[styles.cycleChipText, item.id === cycle.id && styles.cycleChipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView> : null}

      <View style={styles.actionSection}><Text style={styles.sectionLabel}>Langkah berikutnya</Text><Text style={styles.actionTitle}>{nextTitle}</Text><View style={styles.actionButtons}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/orders/new', params: { cycleId: cycle.id } })} disabled={cycle.periodState !== 'open'} style={({ pressed }) => [styles.primaryButton, cycle.periodState !== 'open' && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Input pesanan</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push(`/cycles/${cycle.id}`)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>Buka detail</Text></Pressable></View></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Target dan permintaan</Text><Text style={styles.sectionHint}>Target adalah pembelian minimum. Pesanan boleh melebihinya.</Text><View style={styles.grouped}>{data.targets.map((target) => <TargetRow key={target.groupCode} target={target} />)}</View></View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Uang masuk dan piutang</Text>{finances ? <View style={styles.grouped}><View style={styles.moneyRow}><Text style={styles.muted}>Nilai pesanan ({finances.orderCount})</Text><Text style={styles.moneyStrong}>{formatCurrency(finances.orderValue)}</Text></View><View style={styles.moneyRow}><Text style={styles.muted}>Pembayaran diterima</Text><Text style={[styles.moneyStrong, styles.success]}>{formatCurrency(finances.receivedPayments)}</Text></View><View style={styles.moneyRow}><Text style={styles.muted}>Sisa diketahui</Text><Text style={[styles.moneyStrong, styles.danger]}>{formatCurrency(finances.knownOutstanding)}</Text></View>{finances.totalIncomplete ? <Text style={styles.warningBox}>{finances.unknownBalanceCount} saldo lama belum diverifikasi. Total belum lengkap.</Text> : null}</View> : <Text style={styles.muted}>Ringkasan belum tersedia.</Text>}</View>

      <View style={styles.section}><Text style={styles.sectionTitle}>Giliran anggota</Text><Text style={styles.sectionHint}>{data.rotation ? `${data.rotation.orderedCount} dari ${data.rotation.scheduledCount} sudah memesan` : 'Belum tersedia'}</Text><View style={styles.grouped}>{data.rotation?.pendingMembers.slice(0, 5).map((member) => <View key={member.id} style={styles.memberRow}><View><Text style={styles.rowTitle}>{member.name}</Text><Text style={styles.muted}>{member.groupName}</Text></View><Text style={styles.warning}>Belum pesan</Text></View>)}{data.rotation?.pendingMembers.length === 0 ? <Text style={styles.successBox}>Semua anggota giliran sudah memesan.</Text> : null}</View></View>
      {error ? <Text accessibilityRole="alert" style={styles.warningBox}>Data sebelumnya ditampilkan. {error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, paddingBottom: 48, gap: 24 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 }, errorTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700' }, errorText: { marginTop: 8, color: '#64748b', fontSize: 14, lineHeight: 20, textAlign: 'center' }, emptyTitle: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#cbd5e1', paddingBottom: 16 }, eyebrow: { color: '#047857', fontSize: 13, fontWeight: '700' }, title: { flex: 1, color: '#0f172a', fontSize: 26, fontWeight: '800', marginTop: 4 }, subtitle: { color: '#475569', fontSize: 13, marginTop: 6 }, phase: { color: '#065f46', backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, cyclePicker: { gap: 8 }, cycleChip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 14, backgroundColor: '#ffffff' }, cycleChipActive: { backgroundColor: '#065f46', borderColor: '#065f46' }, cycleChipText: { color: '#475569', fontSize: 13, fontWeight: '700' }, cycleChipTextActive: { color: '#ffffff' },
  actionSection: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#cbd5e1', paddingBottom: 24 }, sectionLabel: { color: '#047857', fontSize: 13, fontWeight: '700' }, actionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '800', lineHeight: 27, marginTop: 6 }, actionButtons: { flexDirection: 'row', gap: 10, marginTop: 16 }, primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#065f46', justifyContent: 'center', alignItems: 'center' }, primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' }, secondaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }, secondaryButtonText: { color: '#334155', fontSize: 14, fontWeight: '700' }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.4 },
  section: { gap: 8 }, sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' }, sectionHint: { color: '#64748b', fontSize: 13, lineHeight: 18 }, grouped: { marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#cbd5e1' }, targetRow: { paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0', gap: 8 }, rowTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700' }, muted: { color: '#64748b', fontSize: 13 }, statusText: { fontSize: 12, fontWeight: '700' }, success: { color: '#047857' }, warning: { color: '#92400e', fontSize: 12, fontWeight: '700' }, danger: { color: '#be123c' }, targetNumber: { color: '#0f172a', fontSize: 24, fontWeight: '800' }, targetContext: { color: '#64748b', fontSize: 13, fontWeight: '400' }, track: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }, fill: { height: 8, borderRadius: 999 }, fillSuccess: { backgroundColor: '#047857' }, fillWarning: { backgroundColor: '#d97706' }, caption: { color: '#64748b', fontSize: 12 }, captionStrong: { color: '#334155', fontSize: 12, fontWeight: '700' },
  moneyRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' }, moneyStrong: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, memberRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' }, warningBox: { backgroundColor: '#fffbeb', color: '#78350f', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 19, overflow: 'hidden' }, successBox: { color: '#065f46', paddingVertical: 16, fontSize: 14, fontWeight: '700' },
});
