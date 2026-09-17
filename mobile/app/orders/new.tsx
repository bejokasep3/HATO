import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getMembers, getProducts, getDashboard, getCycles, getOrders, createOrder } from '@/lib/api';
import { Member, Product, Cycle } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export default function NewOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cycleId?: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const [orderedMemberIds, setOrderedMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchMember, setSearchMember] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const loadCycleOrders = async (cId: string) => {
    try {
      const orders = await getOrders(cId).catch(() => []);
      const setIds = new Set<string>();
      orders.forEach(o => setIds.add(o.memberId));
      setOrderedMemberIds(setIds);
      setSelectedMemberId(prev => (prev && setIds.has(prev) ? null : prev));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [dashData, cyclesData, membersData, productsData] = await Promise.all([
          getDashboard().catch(() => null),
          getCycles().catch(() => []),
          getMembers().catch(() => []),
          getProducts().catch(() => []),
        ]);
        setCycles(cyclesData || []);

        let targetCycle: Cycle | null = null;
        if (params.cycleId) {
          targetCycle = cyclesData?.find((c: Cycle) => c.id === params.cycleId) || null;
        }
        if (!targetCycle && dashData?.currentCycle) {
          targetCycle = dashData.currentCycle;
        }
        if (!targetCycle && cyclesData && cyclesData.length > 0) {
          targetCycle = cyclesData[0];
        }

        setCurrentCycle(targetCycle);
        setMembers(membersData || []);
        setProducts(productsData || []);

        if (targetCycle) {
          await loadCycleOrders(targetCycle.id);
        }
      } catch (error) {
        console.error('Failed to load new order data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.cycleId]);

  const handleSelectCycle = async (cycle: Cycle) => {
    setCurrentCycle(cycle);
    await loadCycleOrders(cycle.id);
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    (m.groupName && m.groupName.toLowerCase().includes(searchMember.toLowerCase()))
  );

  const calculateTotal = () => {
    return products.reduce((sum, p) => {
      const qty = parseFloat(quantities[p.id] || '0') || 0;
      const price = p.defaultPrice || 0;
      return sum + qty * price;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!currentCycle) {
      Alert.alert('Error', 'Tidak ada siklus aktif saat ini.');
      return;
    }
    if (!selectedMemberId) {
      Alert.alert('Peringatan', 'Silakan pilih anggota terlebih dahulu.');
      return;
    }

    const items = products
      .filter(p => parseFloat(quantities[p.id] || '0') > 0)
      .map(p => ({
        productId: p.id,
        quantity: parseFloat(quantities[p.id] || '0'),
        unitPrice: p.defaultPrice || 0,
      }));

    if (items.length === 0) {
      Alert.alert('Peringatan', 'Masukkan jumlah minimal untuk 1 produk.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({
        cycleId: currentCycle.id,
        memberId: selectedMemberId,
        items,
        notes: notes.trim() || undefined,
        paymentStatus: 'unpaid',
      });

      Alert.alert('Sukses', 'Pesanan berhasil disimpan!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Gagal', error?.message || 'Gagal menyimpan pesanan. Pastikan koneksi server terhubung.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {cycles.length > 1 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.label}>Pilih Siklus</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {cycles.map((c) => {
                const isSelected = currentCycle?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                    onPress={() => handleSelectCycle(c)}
                  >
                    <Text style={[styles.memberText, isSelected && styles.memberTextSelected]}>
                      {c.label} ({c.status})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {currentCycle ? (
        <View style={styles.cycleInfoCard}>
          <Text style={styles.cycleInfoText}>Siklus Aktif: <Text style={styles.textBold}>{currentCycle.label} ({currentCycle.status})</Text></Text>
        </View>
      ) : (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Perhatian: Belum ada siklus terbuka.</Text>
        </View>
      )}

      {/* Select Member */}
      <Text style={styles.label}>Pilih Anggota</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Cari nama anggota atau grup..."
        value={searchMember}
        onChangeText={setSearchMember}
      />
      
      <View style={styles.pickerContainer}>
        {filteredMembers.slice(0, 15).map(m => {
          const isSelected = selectedMemberId === m.id;
          const alreadyOrdered = orderedMemberIds.has(m.id);
          return (
            <TouchableOpacity 
              key={m.id}
              disabled={alreadyOrdered}
              style={[
                styles.memberChip, 
                isSelected && styles.memberChipSelected,
                alreadyOrdered && { opacity: 0.5, backgroundColor: '#f1f5f9' }
              ]}
              onPress={() => setSelectedMemberId(m.id)}
            >
              <Text style={[
                styles.memberText, 
                isSelected && styles.memberTextSelected,
                alreadyOrdered && { color: '#94a3b8' }
              ]}>
                {m.name} {m.groupName ? `(${m.groupName})` : ''} {alreadyOrdered ? '✓ (Sudah Pesan)' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        {filteredMembers.length === 0 && (
          <Text style={styles.emptyText}>Tidak ada anggota ditemukan</Text>
        )}
      </View>

      {/* Select Products */}
      <Text style={styles.label}>Pilih Produk & Jumlah</Text>
      {products.map(p => {
        return (
          <View key={p.id} style={styles.productCard}>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{p.name}</Text>
              <Text style={styles.productPrice}>
                {formatCurrency(p.defaultPrice || 0)} / {p.unit}
              </Text>
            </View>
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                value={quantities[p.id] || ''}
                onChangeText={(v) => setQuantities({ ...quantities, [p.id]: v })}
              />
              <Text style={styles.unitText}>{p.unit}</Text>
            </View>
          </View>
        );
      })}

      {products.length === 0 && (
        <Text style={styles.emptyText}>Belum ada produk aktif di katalog</Text>
      )}

      {/* Notes */}
      <Text style={styles.label}>Catatan Pesanan (Opsional)</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Contoh: Titip di pos satpam, potong 8 bagian, dll."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      {/* Summary & Submit */}
      <View style={styles.summaryCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.summaryLabel}>Total Estimasi:</Text>
          <Text style={styles.summaryValue}>{formatCurrency(calculateTotal())}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitBtnText}>Simpan Pesanan</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  cycleInfoCard: { backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 16 },
  cycleInfoText: { color: '#065f46', fontSize: 13 },
  warningCard: { backgroundColor: '#fffbeb', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', marginBottom: 16 },
  warningText: { color: '#b45309', fontSize: 13 },
  label: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, marginTop: 12 },
  searchInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  memberChip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ffffff', borderRadius: 16, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  memberChipSelected: { backgroundColor: '#059669', borderColor: '#059669' },
  memberText: { color: '#334155', fontSize: 13 },
  memberTextSelected: { color: '#ffffff', fontWeight: 'bold' },
  productCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  productPrice: { fontSize: 12, color: '#64748b', marginTop: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  input: { width: 64, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, textAlign: 'center', fontWeight: 'bold' },
  unitText: { marginLeft: 6, fontSize: 13, color: '#64748b', minWidth: 32 },
  notesInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  summaryCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#059669' },
  submitBtn: { backgroundColor: '#059669', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  textBold: { fontWeight: 'bold' },
  emptyText: { color: '#94a3b8', fontSize: 13, paddingVertical: 8 }
});
