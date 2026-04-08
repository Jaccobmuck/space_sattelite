import { supabaseAdmin } from '../lib/supabase.js';
import type { JournalEntry } from './journal.js';
import { logger } from '../lib/logger.js';

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
    
    // Special case for polar regions: cos(90°) = 0 causes division issues
    // At high latitudes (>85°), use a wide longitude range since distances converge
    const cosLat = Math.cos(userLat * Math.PI / 180);
    const lngDelta = Math.abs(cosLat) < 0.087 // ~85 degrees latitude
      ? 180 // Near poles, search all longitudes
      : HAVERSINE_DISTANCE_KM / (111 * cosLat);
    
    query = query
      .gte('lat', userLat - latDelta)
      .lte('lat', userLat + latDelta)
      .gte('lng', userLng - lngDelta)
      .lte('lng', userLng + lngDelta);
  }

  if (tab !== 'near_you') {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    logger.error('Error fetching community feed', {
      tab,
      page,
      limit,
      currentUserId,
      code: error.code,
      message: error.message,
    });
    throw new Error(`Database error fetching community feed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { sightings: [], total: 0, hasMore: false };
  }

  // For "near_you", apply precise Haversine filter before paginating so totals stay honest.
  let filteredData = data;
  if (tab === 'near_you' && userLat !== undefined && userLng !== undefined) {
    filteredData = data.filter((entry) => {
      if (entry.lat === null || entry.lng === null) return false;
      const distance = haversineDistance(userLat, userLng, entry.lat, entry.lng);
      return distance <= HAVERSINE_DISTANCE_KM;
    });
  }

  const paginatedData = tab === 'near_you'
    ? filteredData.slice(offset, offset + limit)
    : filteredData;

  // Batch fetch like/comment counts and user likes to avoid N+1 queries
  const sightingIds = paginatedData.map(entry => entry.id);
  const [likeCounts, commentCounts, userLikes] = await Promise.all([
    getBatchLikeCounts(sightingIds),
    getBatchCommentCounts(sightingIds),
    currentUserId ? getBatchUserLikes(currentUserId, sightingIds) : new Set<string>(),
  ]);

  const sightings = paginatedData.map((entry) => {
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

  const actualTotal = tab === 'near_you' ? filteredData.length : (count || 0);
  const hasMore = offset + limit < actualTotal;

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
): Promise<{ liked: boolean; likeCount: number; error?: string }> {
  const alreadyLiked = await hasUserLiked(userId, sightingId);

  if (alreadyLiked) {
    // Unlike - check for errors
    const { error } = await supabaseAdmin
      .from('community_likes')
      .delete()
      .eq('user_id', userId)
      .eq('sighting_id', sightingId);
    
    if (error) {
      logger.error('Failed to remove community like', {
        userId,
        sightingId,
        code: error.code,
        message: error.message,
      });
      return { liked: true, likeCount: await getLikeCount(sightingId), error: 'Failed to unlike' };
    }
  } else {
    // Like - use upsert to handle race conditions with uniqueness constraint
    const { error } = await supabaseAdmin
      .from('community_likes')
      .upsert(
        { user_id: userId, sighting_id: sightingId },
        { onConflict: 'user_id,sighting_id', ignoreDuplicates: true }
      );
    
    if (error) {
      logger.error('Failed to create community like', {
        userId,
        sightingId,
        code: error.code,
        message: error.message,
      });
      return { liked: false, likeCount: await getLikeCount(sightingId), error: 'Failed to like' };
    }
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
    logger.error('Failed to fetch community comments', {
      sightingId,
      page,
      limit,
      code: error?.code,
      message: error?.message,
    });
    throw new Error(error?.message || 'Failed to fetch comments');
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
    .eq('is_public', true)
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

  // Batch fetch like/comment counts and user likes to avoid N+1 queries
  const sightingIds = data.map(entry => entry.id);
  const [likeCounts, commentCounts, userLikes] = await Promise.all([
    getBatchLikeCounts(sightingIds),
    getBatchCommentCounts(sightingIds),
    currentUserId ? getBatchUserLikes(currentUserId, sightingIds) : new Set<string>(),
  ]);

  const sightings = data.map((entry) => {
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

// ============================================
// Leaderboard
// ============================================

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  sighting_count: number;
}

export async function getLeaderboard(
  period: 'week' | 'month' | 'all' = 'all',
  limit: number = 20
): Promise<LeaderboardEntry[]> {
  // Calculate date filter based on period
  let dateFilter: string | null = null;
  const now = new Date();
  
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateFilter = weekAgo.toISOString();
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    dateFilter = monthAgo.toISOString();
  }

  // Build query for public saw_it entries grouped by user
  let query = supabaseAdmin
    .from('journal_entries')
    .select('user_id')
    .eq('is_public', true)
    .eq('outcome', 'saw_it');

  if (dateFilter) {
    query = query.gte('created_at', dateFilter);
  }

  const { data: entries, error } = await query;

  if (error || !entries) {
    logger.error('Failed to fetch leaderboard entries', {
      period,
      code: error?.code,
      message: error?.message,
    });
    return [];
  }

  // Count sightings per user
  const userCounts = new Map<string, number>();
  entries.forEach((entry) => {
    userCounts.set(entry.user_id, (userCounts.get(entry.user_id) || 0) + 1);
  });

  // Sort by count and take top N
  const sortedUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sortedUsers.length === 0) {
    return [];
  }

  // Fetch profile info for top users
  const userIds = sortedUsers.map(([userId]) => userId);
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, avatar')
    .in('id', userIds);

  if (!profiles) {
    return [];
  }

  // Build leaderboard with profile info
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  
  return sortedUsers
    .map(([userId, count]) => {
      const profile = profileMap.get(userId);
      if (!profile || !profile.username) return null;
      
      return {
        user_id: userId,
        username: profile.username,
        display_name: profile.display_name,
        avatar: profile.avatar,
        sighting_count: count,
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null);
}
