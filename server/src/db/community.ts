import { supabaseAdmin } from '../lib/supabase.js';
import type { JournalEntry } from './journal.js';

export interface CommunitySighting extends JournalEntry {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };
  like_count: number;
  comment_count: number;
  user_liked: boolean;
}

export interface CommunityComment {
  id: string;
  user_id: string;
  sighting_id: string;
  text: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };
}

export type FeedTab = 'global' | 'near_you' | 'by_satellite';

// Check if a sighting is accessible (public or owned by user)
export async function isSightingAccessible(
  sightingId: string,
  currentUserId?: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('is_public, user_id')
    .eq('id', sightingId)
    .single();

  if (error || !data) return false;
  
  // Accessible if public or owned by current user
  return data.is_public || data.user_id === currentUserId;
}

export interface FeedQueryParams {
  tab: FeedTab;
  page: number;
  limit: number;
  satellite?: string;
  userLat?: number;
  userLng?: number;
  currentUserId?: string;
}

// Haversine distance calculation in km
// Used for "Near You" feed - calculates distance in SQL for performance
const HAVERSINE_DISTANCE_KM = 150;

// Batch query functions to avoid N+1 queries
async function getBatchLikeCounts(sightingIds: string[]): Promise<Map<string, number>> {
  if (sightingIds.length === 0) return new Map();
  
  const { data } = await supabaseAdmin
    .from('community_likes')
    .select('sighting_id')
    .in('sighting_id', sightingIds);

  const counts = new Map<string, number>();
  sightingIds.forEach(id => counts.set(id, 0));
  
  if (data) {
    data.forEach(like => {
      counts.set(like.sighting_id, (counts.get(like.sighting_id) || 0) + 1);
    });
  }
  
  return counts;
}

async function getBatchCommentCounts(sightingIds: string[]): Promise<Map<string, number>> {
  if (sightingIds.length === 0) return new Map();
  
  const { data } = await supabaseAdmin
    .from('community_comments')
    .select('sighting_id')
    .in('sighting_id', sightingIds);

  const counts = new Map<string, number>();
  sightingIds.forEach(id => counts.set(id, 0));
  
  if (data) {
    data.forEach(comment => {
      counts.set(comment.sighting_id, (counts.get(comment.sighting_id) || 0) + 1);
    });
  }
  
  return counts;
}

async function getBatchUserLikes(userId: string, sightingIds: string[]): Promise<Set<string>> {
  if (sightingIds.length === 0 || !userId) return new Set();
  
  const { data } = await supabaseAdmin
    .from('community_likes')
    .select('sighting_id')
    .eq('user_id', userId)
    .in('sighting_id', sightingIds);

  return new Set(data?.map(like => like.sighting_id) || []);
}

