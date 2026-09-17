import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

export default function MoreScreen() {
  const router = useRouter();
  
  const menuItems = [
    { title: 'Komunitas (Anggota & Sub-Grup)', icon: 'person.2.fill', route: '/members' },
    { title: 'Penerimaan Barang (Siklus)', icon: 'shippingbox.fill', route: '/inventory' },
    { title: 'Laporan & Keuangan', icon: 'chart.bar.xaxis', route: '/reports' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>HATO Manajer</Text>
        <Text style={styles.subTitle}>Sistem Distribusi Sembako</Text>
        <Text style={styles.version}>Versi 1.0.0 (Mobile)</Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.iconContainer}>
                <SymbolView name={item.icon as any} size={20} tintColor="#059669" fallback={<Text>•</Text>} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
            </View>
            <SymbolView name="chevron.right" size={16} tintColor="#94a3b8" fallback={<Text>{'>'}</Text>} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Informasi Aplikasi</Text>
        <Text style={styles.infoText}>
          Aplikasi mobile ini terhubung langsung ke server HATO Manajer untuk mempermudah pengecekan target sembako mingguan, jadwal rotasi, serta pencatatan status bayar anggota langsung dari iPhone Anda melalui Expo Go.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  appName: { fontSize: 22, fontWeight: 'bold', color: '#059669' },
  subTitle: { fontSize: 13, color: '#475569', marginTop: 2, fontWeight: '500' },
  version: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  menuContainer: { marginTop: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  infoBox: { margin: 16, padding: 16, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  infoTitle: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
  infoText: { fontSize: 12, color: '#64748b', lineHeight: 18 }
});
