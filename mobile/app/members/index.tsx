import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { getMembers } from '@/lib/api';
import { Member } from '@/lib/types';
import { getWhatsAppUrl } from '@/lib/utils';
import { SymbolView } from 'expo-symbols';

export default function MembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadMembers = async () => {
    try {
      const data = await getMembers();
      setMembers(data || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMembers();
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.groupName && m.groupName.toLowerCase().includes(search.toLowerCase())) ||
    m.phone.includes(search)
  );

  const handleOpenWhatsApp = (phone: string, name: string) => {
    if (!phone) return;
    const url = getWhatsAppUrl(phone, `Halo ${name}`);
    Linking.openURL(url).catch(err => console.error('Error opening WhatsApp:', err));
  };

  const renderItem = ({ item }: { item: Member }) => (
    <View style={styles.card}>
      <View style={styles.memberInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>
          {item.role === 'pj' && (
            <View style={styles.roleBadge}><Text style={styles.roleText}>PJ</Text></View>
          )}
          {item.role === 'pengurus' && (
            <View style={[styles.roleBadge, styles.rolePengurus]}><Text style={styles.roleText}>Pengurus</Text></View>
          )}
        </View>
        <Text style={styles.group}>{item.groupName || 'Tanpa Grup'} • {item.phone}</Text>
      </View>

      <TouchableOpacity 
        style={styles.waButton}
        onPress={() => handleOpenWhatsApp(item.phone, item.name)}
      >
        <Text style={styles.waText}>WA</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari anggota atau grup..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View>
      ) : (
        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Tidak ada anggota ditemukan</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  listContent: { padding: 14 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  memberInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  group: { fontSize: 12, color: '#64748b', marginTop: 3 },
  roleBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rolePengurus: { backgroundColor: '#f3e8ff' },
  roleText: { fontSize: 10, fontWeight: '700', color: '#0369a1' },
  waButton: { backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  waText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 32 }
});
