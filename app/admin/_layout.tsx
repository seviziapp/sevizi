import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, ShieldCheck, AlertTriangle, Users } from 'lucide-react-native';
import { colors } from '../../src/theme/tokens';

export default function AdminLayout() {
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
        name="users"
        options={{
          tabBarLabel: 'Utilisateurs',
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
