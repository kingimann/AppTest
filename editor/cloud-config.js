// Accounts and cloud sync for Pocket Engine (see docs/guide/accounts.md).
// Leave url and anonKey empty and the editor keeps a profile on this device only.
// Fill them in with your Supabase project's URL and anon (public) key to turn on sign-in and cloud sync for everyone.
// The anon key is meant to be public: the row-level security rules in supabase/schema.sql keep each person's projects private.
export const CLOUD = {
  provider: 'supabase',
  url: '', // e.g. 'https://abcdefghijkl.supabase.co'
  anonKey: '',
};
