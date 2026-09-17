import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { getReports } from '@/lib/api';
import { formatCurrency, formatDate, getWhatsAppUrl } from '@/lib/utils';

export default function MobileReportsScreen() {
  const [activeTab, setActiveTab] = useState<'targets' | 'financial' | 'receivable'>('targets');
  const [targetData, setTargetData] = useState<any>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [receivableData, setReceivableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (type: string) => {
    try {
      setLoading(true);
      const data = await getReports(type).catch(() => null);
      if (type === 'targets') setTargetData(data);
      if (type === 'financial') setFinancialData(data);
      if (type === 'receivable') setReceivableData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(activeTab);
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(activeTab);
  };

  const handleSendWA = (order: any) => {
    const msg = `Halo ${order.memberName}, kami dari Pengurus HATO mengingatkan bahwa tagihan pesanan sembako Anda untuk siklus *${order.cycleLabel}* sebesar *${formatCurrency(order.totalAmount)}* saat ini masih belum lunas. Mohon konfirmasi atau lakukan pembayaran melalui PJ Sub-Grup ${order.groupName}. Terima kasih! 🙏`;
    const url = getWhatsAppUrl(order.memberPhone, msg);
    Linking.openURL(url).catch((err) => console.error('Error opening WhatsApp:', err));
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'targets' && styles.tabBtnActive]}
          onPress={() => setActiveTab('targets')}
        >
          <Text style={[styles.tabText, activeTab === 'targets' && styles.tabTextActive]}>
            🎯 Target & Sisa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'financial' && styles.tabBtnActive]}
          onPress={() => setActiveTab('financial')}
        >
          <Text style={[styles.tabText, activeTab === 'financial' && styles.tabTextActive]}>
            💰 Keuangan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'receivable' && styles.tabBtnActive]}
          onPress={() => setActiveTab('receivable')}
        >
          <Text style={[styles.tabText, activeTab === 'receivable' && styles.tabTextActive]}>
            📋 Piutang ({receivableData?.summary?.totalUnpaidOrders || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Target & Sisa Stok Tab */}
      {activeTab === 'targets' && targetData && (
        <View>
          {/* Summary */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Target Ayam Campur</Text>
              <Text style={[styles.kpiValue, { color: '#059669' }]}>
                {targetData.summary.chickenSuccessRate}% Sukses
              </Text>
              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>20 kg / minggu</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
              <Text style={[styles.kpiLabel, { color: '#b45309' }]}>Sisa Ayam Terkini</Text>
              <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                {targetData.summary.currentChickenLeftover} kg
              </Text>
              <Text style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>Stok bawaan minggu depan</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Target Tahu Campur</Text>
              <Text style={[styles.kpiValue, { color: '#2563eb' }]}>
                {targetData.summary.tofuSuccessRate}% Sukses
              </Text>
              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>20 bks / minggu</Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#fffbeb', borderColor: '#fef3c7' }]}>
              <Text style={[styles.kpiLabel, { color: '#b45309' }]}>Sisa Tahu Terkini</Text>
              <Text style={[styles.kpiValue, { color: '#d97706' }]}>
                {targetData.summary.currentTofuLeftover} bks
              </Text>
              <Text style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>Stok bawaan minggu depan</Text>
            </View>
          </View>

          {/* Cycles Target List */}
          <Text style={styles.sectionTitle}>Aliran Stok & Target per Siklus</Text>
          {targetData.cycleReports.map((r: any) => (
            <View key={r.cycleId} style={styles.cycleCard}>
              <View style={styles.cycleHeader}>
                <Text style={styles.cycleLabel}>{r.cycleLabel}</Text>
                <Text style={styles.cycleStatus}>{r.status.toUpperCase()}</Text>
              </View>

              {/* Ayam Campur Row */}
              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>🍗 Ayam Campur</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: r.chicken.isMet ? '#059669' : '#d97706' }}>
                    {r.chicken.isMet ? '✅ Tercapai' : `❌ Kurang ${r.chicken.shortfall}kg`}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Terjual: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{r.chicken.sold}</Text> / {r.chicken.target} kg
                  {' '}(Karkas {r.chicken.breakdown.karkas}, Recah {r.chicken.breakdown.recah}, Gebrus {r.chicken.breakdown.gebrus})
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#475569' }}>Stok Awal: {r.chicken.beginningStock} kg</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#b45309' }}>
                    Sisa Akhir: {r.chicken.endingStock} kg
                  </Text>
                </View>
              </View>

              {/* Tahu Row */}
              <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>🧈 Tahu Campur</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: r.tofu.isMet ? '#059669' : '#d97706' }}>
                    {r.tofu.isMet ? '✅ Tercapai' : `❌ Kurang ${r.tofu.shortfall}bks`}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  Terjual: <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{r.tofu.sold}</Text> / {r.tofu.target} bks
                  {r.tofu.breakdown ? ` (Kuning ${r.tofu.breakdown.kuning}, Putih ${r.tofu.breakdown.putih})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, color: '#475569' }}>Stok Awal: {r.tofu.beginningStock} bks</Text>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#b45309' }}>
                    Sisa Akhir: {r.tofu.endingStock} bks
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && financialData && (
        <View>
          {/* Summary Cards */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Omzet</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(financialData.summary.totalRevenue)}
              </Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Modal (HPP)</Text>
              <Text style={styles.kpiValue}>
                {formatCurrency(financialData.summary.totalCost)}
              </Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#ecfdf5' }]}>
              <Text style={[styles.kpiLabel, { color: '#065f46' }]}>Margin Kotor</Text>
              <Text style={[styles.kpiValue, { color: '#059669' }]}>
                {formatCurrency(financialData.summary.totalGrossMargin)} ({financialData.summary.overallMarginPct}%)
              </Text>
            </View>

            <View style={[styles.kpiCard, { backgroundColor: '#fff1f2' }]}>
              <Text style={[styles.kpiLabel, { color: '#9f1239' }]}>Piutang Tertunggak</Text>
              <Text style={[styles.kpiValue, { color: '#e11d48' }]}>
                {formatCurrency(financialData.summary.totalUnpaid)}
              </Text>
            </View>
          </View>

          {/* Cycles List */}
          <Text style={styles.sectionTitle}>Ringkasan per Siklus</Text>
          {financialData.cycles.map((c: any) => (
            <View key={c.cycleId} style={styles.cycleCard}>
              <View style={styles.cycleHeader}>
                <Text style={styles.cycleLabel}>{c.cycleLabel}</Text>
                <Text style={styles.cycleStatus}>{c.status.toUpperCase()}</Text>
              </View>
              <View style={styles.cycleRow}>
                <Text style={styles.cycleMetric}>Omzet: {formatCurrency(c.totalRevenue)}</Text>
                <Text style={styles.cycleMetric}>Modal: {formatCurrency(c.totalCost)}</Text>
              </View>
              <View style={styles.cycleRow}>
                <Text style={[styles.cycleMetric, { color: '#059669', fontWeight: 'bold' }]}>
                  Margin: {formatCurrency(c.grossMargin)} ({c.marginPct}%)
                </Text>
                <Text style={[styles.cycleMetric, { color: '#e11d48' }]}>
                  Piutang: {formatCurrency(c.unpaidRevenue)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Receivable Tab */}
      {activeTab === 'receivable' && receivableData && (
        <View>
          {/* Banner */}
          <View style={styles.receivableBanner}>
            <Text style={styles.bannerLabel}>Total Piutang Belum Lunas</Text>
            <Text style={styles.bannerValue}>
              {formatCurrency(receivableData.summary.totalUnpaidAmount)}
            </Text>
            <Text style={styles.bannerSub}>
              {receivableData.summary.totalUnpaidOrders} pesanan dari {receivableData.summary.totalMembersWithDebt} anggota
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Daftar Tagihan</Text>
          {receivableData.orders.length === 0 ? (
            <Text style={styles.emptyText}>🎉 Semua tagihan lunas!</Text>
          ) : (
            receivableData.orders.map((o: any) => (
              <View key={o.orderId} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.memberName}>{o.memberName}</Text>
                    <Text style={styles.memberSub}>
                      {o.groupName} • {o.cycleLabel}
                    </Text>
                  </View>
                  <Text style={styles.orderAmount}>{formatCurrency(o.totalAmount)}</Text>
                </View>

                <Text style={styles.orderSummary} numberOfLines={1}>
                  {o.itemSummary}
                </Text>

                <View style={styles.orderFooter}>
                  <Text style={styles.overdueBadge}>{o.daysOverdue} hari belum lunas</Text>
                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={() => handleSendWA(o)}
                  >
                    <Text style={styles.waBtnText}>💬 Tagih WA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#059669', fontWeight: 'bold' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  kpiValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, marginTop: 6 },
  cycleCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  cycleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cycleLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  cycleStatus: { fontSize: 10, fontWeight: 'bold', color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cycleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cycleMetric: { fontSize: 12, color: '#475569' },
  receivableBanner: { backgroundColor: '#fff1f2', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#fecdd3', marginBottom: 16 },
  bannerLabel: { fontSize: 12, color: '#9f1239', fontWeight: '600' },
  bannerValue: { fontSize: 22, fontWeight: 'bold', color: '#be123c', marginTop: 4 },
  bannerSub: { fontSize: 11, color: '#e11d48', marginTop: 2 },
  orderCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  memberSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  orderAmount: { fontSize: 15, fontWeight: 'bold', color: '#e11d48' },
  orderSummary: { fontSize: 12, color: '#475569', marginTop: 6 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  overdueBadge: { fontSize: 11, color: '#be123c', fontWeight: '600', backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  waBtn: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  waBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 24, fontSize: 13 },
});
