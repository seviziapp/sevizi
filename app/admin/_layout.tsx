import React, { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { LayoutDashboard, ShieldCheck, AlertTriangle, Users, Wallet } from 'lucide-react-native';
import { colors } from '../../src/theme/tokens';
import { fetchMyProfile } from '../../src/lib/api';

export default function AdminLayout() {
  // Gate the whole back-office behind the is_admin flag (set in Supabase).
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking');
  useEffect(() => {
    fetchMyProfile()
      .then(p => setState(p?.isAdmin ? 'ok' : 'denied'))
      .catch(() => setState('denied'));
  }, []);

  if (state === 'checking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creme }}>
        <ActivityIndicator color={colors.vert} />
      </View>
    );
  }
  if (state === 'denied') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          height: 68,
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarLabel: 'Vue d\'ensemble',
          tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="verification"
        options={{
          tabBarLabel: 'Vérifications',
          tabBarIcon: ({ color }) => <ShieldCheck size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="disputes"
        options={{
          tabBarLabel: 'Litiges',
          tabBarIcon: ({ color }) => <AlertTriangle size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="withdrawals"
        options={{
          tabBarLabel: 'Retraits',
          tabBarIcon: ({ color }) => <Wallet size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarLabel: 'Utilisateurs',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
