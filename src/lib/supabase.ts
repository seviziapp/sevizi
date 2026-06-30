import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Pulled from app config / .env at build time.
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web use the browser's localStorage so the session survives reloads and
    // OAuth redirects; AsyncStorage is the right adapter on native.
    storage: isWeb ? (typeof window !== 'undefined' ? window.localStorage : undefined) : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // MUST be true on web so the session returned in the URL after a Google
    // OAuth redirect is captured and stored. If false, OAuth logins silently
    // produce no session -> every write fails with "Non connecté".
    detectSessionInUrl: isWeb,
  },
});
