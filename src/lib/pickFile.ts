// Native (Android/iOS) file picker — photos from the gallery. Web has its own
// implementation in pickFile.web.ts. This used to be a stub that returned
// null, so on the Android app every upload (ID / CFE verification, gallery,
// service photos, invoice logos, request photos) failed with "Sélection de
// fichier indisponible".
//
// React Native's Blob can't be built from binary data and uploads of a
// fetched Blob are unreliable, so the bytes are returned as an ArrayBuffer
// typed as `Blob` to keep every existing caller (`file.blob`) unchanged.
// supabase-js storage accepts an ArrayBuffer body; uploadDocument sets the
// contentType explicitly so the stored object isn't labelled text/plain.
import * as ImagePicker from 'expo-image-picker';

export type PickedFile = { uri: string; name: string; blob: Blob };

export async function pickFile(): Promise<PickedFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  const ext = asset.mimeType?.split('/')[1] ?? asset.uri.split('.').pop() ?? 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.${ext}`,
    blob: bytes as unknown as Blob,
  };
}
