import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  AuthHome: undefined;
  Login: undefined;
  Register: undefined;
  Otp: undefined;
};

export type AuthScreen<Route extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, Route>;