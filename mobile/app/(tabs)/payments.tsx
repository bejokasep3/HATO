import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { getCycles, getGroups, getReceivables } from '@/lib/api';
import { Cycle, Group, ReceivablesResponse } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function PaymentsScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReceivablesResponse | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextCycleId = cycleId, nextGroupId = groupId) => {
    setError('');
    try {
      const [result, cycleItems, groupItems] = await Promise.all([
        getReceivables({ page: 1, pageSize: 100, cycleId: nextCycleId || undefined, groupId: nextGroupId || undefined }),
        getCycles(),
        getGroups(),
      ]);
      setData(result);
      setCycles(cycleItems);
      setGroups(groupItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Piutang gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cycleId, groupId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function chooseCycle(value: string) {
    setCycleId(value);
    setLoading(true);
    void load(value, groupId);
  }

  function chooseGroup(value: string) {
    setGroupId(value);
    setLoading(true);
    void load(cycleId, value);
  }

  const header = (
    <View>
      <View style={styles.summary}>
        <Text style={styles.eyebrow}>SISA TAGIHAN DIKETAHUI</Text>
        <Text style={styles.total}>{data ? formatCurrency(data.totalKnownOutstanding) : 'Belum tersedia'}</Text>
        <Text style={styles.muted}>{data?.totalCount ?? 0} pesanan belum lunas</Text>
        {data?.totalIncomplete ? <Text style={styles.warning}>{data.unreconciledOrderCount} saldo lama belum diverifikasi. Total belum lengkap.</Text> : null}
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Siklus</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="Semua" active={!cycleId} onPress={() => chooseCycle('')} />
          {cycles.map((cycle) => <FilterChip key={cycle.id} label={cycle.label} active={cycleId === cycle.id} onPress={() => chooseCycle(cycle.id)} />)}
        </ScrollView>
        <Text style={styles.filterLabel}>Sub-grup</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="Semua" active={!groupId} onPress={() => chooseGroup('')} />
          {groups.map((group) => <FilterChip key={group.id} label={group.name} active={groupId === group.id} onPress={() => chooseGroup(group.id)} />)}
        </ScrollView>
      </View>
      {error ? <Pressable onPress={() => void load()} style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Text style={styles.retry}>Coba lagi</Text></Pressable> : null}
      <Text style={styles.heading}>Pesanan belum lunas</Text>
    </View>
  );

  if (loading && !data) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /></View>;

  return (
    <FlatList
      style={styles.container}
      data={data?.items ?? []}
      keyExtractor={(item) => item.orderId}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#047857" />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/payments/[id]', params: { id: item.orderId } })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text style={styles.name}>{item.memberName}</Text>
            <Text style={styles.muted}>{item.cycleLabel} · dibayar {formatCurrency(item.paidAmount)}</Text>
          </View>
          <View style={styles.amountBlock}><Text style={styles.amountLabel}>Sisa</Text><Text style={styles.amount}>{formatCurrency(item.outstandingAmount)}</Text></View>
          <SymbolView name="chevron.right" size={15} tintColor="#64748b" fallback={<Text style={styles.muted}>{'>'}</Text>} />
        </Pressable>
      )}
      ListEmptyComponent={!loading ? <View style={styles.empty}><SymbolView name="checkmark.circle.fill" size={30} tintColor="#047857" fallback={<Text>✓</Text>} /><Text style={styles.emptyTitle}>Tidak ada piutang</Text><Text style={styles.muted}>Semua saldo yang sudah diverifikasi telah lunas.</Text></View> : null}
    />
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  summary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 18 },
  eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  total: { marginTop: 4, color: '#9f1239', fontSize: 28, fontWeight: '800' },
  muted: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  warning: { marginTop: 10, backgroundColor: '#fffbeb', color: '#78350f', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 18 },
  filterSection: { marginTop: 16, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  filterLabel: { color: '#334155', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
  chipActive: { backgroundColor: '#065f46', borderColor: '#065f46' },
  chipText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  heading: { marginTop: 20, marginBottom: 8, color: '#0f172a', fontSize: 17, fontWeight: '800' },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pressed: { opacity: 0.66 },
  flex: { flex: 1 },
  name: { color: '#0f172a', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  amountBlock: { alignItems: 'flex-end' },
  amountLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  amount: { color: '#9f1239', fontSize: 14, fontWeight: '800', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 42, gap: 6 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  errorBox: { marginTop: 12, backgroundColor: '#fff1f2', borderRadius: 10, padding: 12, minHeight: 52 },
  errorText: { color: '#9f1239', fontSize: 12 },
  retry: { color: '#065f46', fontSize: 12, fontWeight: '800', marginTop: 5 },
});
