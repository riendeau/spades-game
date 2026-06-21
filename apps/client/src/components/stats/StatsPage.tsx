import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BidStats, NilStats, RecentGame } from '../../hooks/use-stats';
import { useStats } from '../../hooks/use-stats';

export function StatsPage() {
  const { stats, bidStats, nilStats, loading } = useStats();

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

            {/* Bidding stats */}
            {bidStats && bidStats.totalRounds > 0 && (
              <BiddingSection bidStats={bidStats} />
            )}

            {/* Nil bids */}
            {nilStats && nilStats.totalAttempts > 0 && (
              <NilBidsSection nilStats={nilStats} />
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

function BiddingSection({ bidStats }: { bidStats: BidStats }) {
  const o = bidStats.others;
  return (
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
          Bidding
        </h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1px',
          backgroundColor: '#e5e7eb',
        }}
      >
        <BidStatCell
          label="Avg Bid (you / team)"
          value={`${bidStats.individualAvgBid.toFixed(1)} / ${bidStats.teamAvgBid.toFixed(1)}`}
          sub={
            o
              ? `vs others ${o.individualAvgBid.toFixed(1)} / ${o.teamAvgBid.toFixed(1)}`
              : undefined
          }
          tooltip="Your average bid per round (left) and your team's combined bid — you plus your partner (right). Nil and blind-nil hands count as a bid of 0. The comparison line is the same figures for every other player and for every team that didn't include you."
        />
        <BidStatCell
          label="Avg Tricks (you / team)"
          value={`${bidStats.individualAvgTricks.toFixed(1)} / ${bidStats.teamAvgTricks.toFixed(1)}`}
          sub={
            o
              ? `vs others ${o.individualAvgTricks.toFixed(1)} / ${o.teamAvgTricks.toFixed(1)}`
              : undefined
          }
          tooltip="Your average tricks taken per round (left) and your team's combined tricks (right). Nil hands are included — the tricks a nil bidder takes still count toward the team total. The comparison line is every other player and every team that didn't include you."
        />
        <BidStatCell
          label="Avg Bags"
          value={bidStats.avgBags.toFixed(1)}
          color="#d97706"
          sub={o ? `vs other teams ${o.avgBags.toFixed(1)}` : undefined}
          tooltip="Your team's average bags per round — tricks taken beyond your combined contract, counted only when the team makes its bid (a set or a double-nil round produces no bags). Bags are a team quantity — 10 accumulated bags cost 100 points — so this is measured per team-round. Nil hands are included. The comparison line is the average for every team that didn't include you."
        />
        <BidStatCell
          label="Set Rate"
          value={`${bidStats.setBidRate}%`}
          color="#dc2626"
          sub={o ? `vs other teams ${o.setBidRate}%` : undefined}
          tooltip="Percent of rounds where your team was set — you and your partner's combined tricks fell short of your combined bid. Every round you played counts, including ones where you or your partner bid nil (a nil counts as 0 toward the combined bid). The comparison line is the set rate for every team that didn't include you. See Nil Bids below for how nil outcomes are tracked."
        />
      </div>
      <div
        style={{
          padding: '10px 20px',
          fontSize: '12px',
          color: '#9ca3af',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        {bidStats.totalRounds} rounds played
      </div>
    </div>
  );
}

function BidStatCell({
  label,
  value,
  color = '#374151',
  sub,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  tooltip?: string;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const showTooltip = (e: React.SyntheticEvent<HTMLSpanElement>) => {
    setRect(e.currentTarget.getBoundingClientRect());
  };
  const hideTooltip = () => setRect(null);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '14px 20px',
      }}
    >
      <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
      {sub && (
        <div
          style={{
            fontSize: '11px',
            color: '#9ca3af',
            marginTop: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </div>
      )}
      <div
        style={{
          fontSize: '12px',
          color: '#6b7280',
          marginTop: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {label}
        {tooltip && (
          <span
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            tabIndex={0}
            onFocus={showTooltip}
            onBlur={hideTooltip}
            aria-label={tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              border: '1px solid #9ca3af',
              color: '#9ca3af',
              fontSize: '10px',
              fontWeight: 600,
              lineHeight: 1,
              cursor: 'help',
            }}
          >
            ?
          </span>
        )}
      </div>
      {tooltip &&
        rect &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: rect.bottom + 8,
              left: rect.left + rect.width / 2,
              transform: 'translateX(-50%)',
              width: 'min(300px, calc(100vw - 24px))',
              backgroundColor: '#1f2937',
              color: '#f9fafb',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: 1.5,
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {tooltip}
          </div>,
          document.body
        )}
    </div>
  );
}

function NilBidsSection({ nilStats }: { nilStats: NilStats }) {
  return (
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
          Nil Bids
        </h2>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1px',
          backgroundColor: '#e5e7eb',
        }}
      >
        <BidStatCell label="Attempts" value={String(nilStats.totalAttempts)} />
        <BidStatCell
          label="Success Rate"
          value={`${nilStats.successRate}%`}
          color="#16a34a"
        />
        <BidStatCell
          label="Blind Nil"
          value={`${nilStats.blindNilAttempts > 0 ? nilStats.blindNilSucceeded : 0}/${nilStats.blindNilAttempts}`}
        />
      </div>
      {nilStats.asPartner.totalAttempts > 0 && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '13px',
            color: '#374151',
          }}
        >
          As partner (protecting):{' '}
          <span style={{ fontWeight: 600 }}>
            {nilStats.asPartner.succeeded}/{nilStats.asPartner.totalAttempts}
          </span>{' '}
          succeeded ({nilStats.asPartner.successRate}%)
        </div>
      )}
    </div>
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
