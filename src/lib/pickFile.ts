// Native stub. A full native build would wire this to expo-image-picker /
// expo-document-picker. Web is the primary target for now, so this returns null.
export type PickedFile = { uri: string; name: string; blob: Blob };

export async function pickFile(): Promise<PickedFile | null> {
  return null;
}
