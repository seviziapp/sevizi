import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, StyleSheet } from 'react-native';
import { Home, Map, Plus, MessageCircle, User } from 'lucide-react-native';
import { colors, radii, shadow } from '../../src/theme/tokens';

export default function ClientLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.bar,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ color }) => <Home size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ tabBarIcon: ({ color }) => <Map size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="new-request"
        options={{
          tabBarButton: () => (
            <Pressable style={styles.fab} onPress={() => router.push('/client/new-request')}>
              <Plus size={26} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{ tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: ({ color }) => <User size={24} color={color} /> }}
      />
      {/* Hidden tabs — navigable but not in the bar */}
      <Tabs.Screen name="offers"        options={{ href: null }} />
      <Tabs.Screen name="thread"        options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="job-status"    options={{ href: null }} />
      <Tabs.Screen name="payment"       options={{ href: null }} />
      <Tabs.Screen name="favorites"     options={{ href: null }} />
      <Tabs.Screen name="categories"    options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 68,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  fab: {
    top: -14,
    alignSelf: 'center',
    width: 56, height: 56, borderRadius: radii.lg,
    backgroundColor: colors.vert,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
});
