import Anthropic from '@anthropic-ai/sdk';
import type { Card, Position } from '@spades/shared';

const MODEL = 'claude-haiku-4-5-20251001';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

function sanitizeNickname(name: string): string {
  // Strip control characters (U+0000–U+001F, U+007F)
  const CONTROL_CHARS = /[\x00-\x1f\x7f]/g; // eslint-disable-line no-control-regex
  return name.slice(0, 30).replace(CONTROL_CHARS, '').trim();
}

export interface TeamNamesResult {
  team1: string;
  team2: string;
  startButton: string;
}

export async function generateTeamNames(players: {
  team1: string[];
  team2: string[];
}): Promise<TeamNamesResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const team1Names = players.team1.map(sanitizeNickname).join(' and ');
  const team2Names = players.team2.map(sanitizeNickname).join(' and ');

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are naming teams for a Spades card game. Generate one creative, funny team name for each team based on the players' nicknames. Think competitive card table banter — clever wordplay and playful roasting. Keep it PG-13: witty over shocking.

Team 1 players: ${team1Names}
Team 2 players: ${team2Names}

Also provide short text for a "start game" button — make it thematic based on the names, or just a fun exhortation like "Deal 'Em!" or "Shuffle Up!".

Respond with ONLY valid JSON, no other text: {"team1":"...","team2":"...","startButton":"..."}

Team names: 2-4 words max. Button text: 2-4 words max.`,
        },
      ],
    });

    const raw =
      response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip markdown code fences the model sometimes wraps around JSON
    const text = raw
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '');
    const parsed = JSON.parse(text) as TeamNamesResult;

    if (
      typeof parsed.team1 !== 'string' ||
      typeof parsed.team2 !== 'string' ||
      !parsed.team1 ||
      !parsed.team2
    ) {
      return null;
    }

    return {
      team1: parsed.team1.slice(0, 40),
      team2: parsed.team2.slice(0, 40),
      startButton:
        typeof parsed.startButton === 'string' && parsed.startButton
          ? parsed.startButton.slice(0, 30)
          : "Let's Go!",
    };
  } catch (err) {
    console.warn('[ai] Failed to generate team names:', err);
    return null;
  }
}

export async function generateGameSummary(data: {
  winningTeam: 'team1' | 'team2';
  finalScores: {
    team1: { score: number; bags: number };
    team2: { score: number; bags: number };
  };
  scoreHistory: { round: number; team1Score: number; team2Score: number }[];
  roundBids: {
    roundNumber: number;
    position: number;
    bid: number;
    isNil: boolean;
    isBlindNil: boolean;
    tricksWon: number;
  }[];
  players: { nickname: string; position: number; team: 'team1' | 'team2' }[];
  teamNames: { team1: string; team2: string };
}): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const playerList = data.players
    .map(
      (p) =>
        `${sanitizeNickname(p.nickname)} (${data.teamNames[p.team]}, pos ${p.position})`
    )
    .join(', ');

  const scoreProgression = data.scoreHistory
    .map(
      (s) =>
        `R${s.round}: ${data.teamNames.team1} ${s.team1Score} - ${data.teamNames.team2} ${s.team2Score}`
    )
    .join('\n');

  const bidSummary = data.roundBids
    .map(
      (b) =>
        `R${b.roundNumber} pos${b.position}: bid ${b.isBlindNil ? 'blind nil' : b.isNil ? 'nil' : b.bid}, won ${b.tricksWon}`
    )
    .join('\n');

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: `You are a witty sports commentator writing a recap of a Spades card game. Write 1-2 short paragraphs summarizing the game. PG-13 tone — call out dramatic moments (comebacks, blowouts, nil fails, bag penalties). Playfully mock the losers, hype the winners.

Winner: ${data.teamNames[data.winningTeam]}
Final score: ${data.teamNames.team1} ${data.finalScores.team1.score} (${data.finalScores.team1.bags} bags) - ${data.teamNames.team2} ${data.finalScores.team2.score} (${data.finalScores.team2.bags} bags)

Players: ${playerList}

Score progression:
${scoreProgression}

Bid details:
${bidSummary}

