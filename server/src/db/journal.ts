import { supabaseAdmin } from '../lib/supabase.js';

export interface JournalEntry {
  id: string;
  user_id: string;
  satellite_name: string;
  pass_timestamp: string;
  city: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  star_rating: number | null;
  notes: string | null;
  card_image: string | null; // base64, max 500KB. TODO: migrate to CDN
  outcome: 'saw_it' | 'missed_it' | 'cloudy';
  is_public: boolean;
  created_at: string;
}

export interface CreateJournalEntryInput {
  user_id: string;
  satellite_name: string;
  pass_timestamp: string;
  city?: string;
  region?: string;
  lat?: number;
  lng?: number;
  star_rating?: number;
  notes?: string;
  card_image?: string;
  outcome: 'saw_it' | 'missed_it' | 'cloudy';
  is_public?: boolean;
}

export interface UpdateJournalEntryInput {
  notes?: string;
  is_public?: boolean;
  star_rating?: number;
}

// Max base64 string length for ~500KB image
const MAX_CARD_IMAGE_LENGTH = 682668;

export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<{ data: JournalEntry | null; error: string | null }> {
  // Validate card_image size
  if (input.card_image && input.card_image.length > MAX_CARD_IMAGE_LENGTH) {
    return { data: null, error: 'Card image exceeds 500KB limit' };
  }

  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      user_id: input.user_id,
      satellite_name: input.satellite_name,
      pass_timestamp: input.pass_timestamp,
      city: input.city || null,
      region: input.region || null,
      lat: input.lat || null,
      lng: input.lng || null,
      star_rating: input.star_rating || null,
      notes: input.notes || null,
      card_image: input.card_image || null,
      outcome: input.outcome,
      is_public: input.is_public ?? true,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as JournalEntry, error: null };
}

export async function getJournalEntryById(id: string): Promise<JournalEntry | null> {
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as JournalEntry;
}

export async function getUserJournalEntries(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ entries: JournalEntry[]; total: number }> {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('journal_entries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return { entries: [], total: 0 };
  }

  return { entries: data as JournalEntry[], total: count || 0 };
}

export async function updateJournalEntry(
  id: string,
  userId: string,
  fields: UpdateJournalEntryInput
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('journal_entries')
    .update(fields)
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteJournalEntry(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function toggleJournalEntryVisibility(
  id: string,
  userId: string
): Promise<{ success: boolean; isPublic?: boolean; error?: string }> {
  // First get current visibility
  const entry = await getJournalEntryById(id);
  if (!entry) {
    return { success: false, error: 'Entry not found' };
  }

  if (entry.user_id !== userId) {
    return { success: false, error: 'Not authorized' };
  }

  const newVisibility = !entry.is_public;

  const { error } = await supabaseAdmin
    .from('journal_entries')
    .update({ is_public: newVisibility })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, isPublic: newVisibility };
}
