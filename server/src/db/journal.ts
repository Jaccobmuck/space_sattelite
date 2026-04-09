import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import sharp from 'sharp';

// Allowed image MIME types and their binary magic bytes
const IMAGE_SIGNATURES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],           // JPEG magic bytes
  'image/png': [0x89, 0x50, 0x4E, 0x47],      // PNG magic bytes
  'image/gif': [0x47, 0x49, 0x46],            // GIF magic bytes (GIF)
  'image/webp': [0x52, 0x49, 0x46, 0x46],     // WebP RIFF header
};

// Max decoded image size: 500KB
const MAX_IMAGE_BYTES = 500 * 1024;

// Max image dimensions to prevent decompression bombs
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateBase64Image(base64String: string): Promise<ImageValidationResult> {
  if (!base64String) {
    return { valid: true };
  }

  // Check for data URL format and extract MIME type
  const dataUrlMatch = base64String.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  
  let declaredMime: string | null = null;
  let base64Data: string;

  if (dataUrlMatch) {
    declaredMime = dataUrlMatch[1].toLowerCase();
    base64Data = dataUrlMatch[2];
  } else {
    base64Data = base64String;
  }

  // Validate declared MIME type if provided
  if (declaredMime && !IMAGE_SIGNATURES[declaredMime]) {
    return { valid: false, error: `Invalid image type: ${declaredMime}. Allowed: JPEG, PNG, GIF, WebP` };
  }

  // Validate base64 format before decoding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) {
    return { valid: false, error: 'Invalid base64 encoding' };
  }

  // Actually decode the base64 to verify it and check real size
  let bytes: Uint8Array;
  try {
    const binaryString = atob(base64Data);
    bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  } catch {
    return { valid: false, error: 'Failed to decode base64 data' };
  }

  // Check actual decoded size
  if (bytes.length > MAX_IMAGE_BYTES) {
    return { valid: false, error: `Image exceeds ${MAX_IMAGE_BYTES / 1024}KB limit` };
  }

  // Verify magic bytes match a known image format
  let detectedFormat: string | null = null;
  for (const [mime, signature] of Object.entries(IMAGE_SIGNATURES)) {
    if (bytes.length >= signature.length) {
      const matches = signature.every((byte, i) => bytes[i] === byte);
      if (matches) {
        detectedFormat = mime;
        break;
      }
    }
  }

  if (!detectedFormat) {
    return { valid: false, error: 'Unrecognized image format. Allowed: JPEG, PNG, GIF, WebP' };
  }

  // Verify declared MIME matches detected format
  if (declaredMime && declaredMime !== detectedFormat) {
    return { valid: false, error: `MIME type mismatch: declared ${declaredMime} but detected ${detectedFormat}` };
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(Buffer.from(bytes), {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: 'error',
    }).metadata();
  } catch {
    return { valid: false, error: 'Failed to decode image data' };
  }

  if (!metadata.width || !metadata.height) {
    return { valid: false, error: 'Unable to determine image dimensions' };
  }

  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    return { valid: false, error: `Image dimensions exceed ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} limit` };
  }
  if (metadata.width <= 0 || metadata.height <= 0) {
    return { valid: false, error: 'Invalid image dimensions' };
  }

  return { valid: true };
}

export interface JournalEntry {
  id: string;
  user_id: string;
  satellite_name: string;
  satellite_id: string | null; // NORAD catalog ID; null for entries pre-dating migration
  pass_timestamp: string;
  duration_seconds: number | null; // sighting duration in seconds; null if not recorded
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
  satellite_id?: string;
  pass_timestamp: string;
  duration_seconds?: number;
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
    const validation = await validateBase64Image(input.card_image);
    if (!validation.valid) {
      return { data: null, error: validation.error || 'Invalid image' };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .insert({
      user_id: input.user_id,
      satellite_name: input.satellite_name,
      satellite_id: input.satellite_id || null,
      pass_timestamp: input.pass_timestamp,
      duration_seconds: input.duration_seconds ?? null,
      city: input.city || null,
      region: input.region || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
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
    logger.error('Failed to fetch user journal entries', {
      userId,
      page,
      limit,
      code: error?.code,
      message: error?.message,
    });
    throw new Error(error?.message || 'Failed to fetch journal entries');
  }

  return { entries: data as JournalEntry[], total: count || 0 };
}

export async function updateJournalEntry(
  id: string,
  userId: string,
  fields: UpdateJournalEntryInput
): Promise<{ success: boolean; entry?: JournalEntry; error?: string }> {
  // Return the updated row to verify ownership and avoid re-fetching by raw id
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .update(fields)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    // PGRST116 = no rows returned (entry doesn't exist or not owned by user)
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Entry not found or not authorized' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, entry: data as JournalEntry };
}

export async function deleteJournalEntry(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: 'Entry not found or not authorized' };
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
