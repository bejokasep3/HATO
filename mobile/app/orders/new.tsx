import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getMembers, getProducts, getDashboard, getCycles, getOrders, getCyclePrices, createOrder, newIdempotencyKey } from '@/lib/api';
import { persistentStorage } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { Member, Product, Cycle, WeeklyPrice } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { currentWeekStart, cycleTiming, cycleStatusLabel } from '../../../src/lib/domain/calendar';
import { useBusinessTime } from '../../../shared/use-business-time';

export default function NewOrderScreen() {
  const router = useRouter();
  const { operationalSchema } = useAuth();
  const canMutate = operationalSchema === true;
  const params = useLocalSearchParams<{ cycleId?: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, WeeklyPrice>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<Cycle | null>(null);
  const now = useBusinessTime(currentCycle?.evaluatedAt);
  const acceptsOrders = currentCycle ? cycleTiming(currentCycle, now).allowsManagerEntry : false;
  const [orderedMemberIds, setOrderedMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchMember, setSearchMember] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [attempt, setAttempt] = useState<{ signature: string; key: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const draftStorageKey = currentCycle ? `hato.order-draft.${currentCycle.id}` : null;
  const pricingPending = currentCycle?.periodState === 'draft';

  useEffect(() => {
    if (!draftStorageKey) return;
    let active = true;
    setDraftReady(false);
    persistentStorage.getItem(draftStorageKey).then((raw) => {
      if (!active || !raw) return;
      try {
        const draft = JSON.parse(raw) as { memberId?: string; search?: string; quantities?: Record<string, string>; notes?: string; attempt?: { signature: string; key: string } };
        setSelectedMemberId(draft.memberId ?? null);
        setSearchMember(draft.search ?? '');
        setQuantities(draft.quantities ?? {});
        setNotes(draft.notes ?? '');
        setAttempt(draft.attempt ?? null);
      } catch { void persistentStorage.removeItem(draftStorageKey); }
    }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;
    const timer = setTimeout(() => {
      void persistentStorage.setItem(draftStorageKey, JSON.stringify({ memberId: selectedMemberId, search: searchMember, quantities, notes, attempt }));
    }, 250);
    return () => clearTimeout(timer);
  }, [attempt, draftReady, draftStorageKey, notes, quantities, searchMember, selectedMemberId]);

  const loadCycleOrders = async (cId: string) => {
    const orders = await getOrders(cId);
    const setIds = new Set<string>();
    orders.forEach(o => setIds.add(o.memberId));
    setOrderedMemberIds(setIds);
    setSelectedMemberId(prev => (prev && setIds.has(prev) ? null : prev));
  };

  useEffect(() => {
    async function loadData() {
      setLoadError('');
      try {
        const [dashData, cyclesData, membersData, productsData] = await Promise.all([
          getDashboard().catch(() => null),
          getCycles(),
          getMembers(),
          getProducts(),
        ]);
        setCycles(cyclesData || []);

        let targetCycle: Cycle | null = null;
        if (params.cycleId) {
          targetCycle = cyclesData?.find((c: Cycle) => c.id === params.cycleId) || null;
        }
        if (!targetCycle) targetCycle = cyclesData.find((cycle) => cycle.periodStart.slice(0, 10) === currentWeekStart(new Date())) ?? null;
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
        setLoadError(error instanceof Error ? error.message : 'Data pesanan gagal dimuat.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.cycleId, reloadKey]);

  useEffect(() => {
    if (!currentCycle) return;
    let active = true;
    setPrices({});
    setPriceError('');
    setPricesLoading(true);
    getCyclePrices(currentCycle.id).then((items) => {
      if (active) setPrices(Object.fromEntries(items.map((item) => [item.productId, item])));
    }).catch((error: unknown) => {
      if (active) setPriceError(error instanceof Error ? error.message : 'Harga siklus gagal dimuat.');
    }).finally(() => {
      if (active) setPricesLoading(false);
    });
    return () => { active = false; };
  }, [currentCycle?.id]);

  const handleSelectCycle = async (cycle: Cycle) => {
    setCurrentCycle(cycle);
    setSelectedMemberId(null);
    setQuantities({});
    setSaveError('');
    try {
      await loadCycleOrders(cycle.id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Pesanan siklus gagal dimuat.');
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    (m.groupName && m.groupName.toLowerCase().includes(searchMember.toLowerCase()))
  );

  const calculateTotal = () => {
    return products.reduce((sum, p) => {
      const qty = Number((quantities[p.id] || '0').replace(',', '.')) || 0;
      const price = prices[p.id]?.consumerPrice ?? 0;
      return sum + qty * price;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!canMutate) {
      setSaveError('Input pesanan belum tersedia karena database masih menggunakan schema operasional lama.');
      return;
    }
    if (!currentCycle) {
      Alert.alert('Error', 'Tidak ada siklus aktif saat ini.');
      return;
    }
    if (!acceptsOrders) { setSaveError('Minggu ini belum dimulai atau ditutup manual. Pilih minggu yang dapat dikelola.'); return; }
    if (!selectedMemberId) {
      Alert.alert('Peringatan', 'Silakan pilih anggota terlebih dahulu.');
      return;
    }

    if (loadError || pricesLoading || priceError) {
      setSaveError(loadError || priceError || 'Harga sedang dimuat.');
      return;
    }

    const filledProducts = products.filter((product) => (quantities[product.id] || '').trim() !== '');
    const invalidProduct = filledProducts.find((product) => {
      const raw = quantities[product.id].trim();
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(raw)) return true;
      const quantity = Number(raw.replace(',', '.'));
      return quantity <= 0 || (product.unit === 'bungkus' && !Number.isInteger(quantity));
    });
    if (invalidProduct) {
      setSaveError(`Jumlah ${invalidProduct.name} tidak valid. Gunakan angka positif sesuai satuan.`);
      return;
    }

    const missingPrice = filledProducts.find((product) => !prices[product.id] || prices[product.id].consumerPrice <= 0);
    if (missingPrice && !pricingPending) {
      setSaveError(`Harga ${missingPrice.name} belum diatur untuk siklus ini.`);
      return;
    }

    const items = filledProducts
      .map(p => ({
        productId: p.id,
        quantity: quantities[p.id].replace(',', '.'),
        priceType: 'consumer' as const,
      }));

    if (items.length === 0) {
      Alert.alert('Peringatan', 'Masukkan jumlah minimal untuk 1 produk.');
      return;
    }

    setSubmitting(true);
    setSaveError('');
    try {
      const payload = {
        cycleId: currentCycle.id,
        memberId: selectedMemberId,
        items,
        notes: notes.trim() || undefined,
      };
      const signature = JSON.stringify(payload);
      const nextAttempt = attempt?.signature === signature ? attempt : { signature, key: newIdempotencyKey() };
      setAttempt(nextAttempt);
      if (draftStorageKey) await persistentStorage.setItem(draftStorageKey, JSON.stringify({ memberId: selectedMemberId, search: searchMember, quantities, notes, attempt: nextAttempt }));
      await createOrder(payload, { idempotencyKey: nextAttempt.key });
      if (draftStorageKey) await persistentStorage.removeItem(draftStorageKey);
      setDraftReady(false);
      setAttempt(null);

      Alert.alert('Sukses', 'Pesanan berhasil disimpan!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Pesanan gagal disimpan. Periksa koneksi, lalu coba lagi.');
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
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/cycles/new')} style={styles.cycleInfoCard}><Text style={styles.cycleInfoText}>Mulai minggu ini</Text></TouchableOpacity>
      {pricingPending ? <View style={styles.warningCard}><Text style={styles.warningText}>Jumlah pesanan dicatat sekarang. Tagihan menunggu harga.</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/cycles/[id]', params: { id: currentCycle!.id } })}><Text style={styles.cycleInfoText}>Isi harga & kunci tagihan</Text></TouchableOpacity></View> : null}
      {operationalSchema === false ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Mode baca aktif. Input pesanan dinonaktifkan sampai schema operasional diperbarui.</Text>
        </View>
      ) : null}
      {loadError ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>{loadError}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); setReloadKey((value) => value + 1); }} accessibilityRole="button">
            <Text style={styles.warningText}>Coba muat ulang</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {priceError ? <Text style={styles.warningText}>{priceError}</Text> : null}
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
                      {c.label} · {cycleStatusLabel(cycleTiming(c, now).effectiveStatus)}
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
          <Text style={styles.cycleInfoText}>{currentCycle.label} · <Text style={styles.textBold}>{cycleStatusLabel(cycleTiming(currentCycle, now).effectiveStatus)}</Text></Text>
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
                {pricesLoading ? 'Memuat harga…' : prices[p.id]?.consumerPrice > 0 ? `${formatCurrency(prices[p.id].consumerPrice)} / ${p.unit}` : 'Harga belum diatur'}
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
          <Text style={styles.summaryValue}>{pricingPending ? 'Menunggu harga' : formatCurrency(calculateTotal())}</Text>
        </View>
      </View>

      {saveError ? <Text style={styles.warningText} accessibilityRole="alert">{saveError}</Text> : null}

      <TouchableOpacity 
        style={[styles.submitBtn, (!canMutate || submitting || !!loadError || pricesLoading || !!priceError) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canMutate || !acceptsOrders || submitting || !!loadError || pricesLoading || !!priceError}
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
