import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

export default function TabLayout() {
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
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <SymbolView name="house.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
      <Tabs.Screen
        name="cycles"
        options={{
          title: 'Siklus',
          tabBarIcon: ({ color }) => (
            <SymbolView name="calendar" tintColor={color} fallback={<></>} />
          ),
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
        name="more"
        options={{
          title: 'Lainnya',
          tabBarIcon: ({ color }) => (
            <SymbolView name="ellipsis.circle.fill" tintColor={color} fallback={<></>} />
          ),
        }}
      />
    </Tabs>
  );
}
