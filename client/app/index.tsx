import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';

export default function Index() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [studentToken, teacherToken, principalToken] = await Promise.all([
          AsyncStorage.getItem('studentToken'),
          AsyncStorage.getItem('teacherToken'),
          AsyncStorage.getItem('principalToken') || AsyncStorage.getItem('token')
        ]);

        if (studentToken) {
          setInitialRoute('/(student)/dashboard');
        } else if (teacherToken) {
          setInitialRoute('/(teacher)/dashboard');
        } else if (principalToken) {
          setInitialRoute('/(principal)/dashboard');
        } else {
          setInitialRoute('/(auth)/role-selection');
        }
      } catch (error) {
        setInitialRoute('/(auth)/role-selection');
      }
    };

    checkAuth();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return <Redirect href={initialRoute as any} />;
}
