import { supabaseAdmin } from '../lib/supabase.js';

export interface Profile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  stripe_customer_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
  location_city: string | null;
  location_region: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export type SafeUser = Omit<Profile, 'avatar'>;

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
  location_city: string | null;
  location_region: string | null;
  created_at: string;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export type ProfileUpdateFields = Partial<Pick<Profile, 
  'email' | 'plan' | 'stripe_customer_id' | 'username' | 'display_name' | 
  'avatar' | 'bio' | 'location_city' | 'location_region' | 'lat' | 'lng'
>>;

export async function updateProfile(
  userId: string,
  fields: ProfileUpdateFields
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update(fields)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update profile:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function updateUserPlan(userId: string, plan: 'free' | 'pro'): Promise<{ success: boolean; error?: string }> {
  return updateProfile(userId, { plan });
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<{ success: boolean; error?: string }> {
  return updateProfile(userId, { stripe_customer_id: stripeCustomerId });
}

export async function getProfileByStripeCustomerId(stripeCustomerId: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function deleteProfile(userId: string): Promise<void> {
  // Delete from Supabase Auth (this will cascade to profiles table)
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

// ============================================
// Profile functions for community feature
// ============================================

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  return !!data;
}

export async function setUsername(userId: string, username: string): Promise<{ success: boolean; error?: string }> {
  // Check if user already has a username (one-time only)
  const profile = await getProfileById(userId);
  if (profile?.username) {
    return { success: false, error: 'Username already set' };
  }

  // Check if username is taken
  const taken = await isUsernameTaken(username);
  if (taken) {
    return { success: false, error: 'Username already taken' };
  }

  const result = await updateProfile(userId, { username });
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to set username' };
  }
  return { success: true };
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, avatar, bio, location_city, location_region, created_at')
    .eq('username', username)
    .single();

  if (error || !data) return null;
  return data as PublicProfile;
}
