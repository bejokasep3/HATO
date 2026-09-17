import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getCycles } from '@/lib/api';
import { Cycle } from '@/lib/types';
import { formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';

export default function CyclesScreen() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadCycles = async () => {
    try {
      const data = await getCycles();
      setCycles(data);
    } catch (error) {
      console.error('Failed to load cycles', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadCycles();
  };

  const renderItem = ({ item }: { item: Cycle }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/cycles/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.label}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status).bg }]}>
          <Text style={[styles.badgeText, { color: getStatusColor(item.status).text }]}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.dateText}>
        {formatDate(item.periodStart)} - {formatDate(item.deliveryDate)}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cycles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Tidak ada data siklus</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
  dateText: { fontSize: 14, color: '#64748b' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 24 }
});
