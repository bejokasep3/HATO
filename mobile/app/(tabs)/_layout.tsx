import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94a3b8',
        headerStyle: {
          backgroundColor: '#059669',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Buka menu lainnya" onPress={() => router.push('/more')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
            <SymbolView name="ellipsis.circle" size={23} tintColor="#ffffff" fallback={<></>} />
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Minggu Ini',
          tabBarIcon: ({ color }) => (
            <SymbolView name="house.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
      <Tabs.Screen
        name="cycles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Pesanan',
          tabBarIcon: ({ color }) => (
            <SymbolView name="cart.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Barang',
          tabBarIcon: ({ color }) => (
            <SymbolView name="shippingbox.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pembayaran',
          tabBarIcon: ({ color }) => (
            <SymbolView name="creditcard.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
