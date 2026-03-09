import React from 'react';
import type { RecentGame } from '../../hooks/use-stats';
import { useStats } from '../../hooks/use-stats';

export function StatsPage() {
  const { stats, loading } = useStats();

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse at center top, #1e5635 0%, #1a472a 60%, #133a21 100%)',
      }}
    >
      <div
        style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
          }}
        >
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              margin: 0,
            }}
          >
            Your Stats
          </h1>
          <a
            href="/"
            style={{
              color: 'rgba(255,255,255,0.6)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Back to Lobby
          </a>
        </div>

        {loading && (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              padding: '40px 0',
            }}
          >
            Loading stats...
          </div>
        )}

        {!loading && stats?.totalGames === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>♠</div>
            <p
              style={{
                fontSize: '18px',
                color: '#374151',
                fontWeight: 600,
                marginBottom: '8px',
              }}
            >
              No games played yet
            </p>
            <p
              style={{
                color: '#6b7280',
                fontSize: '14px',
                marginBottom: '24px',
              }}
            >
              Play a full game of Spades to see your stats here.
            </p>
            <a
              href="/"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: 500,
                fontSize: '15px',
              }}
            >
              Start a game
            </a>
          </div>
        )}

        {!loading && stats && stats.totalGames > 0 && (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px',
                marginBottom: '32px',
              }}
            >
              <StatCard
                label="Games"
                value={stats.totalGames}
                color="#374151"
              />
              <StatCard label="Wins" value={stats.wins} color="#16a34a" />
              <StatCard label="Losses" value={stats.losses} color="#dc2626" />
              <StatCard
                label="Win Rate"
                value={`${stats.winRate}%`}
                color="#2563eb"
              />
            </div>

            {/* Recent games */}
            {stats.recentGames.length > 0 && (
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1f2937',
                      margin: 0,
                    }}
                  >
                    Recent Games
                  </h2>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 20px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Partner
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Opponents
                      </th>
                      <th
                        style={{
                          textAlign: 'right',
                          padding: '10px 20px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentGames.map((game, i) => (
                      <RecentGameRow key={i} game={game} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Partner history */}
            {stats.partners.length > 0 && (
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <h2
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1f2937',
                      margin: 0,
                    }}
                  >
                    Partner History
                  </h2>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '10px 20px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Partner
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        Games
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        W
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '10px 12px',
                          color: '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.partners.map((partner) => (
                      <tr
                        key={partner.displayName}
                        style={{ borderTop: '1px solid #f3f4f6' }}
                      >
                        <td
                          style={{
                            padding: '10px 20px',
                            color: '#111827',
                            fontWeight: 500,
                          }}
                        >
                          {partner.displayName}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '10px 12px',
                            color: '#374151',
                          }}
                        >
                          {partner.gamesPlayed}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '10px 12px',
                            color: '#16a34a',
                          }}
                        >
                          {partner.wins}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '10px 12px',
                            color: '#dc2626',
                          }}
                        >
                          {partner.losses}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatGameTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / 3_600_000;

  if (diffHours < 24) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (diffHours < 168) {
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function RecentGameRow({ game }: { game: RecentGame }) {
  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td
        style={{
          padding: '10px 20px',
          color: '#6b7280',
          whiteSpace: 'nowrap',
        }}
      >
        {formatGameTime(game.completedAt)}
      </td>
      <td
        style={{
          padding: '10px 12px',
          color: '#111827',
          fontWeight: 500,
        }}
      >
        {game.partner}
      </td>
      <td
        style={{
          padding: '10px 12px',
          color: '#374151',
        }}
      >
        {game.opponents[0]} & {game.opponents[1]}
      </td>
      <td
        style={{
          padding: '10px 20px',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            color: game.won ? '#16a34a' : '#dc2626',
            fontWeight: 600,
          }}
        >
          {game.won ? 'W' : 'L'}
        </span>
        <span style={{ color: '#6b7280', marginLeft: '6px' }}>
          {game.myScore}–{game.opponentScore}
        </span>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
        {label}
      </div>
    </div>
  );
}