export async function getCommunityFeed(
  params: FeedQueryParams
): Promise<{ sightings: CommunitySighting[]; total: number; hasMore: boolean }> {
  const { tab, page, limit, satellite, userLat, userLng, currentUserId } = params;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('journal_entries')
    .select(`
      *,
      profiles!inner (
        id,
        username,
        display_name,
        avatar
      )
    `, { count: 'exact' })
    .eq('is_public', true)
    .eq('outcome', 'saw_it')
    .order('created_at', { ascending: false });

  // Apply tab-specific filters
  if (tab === 'by_satellite' && satellite) {
    query = query.eq('satellite_name', satellite);
  }

  // For "near_you" tab, we need to filter by distance
  // Supabase doesn't support Haversine directly, so we'll use a bounding box first
  // then filter more precisely in the application layer
  if (tab === 'near_you' && userLat !== undefined && userLng !== undefined) {
    // Approximate bounding box for 150km (rough: 1 degree ≈ 111km)
    const latDelta = HAVERSINE_DISTANCE_KM / 111;
    const lngDelta = HAVERSINE_DISTANCE_KM / (111 * Math.cos(userLat * Math.PI / 180));
    
    query = query
      .gte('lat', userLat - latDelta)
      .lte('lat', userLat + latDelta)
      .gte('lng', userLng - lngDelta)
      .lte('lng', userLng + lngDelta);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching community feed:', error);
    throw new Error(`Database error fetching community feed: ${error.message}`);
  }

  if (!data) {
    return { sightings: [], total: 0, hasMore: false };
  }

  // For "near_you", apply precise Haversine filter
  let filteredData = data;
  if (tab === 'near_you' && userLat !== undefined && userLng !== undefined) {
    filteredData = data.filter((entry) => {
      if (entry.lat === null || entry.lng === null) return false;
      const distance = haversineDistance(userLat, userLng, entry.lat, entry.lng);
      return distance <= HAVERSINE_DISTANCE_KM;
    });
  }

  // Batch fetch like/comment counts and user likes to avoid N+1 queries
  const sightingIds = filteredData.map(entry => entry.id);
  const [likeCounts, commentCounts, userLikes] = await Promise.all([
    getBatchLikeCounts(sightingIds),
    getBatchCommentCounts(sightingIds),
    currentUserId ? getBatchUserLikes(currentUserId, sightingIds) : new Set<string>(),
  ]);

  const sightings = filteredData.map((entry) => {
    const profile = entry.profiles as {
      id: string;
      username: string;
      display_name: string | null;
      avatar: string | null;
    };

    return {
      ...entry,
      profiles: undefined,
      user: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
      },
      like_count: likeCounts.get(entry.id) || 0,
      comment_count: commentCounts.get(entry.id) || 0,
      user_liked: userLikes.has(entry.id),
    } as CommunitySighting;
  });

  // For near_you tab, the total count from the bounding box query may not match
  // the actual filtered results, so we adjust hasMore based on actual data
  const actualTotal = tab === 'near_you' ? filteredData.length : (count || 0);
  const hasMore = tab === 'near_you' 
    ? filteredData.length === limit // If we got a full page, there might be more
    : offset + limit < (count || 0);

  return {
    sightings,
    total: tab === 'near_you' ? actualTotal : (count || 0),
    hasMore,
  };
}

