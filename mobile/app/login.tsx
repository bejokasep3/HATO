import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { status, error: sessionError, retry, signIn } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try { await signIn(userId, password); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Login gagal. Coba lagi.'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.brand}>HATO Manajer</Text>
        <Text style={styles.title}>Masuk</Text>
        <Text style={styles.description}>Gunakan akun manajer untuk membuka data operasional.</Text>
        {status === 'error' ? (
          <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => void retry()}>
            <Text style={styles.error}>{sessionError} · Coba periksa sesi lagi</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.label}>User ID</Text>
        <TextInput value={userId} onChangeText={setUserId} autoCapitalize="none" autoCorrect={false} autoComplete="username" style={styles.input} accessibilityLabel="User ID manajer" />
        <Text style={styles.label}>Kata sandi</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" style={styles.input} accessibilityLabel="Kata sandi" />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <TouchableOpacity accessibilityRole="button" disabled={busy || !userId.trim() || !password} style={[styles.button, (busy || !userId.trim() || !password) && styles.disabled]} onPress={() => void submit()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Masuk</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8fafc' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 20 },
  brand: { color: '#047857', fontSize: 14, fontWeight: '700' },
  title: { color: '#0f172a', fontSize: 26, fontWeight: '700', marginTop: 8 },
  description: { color: '#64748b', fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: 16 },
  label: { color: '#334155', fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, fontSize: 16, color: '#0f172a' },
  button: { marginTop: 20, minHeight: 48, borderRadius: 8, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#be123c', fontSize: 14, lineHeight: 20, marginTop: 12 },
  retry: { paddingVertical: 6 },
});
