import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const RoleCard = ({ title, subtext, icon, color, onPress, theme }: any) => (
  <TouchableOpacity 
    activeOpacity={0.8} 
    onPress={onPress}
    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
  >
    <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={32} color={color} />
    </View>
    <View style={styles.textContainer}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.cardSubtext, { color: theme.textLight }]}>{subtext}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
  </TouchableOpacity>
);

export default function RoleSelection() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.welcomeText, { color: theme.textLight }]}>Welcome to</Text>
          <Text style={[styles.brandText, { color: theme.primary }]}>School ERP</Text>
          <Text style={[styles.instructionText, { color: theme.textLight }]}>
            Please select your role to continue
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <RoleCard
            title="Institute / Principal"
            subtext="Manage school operations, staff, and overall administration."
            icon="business-outline"
            color={theme.primary}
            onPress={() => router.replace('/(auth)/institute-login')}
            theme={theme}
          />

          <RoleCard
            title="Teacher"
            subtext="Access your classes, mark attendance, and post homework."
            icon="people-outline"
            color={theme.success}
            onPress={() => router.replace('/(auth)/teacher-login')}
            theme={theme}
          />

          <RoleCard
            title="Student / Parent"
            subtext="Check attendance, homework, exams, and fee status."
            icon="school-outline"
            color={theme.secondary}
            onPress={() => router.replace('/(auth)/student-login')}
            theme={theme}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/institute-register')}>
            <Text style={[styles.registerText, { color: theme.primary }]}>
              New Institute? <Text style={{ fontWeight: 'bold' }}>Register Here</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  brandText: {
    fontSize: 36,
    fontWeight: '900',
    marginVertical: 4,
  },
  instructionText: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 15,
  },
});
