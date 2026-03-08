import type { ClientGameState } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';
import {
  computeDotStates,
  extractTrickTrackerData,
  type DotState,
} from './trick-tracker-logic';

interface TrickTrackerProps {
  gameState: ClientGameState;
  compact?: boolean;
}

const TEAM_COLORS = { team1: TEAM1_COLOR, team2: TEAM2_COLOR };
const OPPONENT_COLOR = { team1: TEAM2_COLOR, team2: TEAM1_COLOR };

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

    case 'bid':
      return (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r={r}
          fill={TEAM_COLORS[state.team]}
          opacity={0.4}
        />
      );

    case 'contested': {
      // Left semicircle = team1, right semicircle = team2
      const top = cy - r;
      const bot = cy + r;
      return (
        <g key={index}>
          <path
            d={`M ${cx} ${top} A ${r} ${r} 0 0 0 ${cx} ${bot} Z`}
            fill={TEAM1_COLOR}
            opacity={0.4}
          />
          <path
            d={`M ${cx} ${top} A ${r} ${r} 0 0 1 ${cx} ${bot} Z`}
            fill={TEAM2_COLOR}
            opacity={0.4}
          />
        </g>
      );
    }

    case 'won': {
      const color = TEAM_COLORS[state.team];
      // Checkmark: proportional to dot radius
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
            y1={cy - s}
            x2={cx + s}
            y2={cy + s}
            stroke={color}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
          <line
            x1={cx + s}
            y1={cy - s}
            x2={cx - s}
            y2={cy + s}
            stroke={color}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
        </g>
      );
    }

    case 'set': {
      const teamColor = TEAM_COLORS[state.team];
      const opponentColor = OPPONENT_COLOR[state.team];
      const s = r * 0.45;
      return (
        <g key={index}>
          <circle cx={cx} cy={cy} r={r} fill={opponentColor} opacity={0.2} />
          <line
            x1={cx - s}
            y1={cy - s}
            x2={cx + s}
            y2={cy + s}
            stroke={teamColor}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
          <line
            x1={cx + s}
            y1={cy - s}
            x2={cx - s}
            y2={cy + s}
            stroke={teamColor}
            strokeWidth={r * 0.35}
            strokeLinecap="round"
          />
        </g>
      );
    }
  }
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
  const totalWidth = 13 * dotDiameter + 12 * gap;
  const totalHeight = dotDiameter;

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      style={{ display: 'block' }}
    >
      {dotStates.map((state, i) => {
        const cx = r + i * (dotDiameter + gap);
        const cy = r;
        return renderDot(state, i, r, cx, cy);
      })}
    </svg>
  );
}
