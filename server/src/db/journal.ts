import { supabaseAdmin } from '../lib/supabase.js';

// Allowed image MIME types and their base64 signatures
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '/9j/',      // JPEG starts with FFD8FF
  'image/png': 'iVBORw0K',   // PNG signature
  'image/gif': 'R0lGOD',     // GIF signature
  'image/webp': 'UklGR',     // WebP RIFF signature
};

// Max decoded image size: 500KB
const MAX_IMAGE_BYTES = 500 * 1024;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateBase64Image(base64String: string): ImageValidationResult {
  if (!base64String) {
    return { valid: true };
  }

  // Check for data URL format and extract MIME type
  const dataUrlMatch = base64String.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  
  let mimeType: string | null = null;
  let base64Data: string;

  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64Data = dataUrlMatch[2];
  } else {
    // Raw base64 - try to detect from signature
    base64Data = base64String;
  }

  // Validate MIME type if provided
  if (mimeType && !ALLOWED_IMAGE_TYPES[mimeType]) {
    return { valid: false, error: `Invalid image type: ${mimeType}. Allowed: JPEG, PNG, GIF, WebP` };
  }

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }

  // Check decoded size (base64 is ~4/3 of original size)
  const estimatedBytes = Math.ceil((base64Data.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: `Image exceeds ${MAX_IMAGE_BYTES / 1024}KB limit` };
  }

  // Verify signature matches a known image type
  let signatureValid = false;
  for (const [type, signature] of Object.entries(ALLOWED_IMAGE_TYPES)) {
    if (base64Data.startsWith(signature)) {
      signatureValid = true;
      // If MIME was provided, verify it matches
      if (mimeType && mimeType !== type) {
        return { valid: false, error: `MIME type mismatch: declared ${mimeType} but signature indicates ${type}` };
      }
      break;
    }
  }

  if (!signatureValid) {
    return { valid: false, error: 'Unrecognized image format. Allowed: JPEG, PNG, GIF, WebP' };
  }

  return { valid: true };
}

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

export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<{ data: JournalEntry | null; error: string | null }> {
  // Validate card_image with MIME check and decoded size validation
  if (input.card_image) {
    const validation = validateBase64Image(input.card_image);
    if (!validation.valid) {
      return { data: null, error: validation.error || 'Invalid image' };
    }
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
