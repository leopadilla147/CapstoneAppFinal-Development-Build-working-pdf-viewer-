import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://jyypjroozywgrelpzvnj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eXBqcm9venl3Z3JlbHB6dm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNDMzNTIsImV4cCI6MjA3NDYxOTM1Mn0.leJ8mm3dpa4XdhTl_bYhwnoZ4UX073YN_bdlz05Xuok'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});