export async function getSightingById(
  id: string,
  currentUserId?: string
): Promise<CommunitySighting | null> {
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select(`
      *,
      profiles!inner (
        id,
        username,
        display_name,
        avatar
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) return null;

  // Check if entry is public or belongs to current user
  if (!data.is_public && data.user_id !== currentUserId) {
    return null;
  }

  const [likeCount, commentCount, userLiked] = await Promise.all([
    getLikeCount(id),
    getCommentCount(id),
    currentUserId ? hasUserLiked(currentUserId, id) : false,
  ]);

  const profile = data.profiles as {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };

  return {
    ...data,
    profiles: undefined,
    user: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar: profile.avatar,
    },
    like_count: likeCount,
    comment_count: commentCount,
    user_liked: userLiked,
  } as CommunitySighting;
}

// ============================================
// Likes
// ============================================

export async function getLikeCount(sightingId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('community_likes')
    .select('*', { count: 'exact', head: true })
    .eq('sighting_id', sightingId);

  return count || 0;
}

export async function hasUserLiked(userId: string, sightingId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('community_likes')
    .select('id')
    .eq('user_id', userId)
    .eq('sighting_id', sightingId)
    .single();

  return !!data;
}

export async function toggleLike(
  userId: string,
  sightingId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const alreadyLiked = await hasUserLiked(userId, sightingId);

  if (alreadyLiked) {
    // Unlike
    await supabaseAdmin
      .from('community_likes')
      .delete()
      .eq('user_id', userId)
      .eq('sighting_id', sightingId);
  } else {
    // Like
    await supabaseAdmin
      .from('community_likes')
      .insert({ user_id: userId, sighting_id: sightingId });
  }

  const likeCount = await getLikeCount(sightingId);
  return { liked: !alreadyLiked, likeCount };
}

// ============================================
// Comments
// ============================================

export async function getCommentCount(sightingId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('community_comments')
    .select('*', { count: 'exact', head: true })
    .eq('sighting_id', sightingId);

  return count || 0;
}

export async function getComments(
  sightingId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ comments: CommunityComment[]; total: number }> {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('community_comments')
    .select(`
      *,
      profiles!inner (
        id,
        username,
        display_name,
        avatar
      )
    `, { count: 'exact' })
    .eq('sighting_id', sightingId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return { comments: [], total: 0 };
  }

  const comments = data.map((comment) => {
    const profile = comment.profiles as {
      id: string;
      username: string;
      display_name: string | null;
      avatar: string | null;
    };

    return {
      id: comment.id,
      user_id: comment.user_id,
      sighting_id: comment.sighting_id,
      text: comment.text,
      created_at: comment.created_at,
      user: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
      },
    } as CommunityComment;
  });

  return { comments, total: count || 0 };
}

export async function createComment(
  userId: string,
  sightingId: string,
  text: string
): Promise<{ comment: CommunityComment | null; error: string | null }> {
  if (text.length > 200) {
    return { comment: null, error: 'Comment exceeds 200 character limit' };
  }

  const { data, error } = await supabaseAdmin
    .from('community_comments')
    .insert({ user_id: userId, sighting_id: sightingId, text })
    .select(`
      *,
      profiles!inner (
        id,
        username,
        display_name,
        avatar
      )
    `)
    .single();

  if (error || !data) {
    return { comment: null, error: error?.message || 'Failed to create comment' };
  }

  const profile = data.profiles as {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };

  return {
    comment: {
      id: data.id,
      user_id: data.user_id,
      sighting_id: data.sighting_id,
      text: data.text,
      created_at: data.created_at,
      user: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
      },
    },
    error: null,
  };
}

// ============================================
// Satellites list (for filter dropdown)
// ============================================

export async function getDistinctSatellites(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('satellite_name')
    .eq('is_public', true)
    .eq('outcome', 'saw_it');

  if (error || !data) return [];

  // Get unique satellite names
  const satellites = [...new Set(data.map((d) => d.satellite_name))];
  return satellites.sort();
}

// ============================================
// User profile stats
// ============================================

export interface ProfileStats {
  totalSightings: number;
  uniqueSatellites: number;
  currentStreak: number;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  // Get all saw_it entries for the user
  const { data: entries } = await supabaseAdmin
    .from('journal_entries')
    .select('satellite_name, created_at')
    .eq('user_id', userId)
    .eq('outcome', 'saw_it')
    .order('created_at', { ascending: false });

  if (!entries || entries.length === 0) {
    return { totalSightings: 0, uniqueSatellites: 0, currentStreak: 0 };
  }

  const totalSightings = entries.length;
  const uniqueSatellites = new Set(entries.map((e) => e.satellite_name)).size;

  // Calculate current streak (consecutive days with sightings)
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sightingDates = entries.map((e) => {
    const date = new Date(e.created_at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  });

  const uniqueDates = [...new Set(sightingDates)].sort((a, b) => b - a);

  for (let i = 0; i < uniqueDates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);
    expectedDate.setHours(0, 0, 0, 0);

    if (uniqueDates[i] === expectedDate.getTime()) {
      currentStreak++;
    } else if (i === 0 && uniqueDates[i] === expectedDate.getTime() - 86400000) {
      // Allow streak to continue if last sighting was yesterday
      currentStreak++;
    } else {
      break;
    }
  }

  return { totalSightings, uniqueSatellites, currentStreak };
}

export async function getUserPublicSightings(
  userId: string,
  page: number = 1,
  limit: number = 20,
  currentUserId?: string
): Promise<{ sightings: CommunitySighting[]; total: number; hasMore: boolean }> {
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('journal_entries')
    .select(`
      *,
      profiles!inner (
        id,
        username,
        display_name,
        avatar
      )
    `, { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_public', true)
    .eq('outcome', 'saw_it')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    return { sightings: [], total: 0, hasMore: false };
  }

  const sightings = await Promise.all(
    data.map(async (entry) => {
      const [likeCount, commentCount, userLiked] = await Promise.all([
        getLikeCount(entry.id),
        getCommentCount(entry.id),
        currentUserId ? hasUserLiked(currentUserId, entry.id) : false,
      ]);

      const profile = entry.profiles as {
        id: string;
        username: string;
        display_name: string | null;
        avatar: string | null;
      };

      return {
        ...entry,
        profiles: undefined,
        user: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar: profile.avatar,
        },
        like_count: likeCount,
        comment_count: commentCount,
        user_liked: userLiked,
      } as CommunitySighting;
    })
  );

  return {
    sightings,
    total: count || 0,
    hasMore: offset + limit < (count || 0),
  };
}

// ============================================
// Utility functions
// ============================================

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
