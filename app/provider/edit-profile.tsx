import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, ActivityIndicator, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, ImagePlus, Lock, Check, Copy, Share2 } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { pickFile } from '../../src/lib/pickFile';
import { fetchMyProviderProfile, updateProviderProfile, uploadDocument, isUsernameAvailable, updateProviderUsername, isValidUsername } from '../../src/lib/api';
import { CATEGORIES, type ServiceCategory } from '../../src/lib/types';
import { GALLERY_CAP_FREE } from '../../src/lib/pricing';
import { slugify } from '../../src/lib/format';

const BOOKING_LINK_ORIGIN = 'https://sevizi.app';
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function EditProviderProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [primaryCategory, setPrimaryCategory] = useState<ServiceCategory | null>(null);
  const [extraCategories, setExtraCategories] = useState<ServiceCategory[]>([]);
  const [yearsActive, setYearsActive] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [copied, setCopied] = useState(false);
  const checkSeq = useRef(0);

  const galleryCap = isPro ? Infinity : GALLERY_CAP_FREE;

  useEffect(() => {
    fetchMyProviderProfile()
      .then(p => {
        if (p) {
          setName(p.name); setBio(p.bio ?? ''); setGallery(p.gallery ?? []);
          setIsPro(p.tier === 'pro'); setPrimaryCategory(p.category);
          setExtraCategories(p.categories ?? []);
          setYearsActive(p.yearsActive != null ? String(p.yearsActive) : '');
          const initialUsername = p.username ?? slugify(p.name);
          setUsername(initialUsername);
          setOriginalUsername(p.username ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Debounced availability check — skip entirely if unchanged from what's
  // already saved (no point re-checking a username this provider already owns).
  useEffect(() => {
    if (!isPro) return;
    if (username === originalUsername) { setUsernameStatus('idle'); return; }
    if (!isValidUsername(username)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const seq = ++checkSeq.current;
    const t = setTimeout(() => {
      isUsernameAvailable(username).then(ok => {
        if (checkSeq.current === seq) setUsernameStatus(ok ? 'available' : 'taken');
      }).catch(() => { if (checkSeq.current === seq) setUsernameStatus('idle'); });
    }, 500);
    return () => clearTimeout(t);
  }, [username, isPro, originalUsername]);

  const bookingUrl = `${BOOKING_LINK_ORIGIN}/b/${username}`;

  async function copyLink() {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      await Share.share({ message: bookingUrl });
    }
  }

  async function shareLink() {
    await Share.share({ message: `Réservez directement avec ${name} sur Sèvizi : ${bookingUrl}` });
  }

  async function addPhoto() {
    setError('');
    if (gallery.length >= galleryCap) {
      setError(`Limite de ${GALLERY_CAP_FREE} photos atteinte. Passez à Sèvizi Pro pour une galerie illimitée.`);
      return;
    }
    const file = await pickFile();
    if (!file) { setError('Sélection de photo indisponible sur cet appareil.'); return; }
    setUploading(true);
    try {
      const url = await uploadDocument(file.blob, 'gallery', file.name);
      setGallery(g => [...g, url]);
    } catch (e: any) {
      setError(e.message ?? 'Échec du téléversement.');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setGallery(g => g.filter(u => u !== url));
  }

  function toggleExtraCategory(c: ServiceCategory) {
    if (!isPro) { router.push('/provider/upgrade'); return; }
    setExtraCategories(list => list.includes(c) ? list.filter(x => x !== c) : [...list, c]);
  }

  function selectPrimaryCategory(c: ServiceCategory) {
    setPrimaryCategory(c);
    // Can't be both the main service and an "extra" at the same time.
    setExtraCategories(list => list.filter(x => x !== c));
  }

  async function save() {
    if (!name.trim()) { setError('Le nom de l\'entreprise est requis.'); return; }
    if (!primaryCategory) { setError('Choisissez votre service principal.'); return; }
    if (isPro && username !== originalUsername && usernameStatus !== 'available') {
      setError(usernameStatus === 'taken' ? 'Ce nom de lien est déjà pris.' : 'Choisissez un nom de lien valide et disponible avant d\'enregistrer.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const parsedYears = yearsActive.trim() === '' ? 0 : Math.max(0, parseInt(yearsActive, 10) || 0);
      await updateProviderProfile({
        name: name.trim(), bio: bio.trim(), gallery,
        category: primaryCategory ?? undefined,
        categories: extraCategories,
        yearsActive: parsedYears,
      });
      if (isPro && username !== originalUsername) {
        await updateProviderUsername(username);
      }
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Échec de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Modifier le profil</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[text.label, { color: colors.textMuted }]}>NOM DE L'ENTREPRISE</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom de l'entreprise" placeholderTextColor={colors.textMuted} />

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>À PROPOS</Text>
          <TextInput
            style={styles.textarea}
            value={bio}
            onChangeText={setBio}
            placeholder="Décrivez vos services, votre expérience…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>ANNÉES D'EXPÉRIENCE</Text>
          <TextInput
            style={styles.input}
            value={yearsActive}
            onChangeText={v => setYearsActive(v.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
            GALERIE DE TRAVAUX {isPro ? '(illimitée — Pro)' : `(${gallery.length}/${GALLERY_CAP_FREE})`}
          </Text>
          <View style={styles.gallery}>
            {gallery.map((url, i) => (
              <View key={i} style={styles.galleryItem}>
                <Image source={{ uri: url }} style={styles.galleryImg} resizeMode="cover" />
                <Pressable style={styles.removeBtn} onPress={() => removePhoto(url)}>
                  <X size={12} color={colors.white} />
                </Pressable>
              </View>
            ))}
            {gallery.length < galleryCap ? (
              <Pressable style={[styles.galleryItem, styles.addTile]} onPress={addPhoto} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color={colors.vert} /> : <ImagePlus size={24} color={colors.textMuted} />}
              </Pressable>
            ) : (
              <Pressable style={[styles.galleryItem, styles.addTile]} onPress={() => router.push('/provider/upgrade')}>
                <Lock size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>SERVICE PRINCIPAL</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
            Le métier sous lequel vous apparaissez dans les recherches et catégories.
          </Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => {
              const active = c.key === primaryCategory;
              return (
                <Pressable
                  key={c.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => selectPrimaryCategory(c.key)}
                >
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
            SERVICES SUPPLÉMENTAIRES {!isPro && '(Pro)'}
          </Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
            {isPro
              ? 'Proposez plusieurs métiers (ex. plomberie + électricité) pour recevoir plus de demandes.'
              : "Réservé à Sèvizi Pro — ajoutez d'autres services que votre catégorie principale."}
          </Text>
          <View style={styles.chips}>
            {CATEGORIES.filter(c => c.key !== primaryCategory).map(c => {
              const active = extraCategories.includes(c.key);
              return (
                <Pressable
                  key={c.key}
                  style={[styles.chip, active && styles.chipActive, !isPro && styles.chipLocked]}
                  onPress={() => toggleExtraCategory(c.key)}
                >
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{c.label}</Text>
                  {!isPro && <Lock size={11} color={colors.textMuted} />}
                </Pressable>
              );
            })}
          </View>

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
            LIEN DE RÉSERVATION {!isPro && '(Pro)'}
          </Text>
          {isPro ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[text.small, { color: colors.textMuted }]}>
                Partagez ce lien avec vos clients pour qu'ils réservent directement avec vous.
              </Text>
              <View style={styles.usernameRow}>
                <Text style={[text.body, { color: colors.textMuted }]}>{BOOKING_LINK_ORIGIN}/b/</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={username}
                  onChangeText={v => setUsername(slugify(v))}
                  placeholder="votre-nom"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameStatus === 'checking' && <ActivityIndicator size="small" color={colors.textMuted} />}
                {usernameStatus === 'available' && <Check size={18} color={colors.vert} />}
              </View>
              {usernameStatus === 'taken' && <Text style={styles.error}>Ce nom est déjà pris.</Text>}
              {usernameStatus === 'invalid' && <Text style={styles.error}>3 à 30 caractères : lettres, chiffres, tirets.</Text>}
              {originalUsername && (
                <View style={styles.linkActions}>
                  <Button
                    label={copied ? 'Copié !' : 'Copier le lien'}
                    variant="ghost"
                    icon={copied ? <Check size={16} color={colors.encre} /> : <Copy size={16} color={colors.encre} />}
                    full={false}
                    style={{ flex: 1 }}
                    onPress={copyLink}
                  />
                  <Button
                    label="Partager"
                    icon={<Share2 size={16} color={colors.white} />}
                    full={false}
                    style={{ flex: 1 }}
                    onPress={shareLink}
                  />
                </View>
              )}
            </View>
          ) : (
            <Pressable style={styles.lockedBox} onPress={() => router.push('/provider/upgrade')}>
              <Lock size={14} color={colors.textMuted} />
              <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>
                Passez à Sèvizi Pro pour obtenir un lien de réservation à partager avec vos clients.
              </Text>
            </Pressable>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: spacing.xl }} />
          <Button label="Enregistrer" onPress={save} loading={saving} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, height: 52, marginTop: spacing.sm,
    fontSize: 16, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  textarea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.lg, minHeight: 100, marginTop: spacing.sm,
    fontSize: 15, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
  galleryImg: { width: '100%', height: '100%' },
  addTile: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  chipLocked: { opacity: 0.6 },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.md },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 52 },
  usernameInput: { flex: 1, fontSize: 16, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none' } as any,
  linkActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm },
});
