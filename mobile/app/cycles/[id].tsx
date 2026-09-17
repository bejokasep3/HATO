import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getCycleDetail, getCyclePrices, getCycleRotation, updateCycleStatus } from '@/lib/api';
import { Cycle, WeeklyPrice, RotationSchedule } from '@/lib/types';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { SymbolView } from 'expo-symbols';

export default function CycleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [prices, setPrices] = useState<WeeklyPrice[]>([]);
  const [rotations, setRotations] = useState<RotationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cycleId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  const loadData = async () => {
    if (!cycleId) return;
    try {
      const [cycleData, priceData, rotationData] = await Promise.all([
        getCycleDetail(cycleId),
        getCyclePrices(cycleId).catch(() => []),
        getCycleRotation(cycleId).catch(() => [])
      ]);
      setCycle(cycleData);
      setPrices(priceData || []);
      setRotations(rotationData || []);
    } catch (error) {
      console.error('Failed to load cycle detail:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cycleId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleShare = async () => {
    if (!cycle) return;
    try {
      const message = `*REKAP SIKLUS: ${cycle.label}*\n` +
        `Periode: ${formatDate(cycle.periodStart)} s/d ${formatDate(cycle.deliveryDate)}\n` +
        `Status: ${getStatusLabel(cycle.status)}\n` +
        `Deadline: ${formatDate(cycle.orderDeadline)}`;
      await Share.share({ message });
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!cycleId) return;
    try {
      await updateCycleStatus(cycleId, newStatus);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>;
  }

  if (!cycle) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Siklus tidak ditemukan</Text>
      </View>
    );
  }

  const cycleColor = getStatusColor(cycle.status);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{cycle.label}</Text>
          <View style={[styles.badge, { backgroundColor: cycleColor.bg }]}>
            <Text style={[styles.badgeText, { color: cycleColor.text }]}>{getStatusLabel(cycle.status)}</Text>
          </View>
        </View>
        <Text style={styles.dates}>
          Mulai: {formatDate(cycle.periodStart)} • Deadline: {formatDate(cycle.orderDeadline)} • Distribusi: {formatDate(cycle.deliveryDate)}
        </Text>
      </View>

      {/* Action Buttons based on status */}
      <View style={styles.actionsContainer}>
        {cycle.status === 'draft' && (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => handleUpdateStatus('open')}>
            <Text style={styles.btnPrimaryText}>Buka Siklus (Open Order)</Text>
          </TouchableOpacity>
        )}
        {cycle.status === 'open' && (
          <TouchableOpacity style={styles.btnSecondary} onPress={() => handleUpdateStatus('closed')}>
            <Text style={styles.btnSecondaryText}>Tutup Pemesanan (Close Order)</Text>
          </TouchableOpacity>
        )}
        {cycle.status === 'closed' && (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => handleUpdateStatus('delivered')}>
            <Text style={styles.btnPrimaryText}>Tandai Barang Tiba (Delivered)</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.btnSecondary, { marginTop: 8 }]} 
          onPress={() => router.push('/inventory')}
        >
          <Text style={styles.btnSecondaryText}>📦 Penerimaan Barang & HPP</Text>
        </TouchableOpacity>
      </View>

      {/* Prices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daftar Harga Produk</Text>
        <View style={styles.tableCard}>
          {prices.map((p, i) => (
            <View key={p.id || i} style={[styles.tableRow, i > 0 && styles.tableRowBorder]}>
              <Text style={styles.colName}>{p.productName || 'Produk'}</Text>
              <Text style={styles.colPrice}>{formatCurrency(p.price)}</Text>
            </View>
          ))}
          {prices.length === 0 && <Text style={styles.emptyText}>Belum ada harga diset untuk siklus ini</Text>}
        </View>
      </View>

      {/* Rotation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jadwal Rotasi Anggota ({rotations.length})</Text>
        {rotations.map((r, i) => {
          const isOrdered = r.status === 'ordered' || r.member?.isOrdered;
          return (
            <View key={r.id || i} style={styles.rotationCard}>
              <View>
                <Text style={styles.rotationName}>{r.member?.name || 'Anggota'}</Text>
                <Text style={styles.rotationSub}>{r.member?.groupName || '-'}</Text>
              </View>
              {isOrdered ? (
                <View style={[styles.badge, styles.bgGreen]}>
                  <Text style={styles.badgeTextLight}>Sudah Pesan</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.bgAmber]}>
                  <Text style={styles.badgeTextLight}>Belum</Text>
                </View>
              )}
            </View>
          );
        })}
        {rotations.length === 0 && <Text style={styles.emptyText}>Belum ada rotasi yang dibuat</Text>}
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <SymbolView name="square.and.arrow.up" size={20} tintColor="#059669" fallback={<Text>Share</Text>} />
        <Text style={styles.shareBtnText}>Bagikan Ringkasan ke WhatsApp</Text>
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  headerCard: { backgroundColor: '#ffffff', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextLight: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
  dates: { fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 18 },
  actionsContainer: { padding: 16 },
  btnPrimary: { backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { backgroundColor: '#ffffff', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#059669' },
  btnSecondaryText: { color: '#059669', fontWeight: 'bold', fontSize: 14 },
  section: { padding: 16, paddingTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  tableCard: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  colName: { fontSize: 14, color: '#334155' },
  colPrice: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  rotationCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  rotationName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  rotationSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  bgGreen: { backgroundColor: '#059669' },
  bgAmber: { backgroundColor: '#f59e0b' },
  emptyText: { padding: 16, color: '#64748b', textAlign: 'center', fontSize: 13 },
  shareBtn: { flexDirection: 'row', margin: 16, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#059669' },
  shareBtnText: { color: '#059669', fontWeight: 'bold', marginLeft: 8, fontSize: 14 }
});
