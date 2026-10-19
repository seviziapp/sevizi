import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, text, radii } from '../theme/tokens';
import { useLang, Lang } from '../i18n';

const OPTIONS: { id: Lang; label: string }[] = [{ id: 'fr', label: 'Français' }, { id: 'en', label: 'English' }];

/** Small FR / EN pill switch. `compact` shows just FR | EN. */
export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.wrap}>
      {OPTIONS.map(o => (
        <Pressable key={o.id} onPress={() => setLang(o.id)} accessibilityRole="button" accessibilityLabel={o.label}
          style={[styles.opt, lang === o.id && styles.on]}>
          <Text style={[text.small, { color: lang === o.id ? colors.white : colors.encre, fontWeight: '600' }]}>
            {compact ? o.id.toUpperCase() : o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, backgroundColor: colors.white, padding: 2 },
  opt: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill },
  on: { backgroundColor: colors.vert },
});
