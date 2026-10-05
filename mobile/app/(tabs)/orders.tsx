import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getOrders } from '@/lib/api';
import { Order } from '@/lib/types';
import { formatCurrency, getStatusColor, getStatusLabel } from '@/lib/utils';
import { SymbolView } from 'expo-symbols';

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const router = useRouter();

  const loadOrders = async () => {
    try {
      const data = await getOrders();
      setOrders(data);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Pesanan gagal dimuat.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(React.useCallback(() => { void loadOrders(); }, []));

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const filteredOrders = orders.filter(o => {
    const status = o.paymentStatus.toLowerCase();
    if (filter === 'paid') return status === 'paid';
    if (filter === 'unpaid') return status === 'unpaid' || status === 'partial';
    return true;
  });

  const renderItem = ({ item }: { item: Order }) => {
    const isPaid = item.paymentStatus.toLowerCase() === 'paid';
    const orderColor = getStatusColor(item.orderStatus);

    return (
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/payments/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <Text style={styles.cardTitle}>{item.memberName || item.member?.name || 'Anggota'}</Text>
            <Text style={styles.subtitleText}>{item.groupName || item.member?.groupName || '-'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: orderColor.bg }]}>
            <Text style={[styles.badgeText, { color: orderColor.text }]}>{getStatusLabel(item.orderStatus)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.totalText}>{formatCurrency(item.totalAmount)}</Text>
          <View style={[styles.paymentBadge, isPaid ? styles.bgGreen : styles.bgRed]}>
            <Text style={styles.paymentText}>
              {isPaid ? 'LUNAS' : item.paymentStatus === 'partial' ? 'CICILAN' : item.paymentStatus === 'unverified' ? 'BELUM DIVERIFIKASI' : 'BELUM BAYAR'}
            </Text>
          </View>
        </View>
        <Text style={styles.paymentLink}>Buka riwayat pembayaran</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {loadError ? (
        <TouchableOpacity onPress={loadOrders} accessibilityRole="button" style={styles.filterContainer}>
          <Text style={styles.filterText}>{loadError} · Coba lagi</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.filterContainer}>
        {(['all', 'unpaid', 'paid'] as const).map(f => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Semua' : f === 'paid' ? 'Lunas' : 'Belum Bayar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#059669" /></View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Tidak ada pesanan</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/orders/new')}>
        <SymbolView name="plus" size={24} tintColor="#ffffff" fallback={<Text style={styles.fabText}>+</Text>} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8 },
  filterChipActive: { backgroundColor: '#059669' },
  filterText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#ffffff' },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  cardPressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  memberInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  subtitleText: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9' },
  totalText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  paymentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  paymentText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  paymentLink: { minHeight: 44, paddingTop: 14, color: '#065f46', fontSize: 13, fontWeight: '700' },
  bgGreen: { backgroundColor: '#059669' },
  bgRed: { backgroundColor: '#e11d48' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 32 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  fabText: { fontSize: 32, color: '#ffffff', lineHeight: 32, marginTop: -4 }
});
