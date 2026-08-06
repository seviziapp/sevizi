import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

// react-native-web ships Alert.alert as a literal empty function — every
// screen that relied on it for error/success feedback or confirm dialogs
// was silently doing nothing on the deployed web app (native is unaffected).
// Same (title, message, buttons) signature as RN's Alert.alert, so it's a
// drop-in replacement — falls back to window.alert/window.confirm on web.
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  if (!buttons || buttons.length <= 1) {
    if (typeof window !== 'undefined') window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const confirmBtn = buttons.find(b => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  if (typeof window !== 'undefined' && window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
