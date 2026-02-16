import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';

export default function Index() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(auth)/student-login');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.primary,
    },
    title: {
      fontSize: 42,
      fontWeight: '900',
      color: '#fff',
      marginBottom: 10,
      letterSpacing: 1,
    },
    subtitle: {
      fontSize: 18,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>School ERP</Text>
      <Text style={styles.subtitle}>Unified Management</Text>
    </View>
  );
}
