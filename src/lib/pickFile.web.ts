// Web: open the native file chooser and return the selected file.
export type PickedFile = { uri: string; name: string; blob: Blob };

export async function pickFile(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      resolve({ uri: URL.createObjectURL(file), name: file.name, blob: file });
    };
    // If the user cancels, onchange never fires; that's fine — the promise just stays unresolved
    // until the next pick. Acceptable for this one-shot UI.
    input.click();
  });
}
