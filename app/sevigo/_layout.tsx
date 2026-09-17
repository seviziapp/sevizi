import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, FileText, CreditCard } from 'lucide-react-native';
import { colors } from '../../src/theme/tokens';

export default function SevigoLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 68,
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ tabBarIcon: ({ color }) => <FileText size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ tabBarIcon: ({ color }) => <CreditCard size={24} color={color} /> }}
      />
      {/* Hidden screens — navigable but not in tab bar */}
      <Tabs.Screen name="new-invoice"      options={{ href: null }} />
      <Tabs.Screen name="invoice/[id]"     options={{ href: null }} />
      <Tabs.Screen name="business-profile" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
    </Tabs>
  );
}
