import { useEffect, useRef } from 'react';
import championsTemplate from '../../assets/champions.png';
import markerFontUrl from '../../assets/fonts/permanent-marker.woff2';

// The template PNG is a paper-plate photo cropped tight to the plate's
// bounding box (no transparent padding, so it centers cleanly in the modal).
// All text coordinates below are expressed in this native pixel space; the
// canvas is drawn at this resolution and scaled down with CSS (`maxWidth: 100%`).
const TEMPLATE_WIDTH = 929;
const TEMPLATE_HEIGHT = 895;

const FONT_FAMILY = 'ChampionsMarker';

// Calibrated to the handwritten slots on the template. `y` is the text
// baseline (default `alphabetic` baseline). `color` is tuned to roughly match
// the marker color of the adjacent printed label. Toggle the debug grid with
// `?champions-debug` to re-tune positions.
const FIELDS = {
  // Between "Spades Champions" and "Winners:".
  date: {
    x: 480,
    y: 377,
    size: 44,
    align: 'center' as const,
    maxWidth: 520,
    color: '#cc2222',
  },
  // Right of "Winners:" (blue, like the "Winners:" label).
  winner: {
    x: 460,
    y: 449,
    size: 52,
    align: 'left' as const,
    maxWidth: 440,
    color: '#2f5fd0',
  },
  // Right of "Losers:" (pink, like the "Losers:" label).
  loser: {
    x: 450,
    y: 512,
    size: 52,
    align: 'left' as const,
    maxWidth: 480,
    color: '#e0559b',
  },
  // Below "Losers:".
  score: {
    x: 345,
    y: 616,
    size: 56,
    align: 'left' as const,
    maxWidth: 620,
    color: '#7a2fb0',
  },
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
  ctx.fillStyle = field.color;
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
