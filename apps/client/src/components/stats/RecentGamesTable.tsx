import React from 'react';
import type { RecentGame } from '../../hooks/use-stats';

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

function RecentGameRow({
  game,
  edgePadding,
}: {
  game: RecentGame;
  edgePadding: string;
}) {
  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td
        style={{
          padding: `10px ${edgePadding}`,
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
          padding: `10px ${edgePadding}`,
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

/**
 * "Recent Games" card — the table shown on the stats page and, limited to the
 * last few games, under the waiting room's seat selection.
 */
export function RecentGamesTable({
  games,
  compact = false,
  style,
}: {
  games: RecentGame[];
  compact?: boolean;
  style?: React.CSSProperties;
}) {
  if (games.length === 0) return null;

  const edgePadding = compact ? '12px' : '20px';

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          padding: `${compact ? '12px' : '16px'} ${edgePadding}`,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h2
          style={{
            fontSize: compact ? '14px' : '16px',
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
          fontSize: compact ? '13px' : '14px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f9fafb' }}>
            <th
              style={{
                textAlign: 'left',
                padding: `10px ${edgePadding}`,
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
                padding: `10px ${edgePadding}`,
                color: '#6b7280',
                fontWeight: 500,
              }}
            >
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, i) => (
            <RecentGameRow key={i} game={game} edgePadding={edgePadding} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
