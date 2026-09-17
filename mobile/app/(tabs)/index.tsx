import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getDashboard } from '@/lib/api';
import { DashboardData, TargetItem, Order } from '@/lib/types';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadData = async () => {
    try {
      const dashboardData = await getDashboard();
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to load dashboard', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!data?.hasCycle || !data.currentCycle) {
    return (
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Belum Ada Siklus Aktif</Text>
          <Text style={styles.emptyText}>Buat siklus baru di tab Siklus untuk memulai periode pemesanan.</Text>
        </View>
      </ScrollView>
    );
  }

  const { currentCycle, targets, rotation, payments, recentOrders } = data;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {/* Active Cycle Banner */}
      <TouchableOpacity 
        style={styles.bannerCard}
        onPress={() => router.push(`/cycles/${currentCycle.id}`)}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.bannerSubtitle}>SIKLUS AKTIF</Text>
          <View style={[styles.badge, { backgroundColor: getStatusColor(currentCycle.status).bg }]}>
            <Text style={[styles.badgeText, { color: getStatusColor(currentCycle.status).text }]}>
              {getStatusLabel(currentCycle.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.bannerTitle}>{currentCycle.label}</Text>
        <Text style={styles.bannerDates}>
          Deadline: {formatDate(currentCycle.orderDeadline)} • Distribusi: {formatDate(currentCycle.deliveryDate)}
        </Text>
      </TouchableOpacity>

      {/* Target Progress */}
      {targets && targets.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Produk Mingguan</Text>
          {targets.map((target: TargetItem) => {
            const progress = target.percentage || (target.targetQuantity > 0 ? (target.actualQuantity / target.targetQuantity) * 100 : 0);
            return (
              <View key={target.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{target.name}</Text>
                  <Text style={styles.progressText}>
                    {target.actualQuantity} / {target.targetQuantity} {target.unit}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: target.isMet ? '#059669' : '#f59e0b'
                      }
                    ]} 
                  />
                </View>
                <View style={[styles.rowBetween, styles.mt2]}>
                  <Text style={styles.textMuted}>{Math.round(progress)}% tercapai</Text>
                  {target.isMet && <Text style={styles.textGreen}>✓ Target Terpenuhi</Text>}
                </View>
                {target.breakdown && target.breakdown.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
                    {target.breakdown.map((b) => (
                      <View key={b.name} style={{ backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontSize: 10, color: '#475569' }}>
                          {b.name}: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{b.quantity} {target.unit}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Rotation Compliance */}
      {rotation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kepatuhan Rotasi Anggota</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.complianceText}>
                {rotation.orderedCount} dari {rotation.scheduledCount} terjadwal sudah memesan
              </Text>
              <Text style={styles.compliancePercent}>{rotation.percentage}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${Math.min(rotation.percentage, 100)}%` }
                ]} 
              />
            </View>
          </View>
        </View>
      )}

      {/* Payment Summary */}
      {payments && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ringkasan Pembayaran</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.textMuted}>Total Tagihan ({payments.totalOrders} order)</Text>
              <Text style={styles.textBold}>{formatCurrency(payments.totalBilling)}</Text>
            </View>
            <View style={[styles.rowBetween, styles.mt2]}>
              <Text style={styles.textMuted}>Sudah Bayar ({payments.paidCount})</Text>
              <Text style={[styles.textBold, styles.textGreen]}>{formatCurrency(payments.paidAmount)}</Text>
            </View>
            <View style={[styles.rowBetween, styles.mt2]}>
              <Text style={styles.textMuted}>Belum Bayar ({payments.unpaidCount})</Text>
              <Text style={[styles.textBold, styles.textRed]}>{formatCurrency(payments.unpaidAmount)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Orders */}
      {recentOrders && recentOrders.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pesanan Terbaru</Text>
          {recentOrders.map((order: Order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.orderMemberName}>{order.memberName || order.member?.name || 'Anggota'}</Text>
                  <Text style={styles.orderGroup}>{order.groupName || order.member?.groupName || '-'}</Text>
                </View>
                <View style={styles.alignRight}>
                  <Text style={styles.orderAmount}>{formatCurrency(order.totalAmount)}</Text>
                  <View style={[styles.badgeSmall, { backgroundColor: getStatusColor(order.paymentStatus).bg }]}>
                    <Text style={[styles.badgeTextSmall, { color: getStatusColor(order.paymentStatus).text }]}>
                      {getStatusLabel(order.paymentStatus)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 32, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  bannerCard: { margin: 16, padding: 18, backgroundColor: '#059669', borderRadius: 14 },
  bannerSubtitle: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  bannerTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginTop: 6 },
  bannerDates: { color: '#d1fae5', fontSize: 13, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeTextSmall: { fontSize: 10, fontWeight: '700' },
  section: { marginHorizontal: 16, marginTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  card: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  orderCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  orderMemberName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  orderGroup: { fontSize: 12, color: '#64748b', marginTop: 2 },
  orderAmount: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  alignRight: { alignItems: 'flex-end' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  progressText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#059669', borderRadius: 4 },
  complianceText: { fontSize: 13, color: '#334155', flex: 1 },
  compliancePercent: { fontSize: 20, fontWeight: 'bold', color: '#059669', marginLeft: 8 },
  textMuted: { color: '#64748b', fontSize: 13 },
  textBold: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  textGreen: { color: '#059669', fontWeight: '600', fontSize: 12 },
  textRed: { color: '#e11d48', fontWeight: '600' },
  mt2: { marginTop: 6 },
  bottomSpace: { height: 40 }
});
