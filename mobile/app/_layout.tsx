import { Stack, ThemeProvider, DefaultTheme } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#059669',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
  },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cycles/[id]" options={{ title: 'Detail Siklus', headerBackTitle: 'Kembali' }} />
        <Stack.Screen name="orders/new" options={{ title: 'Buat Pesanan Baru', headerBackTitle: 'Batal', presentation: 'modal' }} />
        <Stack.Screen name="orders/[id]" options={{ title: 'Detail Pesanan', headerBackTitle: 'Kembali' }} />
        <Stack.Screen name="members/index" options={{ title: 'Daftar Anggota', headerBackTitle: 'Kembali' }} />
      </Stack>
    </ThemeProvider>
  );
}
