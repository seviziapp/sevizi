import React from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Pressable, StyleSheet, Text, Platform, useWindowDimensions } from 'react-native';
import { Home, Map, Plus, MessageCircle, User, LayoutGrid, ClipboardList } from 'lucide-react-native';
import { colors, radii, shadow, spacing, text } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';

const NAV_ITEMS = [
  { label: 'Accueil',     icon: Home,          route: '/client/home' },
  { label: 'Mes demandes', icon: ClipboardList, route: '/client/requests' },
  { label: 'Carte',       icon: Map,           route: '/client/map' },
  { label: 'Messages',    icon: MessageCircle, route: '/client/messages' },
  { label: 'Catégories',  icon: LayoutGrid,    route: '/client/categories' },
  { label: 'Profil',      icon: User,          route: '/client/profile' },
];

function DesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <Pressable style={styles.sidebarLogo} onPress={() => router.push('/client/home')}>
        <Logo size={36} />
        <Text style={[text.h3, { color: colors.creme }]}>Sèvizi</Text>
      </Pressable>

      <View style={styles.sidebarNav}>
        {NAV_ITEMS.map(({ label, icon: Icon, route }) => {
          const active = pathname === route;
          return (
            <Pressable
              key={route}
              style={[styles.sidebarItem, active && styles.sidebarItemActive]}
              onPress={() => router.push(route as any)}
            >
              <Icon size={20} color={active ? colors.vert : colors.textMutedDark} />
              <Text style={[text.bodyMd, { color: active ? colors.creme : colors.textMutedDark }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.sidebarFab} onPress={() => router.push('/client/new-request' as any)}>
        <Plus size={20} color={colors.white} />
        <Text style={[text.bodyMd, { color: colors.white }]}>Nouvelle demande</Text>
      </Pressable>
    </View>
  );
}

export default function ClientLayout() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.vert,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: isDesktop ? { display: 'none' } : styles.bar,
      }}
    >
      <Tabs.Screen name="home"     options={{ tabBarIcon: ({ color }) => <Home size={24} color={color} /> }} />
      <Tabs.Screen name="map"      options={{ tabBarIcon: ({ color }) => <Map size={24} color={color} /> }} />
      <Tabs.Screen
        name="new-request"
        options={{
          tabBarButton: () => isDesktop ? null : (
            <Pressable style={styles.fab} onPress={() => router.push('/client/new-request' as any)}>
              <Plus size={26} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="messages" options={{ tabBarIcon: ({ color }) => <MessageCircle size={24} color={color} /> }} />
      <Tabs.Screen name="profile"  options={{ tabBarIcon: ({ color }) => <User size={24} color={color} /> }} />
      <Tabs.Screen name="requests"      options={{ href: null }} />
      <Tabs.Screen name="offers"        options={{ href: null }} />
      <Tabs.Screen name="thread"        options={{ href: null }} />
      <Tabs.Screen name="my-reviews"    options={{ href: null }} />
      <Tabs.Screen name="security"      options={{ href: null }} />
      <Tabs.Screen name="help"          options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="job-status"    options={{ href: null }} />
      <Tabs.Screen name="payment"       options={{ href: null }} />
      <Tabs.Screen name="favorites"     options={{ href: null }} />
      <Tabs.Screen name="categories"    options={{ href: null }} />
    </Tabs>
  );

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        <DesktopSidebar />
        <View style={styles.desktopContent}>{tabs}</View>
      </View>
    );
  }

  return tabs;
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
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.creme,
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.encre,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  sidebarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  sidebarNav: {
    flex: 1,
    gap: spacing.xs,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  sidebarItemActive: {
    backgroundColor: colors.encreSoft,
  },
  sidebarFab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.vert,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  desktopContent: {
    flex: 1,
    overflow: 'hidden',
  },
});
