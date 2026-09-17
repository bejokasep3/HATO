import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { getCycles, getInventory } from '@/lib/api';
import { Cycle, InventoryResponse, InventoryItem } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function MobileInventoryScreen() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const cyclesData = await getCycles().catch(() => []);
      setCycles(cyclesData || []);

      const active = cyclesData.find((c) => c.status === 'open') || cyclesData[0];
      setSelectedCycle(active || null);

      if (active) {
        const invData = await getInventory(active.id).catch(() => null);
        setInventory(invData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelectCycle = async (c: Cycle) => {
    setSelectedCycle(c);
    setLoading(true);
    try {
      const invData = await getInventory(c.id).catch(() => null);
      setInventory(invData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedCycle) {
      getInventory(selectedCycle.id)
        .then((data) => setInventory(data))
        .finally(() => setRefreshing(false));
    } else {
      loadData();
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const summary = inventory?.summary;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Cycle Selector */}
      {cycles.length > 1 && (
        <View style={styles.cycleBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {cycles.map((c) => {
                const isSelected = selectedCycle?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.cycleChip, isSelected && styles.cycleChipSelected]}
                    onPress={() => handleSelectCycle(c)}
                  >
                    <Text style={[styles.cycleChipText, isSelected && styles.cycleChipTextSelected]}>
                      {c.label} ({c.status})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* KPI Cards */}
      {summary && (
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Modal (HPP)</Text>
            <Text style={styles.kpiValue}>{formatCurrency(summary.totalPurchaseCost)}</Text>
            <Text style={styles.kpiSub}>Pembelian Supplier</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Omzet Penjualan</Text>
            <Text style={[styles.kpiValue, { color: '#059669' }]}>
              {formatCurrency(summary.totalRevenue)}
            </Text>
            <Text style={styles.kpiSub}>Pesanan Anggota</Text>
          </View>

          <View style={styles.kpiCardFull}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.kpiLabel}>Margin Kotor</Text>
              <View style={styles.marginBadge}>
                <Text style={styles.marginBadgeText}>{summary.marginPercentage}%</Text>
              </View>
            </View>
            <Text style={[styles.kpiValueBig, { color: summary.grossMargin >= 0 ? '#059669' : '#e11d48' }]}>
              {formatCurrency(summary.grossMargin)}
            </Text>
          </View>
        </View>
      )}

      {/* Items Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Penerimaan Komoditas ({inventory?.items?.length || 0})
        </Text>

        {inventory?.items?.length === 0 ? (
          <Text style={styles.emptyText}>Belum ada barang tercatat di siklus ini.</Text>
        ) : (
          inventory?.items?.map((item: InventoryItem) => {
            const diff = item.difference;
            return (
              <View key={item.productId} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <View
                    style={[
                      styles.diffBadge,
                      {
                        backgroundColor:
                          diff === 0 ? '#ecfdf5' : diff > 0 ? '#eff6ff' : '#fff1f2',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.diffBadgeText,
                        {
                          color: diff === 0 ? '#059669' : diff > 0 ? '#2563eb' : '#e11d48',
                        },
                      ]}
                    >
                      {diff === 0 ? '✅ Pas' : `${diff > 0 ? '+' : ''}${diff} ${item.unit}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemRow}>
                  <Text style={styles.itemDetail}>
                    Dipesan: <Text style={styles.bold}>{item.orderedQty} {item.unit}</Text>
                  </Text>
                  <Text style={styles.itemDetail}>
                    Diterima: <Text style={styles.bold}>{item.receivedQty} {item.unit}</Text>
                  </Text>
                  {item.damagedQty > 0 && (
                    <Text style={[styles.itemDetail, { color: '#e11d48' }]}>
                      Rusak: {item.damagedQty} {item.unit}
                    </Text>
                  )}
                </View>

                <View style={styles.itemDivider} />

                <View style={styles.itemFooter}>
                  <Text style={styles.itemFooterText}>
                    HPP: {formatCurrency(item.purchasePrice)}
                  </Text>
                  <Text style={[styles.itemFooterText, { fontWeight: 'bold', color: '#1e293b' }]}>
                    Modal: {formatCurrency(item.totalCost)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cycleBar: { marginBottom: 16 },
  cycleChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#cbd5e1' },
  cycleChipSelected: { backgroundColor: '#059669', borderColor: '#059669' },
  cycleChipText: { fontSize: 12, color: '#334155' },
  cycleChipTextSelected: { color: '#ffffff', fontWeight: 'bold' },
  kpiContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  kpiCardFull: { width: '100%', backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  kpiLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  kpiValue: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginTop: 4 },
  kpiValueBig: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  kpiSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  marginBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#ecfdf5', borderRadius: 6 },
  marginBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#059669' },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  itemCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffBadgeText: { fontSize: 11, fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  itemDetail: { fontSize: 12, color: '#475569' },
  bold: { fontWeight: 'bold', color: '#1e293b' },
  itemDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemFooterText: { fontSize: 12, color: '#64748b' },
  emptyText: { textAlign: 'center', color: '#94a3b8', paddingVertical: 24, fontSize: 13 },
});
