import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeaderboard, type LeaderboardEntry, type TimeFilter } from '../hooks/useLeaderboard';

export default function Leaderboard() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const { data, isLoading } = useLeaderboard(timeFilter);

  const leaders: LeaderboardEntry[] = data?.leaders || [];

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link to="/community" className="text-text-secondary hover:text-text-primary transition-colors">
              ← Back
            </Link>
            <h1 className="font-orbitron text-xl text-accent-blue tracking-wider">
              Leaderboard
            </h1>
            <div className="w-12" />
          </div>

          {/* Time filter tabs */}
          <div className="flex gap-2">
            {[
              { id: 'week' as TimeFilter, label: 'This Week' },
              { id: 'month' as TimeFilter, label: 'This Month' },
              { id: 'all' as TimeFilter, label: 'All Time' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeFilter(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg font-orbitron text-xs transition-colors ${
                  timeFilter === tab.id
                    ? 'bg-accent-blue/20 border border-accent-blue/50 text-accent-blue'
                    : 'bg-bg-secondary border border-border-glow text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="glass-panel p-4 rounded-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-bg-secondary" />
                  <div className="flex-1">
                    <div className="h-5 bg-bg-secondary rounded w-1/3 mb-1" />
                    <div className="h-4 bg-bg-secondary rounded w-1/4" />
                  </div>
                  <div className="h-8 w-16 bg-bg-secondary rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="font-orbitron text-xl text-text-primary mb-2">No observers yet</h2>
            <p className="text-text-secondary text-sm">
              Be the first to log a sighting and claim the top spot!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaders.map((leader, index) => (
              <Link
                key={leader.user_id}
                to={`/profile/${leader.username}`}
                className="glass-panel p-4 rounded-lg flex items-center gap-4 hover:border-accent-blue/50 transition-colors block"
              >
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-orbitron text-lg ${
                  index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                  index === 1 ? 'bg-gray-400/20 text-gray-300' :
                  index === 2 ? 'bg-orange-600/20 text-orange-400' :
                  'bg-bg-secondary text-text-secondary'
                }`}>
                  {getRankEmoji(index + 1)}
                </div>

                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-bg-secondary border border-border-glow overflow-hidden flex-shrink-0">
                  {leader.avatar ? (
                    <img
                      src={leader.avatar}
                      alt={leader.display_name || leader.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-accent-blue font-orbitron">
                      {(leader.display_name || leader.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium truncate">
                    {leader.display_name || leader.username}
                  </p>
                  <p className="text-text-secondary text-sm">@{leader.username}</p>
                </div>

                {/* Sighting count */}
                <div className="text-right">
                  <p className="font-orbitron text-xl text-accent-cyan">
                    {leader.sighting_count}
                  </p>
                  <p className="text-text-secondary text-xs">
                    sighting{leader.sighting_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
