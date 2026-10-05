import { Stack, ThemeProvider, DefaultTheme } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/lib/auth-context';

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

function Navigation() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <ThemeProvider value={AppTheme}>
      <Stack>
        <Stack.Protected guard={status !== 'verified'}>
          <Stack.Screen name="login" options={{ title: 'Masuk', headerBackVisible: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'verified'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="cycles/[id]" options={{ title: 'Detail Siklus', headerBackTitle: 'Kembali' }} />
          <Stack.Screen name="orders/new" options={{ title: 'Buat Pesanan Baru', headerBackTitle: 'Batal', presentation: 'modal' }} />
          <Stack.Screen name="payments/[id]" options={{ title: 'Rincian Pembayaran', headerBackTitle: 'Piutang' }} />
          <Stack.Screen name="members/index" options={{ title: 'Daftar Anggota', headerBackTitle: 'Kembali' }} />
          <Stack.Screen name="reports/index" options={{ title: 'Laporan' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <AuthProvider><Navigation /></AuthProvider>;
}
