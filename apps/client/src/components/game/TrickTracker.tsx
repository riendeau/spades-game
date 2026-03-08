import type { ClientGameState } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import {
  computeDotStates,
  extractTrickTrackerData,
  type DotState,
  type TrickTrackerData,
} from './trick-tracker-logic';

interface TrickTrackerProps {
  gameState: ClientGameState;
  compact?: boolean;
}

const TEAM_COLORS = { team1: TEAM1_COLOR, team2: TEAM2_COLOR };

function renderDot(
  state: DotState,
  index: number,
  r: number,
  cx: number,
  cy: number
): React.ReactNode {
  switch (state.type) {
    case 'unclaimed':
      return (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={r}
          fill="#9ca3af"
          opacity={0.3}
        />
      );

    case 'won': {
      const color = TEAM_COLORS[state.team];
      const s = r * 0.5;
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={r} fill={color} />
          <polyline
            points={`${cx - s},${cy} ${cx - s * 0.2},${cy + s * 0.7} ${cx + s},${cy - s * 0.5}`}
            fill="none"
            stroke="#fff"
            strokeWidth={r * 0.35}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }

    case 'bag': {
      const color = TEAM_COLORS[state.team];
      const s = r * 0.45;
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.3} />
          <line
            x1={cx - s}
            y1={cy}
            x2={cx + s}
            y2={cy}
            stroke={color}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy - s}
            x2={cx}
            y2={cy + s}
            stroke={color}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
        </g>
      );
    }
  }
}

/** Render background zone bands behind the dots. */
function renderZoneBands(
  data: TrickTrackerData,
  dotDiameter: number,
  gap: number,
  totalWidth: number,
  totalHeight: number
): React.ReactNode {
  const bandRadius = totalHeight / 2;
  const opacity = 0.25;

  // Each band spans from the edge to the extent of the team's bid.
  // Width = number of dots * dotDiameter + (dots - 1) * gap + half a gap on each side
  // to visually wrap around the dots in that zone.
  const bandWidth = (count: number) => {
    if (count <= 0) return 0;
    return count * dotDiameter + (count - 1) * gap + gap;
  };

  const team1Width = bandWidth(data.team1Bid);
  const team2Width = bandWidth(data.team2Bid);

  return (
    <>
      {data.team1Bid > 0 && (
        <rect
          x={0}
          y={0}
          width={Math.min(team1Width, totalWidth)}
          height={totalHeight}
          rx={bandRadius}
          ry={bandRadius}
          fill={TEAM1_COLOR}
          opacity={opacity}
        />
      )}
      {data.team2Bid > 0 && (
        <rect
          x={Math.max(0, totalWidth - team2Width)}
          y={0}
          width={Math.min(team2Width, totalWidth)}
          height={totalHeight}
          rx={bandRadius}
          ry={bandRadius}
          fill={TEAM2_COLOR}
          opacity={opacity}
        />
      )}
    </>
  );
}

export function TrickTracker({
  gameState,
  compact = false,
}: TrickTrackerProps) {
  const data = extractTrickTrackerData(gameState);
  if (!data) return null;

  const dotStates = computeDotStates(data);

  const dotDiameter = compact ? 10 : 14;
  const gap = compact ? 2 : 3;
  const r = dotDiameter / 2;
  const pad = gap / 2;
  const totalWidth = 13 * dotDiameter + 12 * gap + pad * 2;
  const totalHeight = dotDiameter + pad * 2;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      style={{ display: 'block' }}
    >
      {renderZoneBands(data, dotDiameter, gap, totalWidth, totalHeight)}
      {dotStates.map((state, i) => {
        const cx = pad + r + i * (dotDiameter + gap);
        const cy = pad + r;
        return renderDot(state, i, r, cx, cy);
      })}
    </svg>
  );
}
