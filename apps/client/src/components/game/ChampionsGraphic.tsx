import { useEffect, useRef } from 'react';
import championsTemplate from '../../assets/champions.png';
import markerFontUrl from '../../assets/fonts/permanent-marker.woff2';

// The template PNG is a fixed-size paper-plate photo. All text coordinates
// below are expressed in this native pixel space; the canvas is drawn at this
// resolution and scaled down with CSS (`maxWidth: 100%`).
const TEMPLATE_WIDTH = 1195;
const TEMPLATE_HEIGHT = 896;

const FONT_FAMILY = 'ChampionsMarker';
const TEXT_COLOR = '#3b3b8f'; // marker blue-violet, tunable

// Calibrated to the handwritten slots on the template. `y` is the text
// baseline (default `alphabetic` baseline). Toggle the debug grid with
// `?champions-debug` to re-tune these.
const FIELDS = {
  // Between "Spades Champions" and "Winners:".
  date: { x: 700, y: 388, size: 44, align: 'center' as const, maxWidth: 520 },
  // Right of "Winners:".
  winner: { x: 665, y: 440, size: 52, align: 'left' as const, maxWidth: 440 },
  // Right of "Losers:".
  loser: { x: 620, y: 518, size: 52, align: 'left' as const, maxWidth: 480 },
  // Below "Losers:".
  score: { x: 440, y: 592, size: 56, align: 'left' as const, maxWidth: 620 },
};

interface ChampionsGraphicProps {
  winnerName: string;
  loserName: string;
  winnerScore: number;
  loserScore: number;
  date?: Date;
}

/** Pick the largest font size (<= base) that keeps `text` within `maxWidth`. */
function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  basePx: number
): number {
  let size = basePx;
  for (; size > 12; size -= 2) {
    ctx.font = `${size}px "${FONT_FAMILY}"`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return size;
}

function drawField(
  ctx: CanvasRenderingContext2D,
  field: (typeof FIELDS)[keyof typeof FIELDS],
  text: string
): void {
  const size = fitFontSize(ctx, text, field.maxWidth, field.size);
  ctx.font = `${size}px "${FONT_FAMILY}"`;
  ctx.textAlign = field.align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(text, field.x, field.y);
}

function drawDebugGrid(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,0,0,0.35)';
  ctx.fillStyle = 'rgba(255,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.font = '14px sans-serif';
  for (let x = 0; x <= TEMPLATE_WIDTH; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, TEMPLATE_HEIGHT);
    ctx.stroke();
    ctx.fillText(String(x), x + 2, 14);
  }
  for (let y = 0; y <= TEMPLATE_HEIGHT; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEMPLATE_WIDTH, y);
    ctx.stroke();
    ctx.fillText(String(y), 2, y - 2);
  }
  ctx.restore();
}

export function ChampionsGraphic({
  winnerName,
  loserName,
  winnerScore,
  loserScore,
  date = new Date(),
}: ChampionsGraphicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dateText = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const scoreText = `${winnerScore} > ${loserScore}`;
    const debug = new URLSearchParams(window.location.search).has(
      'champions-debug'
    );

    // The custom font must be loaded BEFORE fillText, or canvas silently falls
    // back to a default font. Await both the image and the font, then draw.
    async function render() {
      const img = new Image();
      img.src = championsTemplate;
      const font = new FontFace(FONT_FAMILY, `url(${markerFontUrl})`);

      const [, loadedFont] = await Promise.all([img.decode(), font.load()]);
      document.fonts.add(loadedFont);
      if (cancelled || !canvasRef.current) return;

      ctx!.clearRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
      ctx!.drawImage(img, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
      drawField(ctx!, FIELDS.date, dateText);
      drawField(ctx!, FIELDS.winner, winnerName);
      drawField(ctx!, FIELDS.loser, loserName);
      drawField(ctx!, FIELDS.score, scoreText);
      if (debug) drawDebugGrid(ctx!);
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [winnerName, loserName, winnerScore, loserScore, date]);

  return (
    <canvas
      ref={canvasRef}
      width={TEMPLATE_WIDTH}
      height={TEMPLATE_HEIGHT}
      aria-label={`Spades champions: ${winnerName} beat ${loserName} ${winnerScore} to ${loserScore}`}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '8px',
      }}
    />
  );
}