Write the summary directly — no title, no heading. Keep it under 150 words.`,
        },
      ],
    });

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    return text.trim() || null;
  } catch (err) {
    console.warn('[ai] Failed to generate game summary:', err);
    return null;
  }
}

export interface BidAdviceResult {
  recommendedBid: number; // 0 = nil, 1-13 = trick count
  analysis: string; // 2-3 sentence explanation
}

export async function generateBidAdvice(data: {
  hand: Card[];
  scores: {
    team1: { score: number; bags: number };
    team2: { score: number; bags: number };
  };
  currentBids: {
    position: Position;
    team: string;
    bid: number;
    isNil: boolean;
    isBlindNil: boolean;
  }[];
  myPosition: Position;
  myTeam: string;
  dealerPosition: Position;
  winningScore: number;
}): Promise<BidAdviceResult | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  // Group cards by suit for readability
  const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
  const suitNames: Record<string, string> = {
    spades: 'Spades',
    hearts: 'Hearts',
    diamonds: 'Diamonds',
    clubs: 'Clubs',
  };
  const rankOrder = [
    'A',
    'K',
    'Q',
    'J',
    '10',
    '9',
    '8',
    '7',
    '6',
    '5',
    '4',
    '3',
    '2',
  ];

  const handBySuit = suitOrder
    .map((suit) => {
      const cards = data.hand
        .filter((c) => c.suit === suit)
        .sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank))
        .map((c) => c.rank);
      if (cards.length === 0) return `${suitNames[suit]}: (void)`;
      return `${suitNames[suit]} (${cards.length}): ${cards.join(', ')}`;
    })
    .join('\n');

  const bidsPlaced =
    data.currentBids.length > 0
      ? data.currentBids
          .map(
            (b) =>
              `Position ${b.position} (${b.team}): ${b.isBlindNil ? 'Blind Nil' : b.isNil ? 'Nil' : b.bid}`
          )
          .join('\n')
      : 'None yet — you are the first to bid.';

  try {
    // Build a structured trick-counting scratchpad for the prefill.
    // This anchors the model to the actual hand and prevents hallucinations.
    const suitAnalysis = suitOrder
      .map((suit) => {
        const cards = data.hand
          .filter((c) => c.suit === suit)
          .sort(
            (a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)
          );
        const count = cards.length;
        const label = suitNames[suit];
        if (count === 0)
          return `${label}: void (0 cards) — can trump when ${label.toLowerCase()} is led`;
        const names = cards.map((c) => c.rank).join(', ');
        return `${label}: ${names} (${count} card${count > 1 ? 's' : ''})`;
      })
      .join('\n');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: `You are an expert Spades card game bidding advisor. You must ONLY reference cards that appear in the player's hand — never invent or assume cards that are not listed. Accuracy is more important than optimism.

Trick-counting rules (follow strictly):
- A, K of spades: almost always win. Count each as 1 trick.
- Q of spades: usually wins but can lose to A or K. Count as 0.5.
- Lower spades: unreliable. Only count if you have 4+ spades total.
- Off-suit Ace in a SHORT suit (1-3 cards): count as 1 trick.
- Off-suit Ace in a LONG suit (4+ cards): count as 0.5 — opponents may be void and trump it.
- Off-suit King in a 2-card suit: count as 0.5 (wins if Ace is played first round).
- Off-suit King in 3+ card suit: do NOT count — too likely to lose to the Ace or get trumped.
- Q, J, 10, and lower in ANY side suit: NEVER count as tricks (unless singleton/doubleton AND highest in suit, which is rare).
- Void in a side suit: count as 0.5 if you have spades to trump with.

Sum up using these fractional values, then ROUND DOWN to get your bid. Most hands produce 2-5 tricks. Bids of 6+ require multiple high spades or aces.`,
      messages: [
        {
          role: 'user',
          content: `Recommend a bid for this hand. Here are the ONLY cards in my hand — do not reference any other cards:

${handBySuit}

Scores: Team 1: ${data.scores.team1.score} pts (${data.scores.team1.bags} bags) | Team 2: ${data.scores.team2.score} pts (${data.scores.team2.bags} bags) | Winning: ${data.winningScore}
Position: ${data.myPosition} (${data.myTeam}) | Dealer: ${data.dealerPosition}
Bids placed: ${bidsPlaced}

Respond with ONLY valid JSON: {"recommendedBid": N, "analysis": "..."}
recommendedBid: 0 for nil, 1-13 for trick count.
analysis: 2-3 sentences. Reference only cards listed above.`,
        },
        {
          role: 'assistant',
          content: `Let me count tricks suit by suit using only the cards listed:
${suitAnalysis}

Based on strict counting rules:`,
        },
      ],
    });

    const raw =
      response.content[0].type === 'text' ? response.content[0].text : '';
    // The model continues after the prefill — extract the JSON object
    // which may be preceded by reasoning text
    const jsonMatch = /\{[\s\S]*"recommendedBid"[\s\S]*\}/.exec(raw);
    if (!jsonMatch) {
      console.warn('[ai] No JSON found in bid advice response:', raw);
      return null;
    }
    const text = jsonMatch[0]
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '');
    const parsed = JSON.parse(text) as BidAdviceResult;

    if (
      typeof parsed.recommendedBid !== 'number' ||
      parsed.recommendedBid < 0 ||
      parsed.recommendedBid > 13 ||
      typeof parsed.analysis !== 'string'
    ) {
      console.warn('[ai] Invalid bid advice response:', parsed);
      return null;
    }

    return {
      recommendedBid: Math.round(parsed.recommendedBid),
      analysis: parsed.analysis.slice(0, 500),
    };
  } catch (err) {
    console.warn('[ai] Failed to generate bid advice:', err);
    return null;
  }
}
