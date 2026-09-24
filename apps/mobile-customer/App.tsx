import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@isla/supabase';
import { supabase } from './src/lib/supabase';
import { colors } from './src/ui/theme';
import type { AuthStackParamList } from './src/navigation/types';
import AuthHomeScreen from './src/screens/auth/AuthHomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import OtpScreen from './src/screens/auth/OtpScreen';
import PhoneScreen from './src/screens/auth/PhoneScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function LoadingGate() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function Root() {
  const { session, loading, profile, profileLoading } = useAuth();

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

  const onboardingComplete = profile?.home_town != null && profile?.phone != null;
  return onboardingComplete ? <HomeScreen /> : <OnboardingScreen />;
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