import type { ScoreHistoryEntry } from '@spades/shared';
import React from 'react';
import { TEAM1_COLOR, TEAM2_COLOR } from '../../styles/colors';

interface ScoreProgressionChartProps {
  scoreHistory: ScoreHistoryEntry[];
  winningScore: number;
  compact?: boolean;
}

const PADDING = { top: 20, right: 20, bottom: 30, left: 45 };
const CHART_WIDTH = 500;
const CHART_HEIGHT = 260;

export function ScoreProgressionChart({
  scoreHistory,
  winningScore,
  compact,
}: ScoreProgressionChartProps) {
  if (scoreHistory.length <= 1) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#9ca3af',
          padding: compact ? '16px' : '32px',
          fontSize: compact ? '12px' : '14px',
        }}
      >
        No rounds completed yet
      </div>
    );
  }

  const allScores = scoreHistory.flatMap((e) => [e.team1Score, e.team2Score]);
  const minScore = Math.min(0, ...allScores);
  const maxScore = Math.max(winningScore, ...allScores);
  const yPadding = Math.max(20, Math.ceil((maxScore - minScore) * 0.08));
  const yMin = minScore - yPadding;
  const yMax = maxScore + yPadding;

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (round: number) =>
    PADDING.left + (round / (scoreHistory.length - 1)) * plotW;
  const yScale = (score: number) =>
    PADDING.top + plotH - ((score - yMin) / (yMax - yMin)) * plotH;

  const toPolyline = (key: 'team1Score' | 'team2Score') =>
    scoreHistory.map((e, i) => `${xScale(i)},${yScale(e[key])}`).join(' ');

  // Y-axis gridlines: pick nice round intervals
  const yRange = yMax - yMin;
  const rawStep = yRange / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [1, 2, 5, 10];
  const step =
    magnitude *
    (niceSteps.find((s) => s * magnitude >= rawStep) ?? niceSteps[3]);
  const gridLines: number[] = [];
  const firstGrid = Math.ceil(yMin / step) * step;
  for (let v = firstGrid; v <= yMax; v += step) {
    gridLines.push(v);
  }

  // X-axis labels: show every round, skip every other if many rounds
  const totalRounds = scoreHistory.length - 1;
  const xLabelStep = totalRounds > 12 ? 2 : 1;

  const fontSize = compact ? 9 : 11;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      width="100%"
      style={{ display: 'block' }}
    >
      {/* Grid lines */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={PADDING.left}
            y1={yScale(v)}
            x2={CHART_WIDTH - PADDING.right}
            y2={yScale(v)}
            stroke="#e5e7eb"
            strokeWidth={0.5}
          />
          <text
            x={PADDING.left - 6}
            y={yScale(v) + 3}
            textAnchor="end"
            fontSize={fontSize}
            fill="#9ca3af"
          >
            {v}
          </text>
        </g>
      ))}

      {/* Zero line if scores go negative */}
      {minScore < 0 && (
        <line
          x1={PADDING.left}
          y1={yScale(0)}
          x2={CHART_WIDTH - PADDING.right}
          y2={yScale(0)}
          stroke="#9ca3af"
          strokeWidth={1}
        />
      )}

      {/* Winning score threshold */}
      <line
        x1={PADDING.left}
        y1={yScale(winningScore)}
        x2={CHART_WIDTH - PADDING.right}
        y2={yScale(winningScore)}
        stroke="#f59e0b"
        strokeWidth={1}
        strokeDasharray="6 3"
      />
      <text
        x={CHART_WIDTH - PADDING.right + 2}
        y={yScale(winningScore) + 3}
        fontSize={fontSize}
        fill="#f59e0b"
        textAnchor="start"
      >
        {winningScore}
      </text>

      {/* X-axis labels */}
      {scoreHistory.map(
        (e, i) =>
          i % xLabelStep === 0 && (
            <text
              key={i}
              x={xScale(i)}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              fontSize={fontSize}
              fill="#9ca3af"
            >
              {e.round === 0 ? 'Start' : `R${e.round}`}
            </text>
          )
      )}

      {/* Team 1 line */}
      <polyline
        points={toPolyline('team1Score')}
        fill="none"
        stroke={TEAM1_COLOR}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {scoreHistory.map((e, i) => (
        <circle
          key={`t1-${i}`}
          cx={xScale(i)}
          cy={yScale(e.team1Score)}
          r={3}
          fill={TEAM1_COLOR}
        />
      ))}

      {/* Team 2 line */}
      <polyline
        points={toPolyline('team2Score')}
        fill="none"
        stroke={TEAM2_COLOR}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {scoreHistory.map((e, i) => (
        <circle
          key={`t2-${i}`}
          cx={xScale(i)}
          cy={yScale(e.team2Score)}
          r={3}
          fill={TEAM2_COLOR}
        />
      ))}

      {/* Legend */}
      <g transform={`translate(${PADDING.left + 4}, ${PADDING.top - 6})`}>
        <line
          x1={0}
          y1={0}
          x2={16}
          y2={0}
          stroke={TEAM1_COLOR}
          strokeWidth={2.5}
        />
        <text x={20} y={4} fontSize={fontSize} fill="#6b7280">
          Team 1
        </text>
        <line
          x1={70}
          y1={0}
          x2={86}
          y2={0}
          stroke={TEAM2_COLOR}
          strokeWidth={2.5}
        />
        <text x={90} y={4} fontSize={fontSize} fill="#6b7280">
          Team 2
        </text>
      </g>
    </svg>
  );
}
