import { Redirect } from 'expo-router';

// TODO: check Supabase session → route to /client/home or /provider/dashboard if authenticated
export default function Index() {
  return <Redirect href="/onboarding/phone" />;
}
