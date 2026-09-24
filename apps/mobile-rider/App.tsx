import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@isla/supabase';
import type { Database } from '@isla/supabase';
import { supabase } from './src/lib/supabase';
import { colors } from './src/ui/theme';
import type { AuthStackParamList } from './src/navigation/types';
import AuthHomeScreen from './src/screens/auth/AuthHomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import OtpScreen from './src/screens/auth/OtpScreen';
import PhoneScreen from './src/screens/auth/PhoneScreen';
import RiderApplicationScreen from './src/screens/RiderApplicationScreen';
import RiderStatusScreen from './src/screens/RiderStatusScreen';
import RiderHomeScreen from './src/screens/RiderHomeScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

type RiderApplicationRow = Database['public']['Tables']['rider_applications']['Row'];

function LoadingGate() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function RiderGate() {
  const { client, profile } = useAuth();
  const [application, setApplication] = useState<RiderApplicationRow | 'loading' | 'none'>('loading');

  const loadApplication = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await client
      .from('rider_applications')
      .select('*')
      .eq('rider_id', profile.id)
      .maybeSingle();
    if (error || !data) {
      setApplication('none');
      return;
    }
    setApplication(data);
  }, [client, profile]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  if (application === 'loading') {
    return <LoadingGate />;
  }

  if (application === 'none') {
    return <RiderApplicationScreen onSubmitted={() => void loadApplication()} />;
  }

  if (application.status === 'approved') {
    return <RiderHomeScreen />;
  }

  return <RiderStatusScreen application={application} onRefresh={() => void loadApplication()} />;
}

function Root() {
  const { session, loading, profileLoading } = useAuth();

  if (loading || (session && profileLoading)) {
    return <LoadingGate />;
  }

  if (!session) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="AuthHome" component={AuthHomeScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
        <AuthStack.Screen name="Otp" component={OtpScreen} />
        <AuthStack.Screen name="Phone" component={PhoneScreen} />
      </AuthStack.Navigator>
    );
  }

  return <RiderGate />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider client={supabase}>
        <NavigationContainer>
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});