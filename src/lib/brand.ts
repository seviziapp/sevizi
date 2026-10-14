// Which front door is this visitor on? go.sevizi.app (web) is Sèvi Go: same
// app and backend as Sèvizi, but presented as its own product. Everything that
// shows a brand name or logo asks here.
import { Platform } from 'react-native';

export function isSevigoHost(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && /^go\./i.test(window.location.hostname);
}

export const BRAND_NAME = () => (isSevigoHost() ? 'Sèvi Go' : 'Sèvizi');
