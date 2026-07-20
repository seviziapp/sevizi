import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, List, Map, User } from 'lucide-react-native';
import { colors } from '../../src/theme/tokens';

export default function ProviderLayout() {
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
        name="requests"
        options={{ tabBarIcon: ({ color }) => <List size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ tabBarIcon: ({ color }) => <Map size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ color }) => <User size={24} color={color} /> }}
      />
      {/* Hidden screens — navigable but not in tab bar */}
      <Tabs.Screen name="send-offer"   options={{ href: null }} />
      <Tabs.Screen name="active-job"   options={{ href: null }} />
      <Tabs.Screen name="earnings"     options={{ href: null }} />
      <Tabs.Screen name="verification" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="upgrade"      options={{ href: null }} />
      <Tabs.Screen name="withdraw"     options={{ href: null }} />
      <Tabs.Screen name="services"     options={{ href: null }} />
      <Tabs.Screen name="hours"        options={{ href: null }} />
      <Tabs.Screen name="agenda"       options={{ href: null }} />
    </Tabs>
  );
}
