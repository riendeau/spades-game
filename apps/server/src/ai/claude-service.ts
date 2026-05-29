import Anthropic from '@anthropic-ai/sdk';
import type { Card, Position } from '@spades/shared';

const MODEL_HAIKU = 'claude-haiku-4-5';
const MODEL_SONNET = 'claude-sonnet-4-6';

/**
 * Voices for the post-game writeup. One is chosen at random per game so the
 * recap isn't always the same style. Each style supplies a persona/task intro,
 * a format+length outro, and its own token budget (verse forms need fewer
 * tokens than prose). The game data block is shared and inserted between them.
 */
interface SummaryStyle {
  name: string;
  intro: string;
  outro: string;
  maxTokens: number;
}

const SUMMARY_STYLES: SummaryStyle[] = [
  {
    name: 'sports-commentator',
    intro:
      'You are a witty sports commentator writing a recap of a Spades card game and mildly resentful at having to engage with such low-quality play. Write 1-2 short paragraphs summarizing the game. PG-13 tone — call out dramatic moments (comebacks, blowouts, nil fails, bag penalties). Playfully mock the losers (and the winners too if they deserve it).',
    outro:
      'Write the summary directly — no title, no heading. Keep it under 150 words.',
    maxTokens: 400,
  },
  {
    name: 'haiku',
    intro:
      'You are a haiku poet recapping a Spades card game. Capture the arc of the match — who triumphed, who faltered, and the turns of fortune (comebacks, blowouts, failed nils, bag penalties) — in spare, evocative imagery.',
    outro:
      'Write two or three haiku in traditional 5-7-5 form, one stanza each, separated by a blank line. Output only the haiku — no title, no commentary.',
    maxTokens: 200,
  },
  {
    name: 'noir-detective',
    intro:
      'You are a hard-boiled noir detective narrating a Spades card game like a case that went sideways. World-weary, clipped, metaphor-soaked. Note the dramatic turns — comebacks, blowouts, failed nils, the slow rot of bag penalties — and who had it coming. PG-13.',
    outro:
      'Write 1-2 short paragraphs in first person. Output the narration directly — no title, no heading. Keep it under 150 words.',
    maxTokens: 400,
  },
  {
    name: 'shakespearean',
    intro:
      'You are a Shakespearean bard recounting a Spades card game as high drama, both tragedy and farce. Use Elizabethan diction and dramatic flourish (the occasional "thou", "forsooth", "alas"). Mark the great reversals — comebacks, routs, fallen nils, the creeping curse of bags. PG-13.',
    outro:
      'Write a short dramatic passage; blank verse is welcome. Output it directly — no title, no heading. Keep it under 150 words.',
    maxTokens: 400,
  },
  {
    name: 'nature-documentary',
    intro:
      'You are a hushed nature-documentary narrator (think David Attenborough) observing a Spades card game as though it were wildlife on the savanna. The players are creatures in their habitat, the bids are hunts, the bag penalties a slow affliction. Awe and gentle irony. PG-13.',
    outro:
      'Write 1-2 short paragraphs. Output the narration directly — no title, no heading. Keep it under 150 words.',
    maxTokens: 400,
  },
  {
    name: 'epic-saga',
    intro:
      'You are a bard chronicling a Spades card game as an epic fantasy saga — heroes, doomed gambits, and hard-won glory. Render the comebacks, routs, failed nils, and bag-curses as the stuff of legend. PG-13.',
    outro:
      'Write a short heroic passage. Output it directly — no title, no heading. Keep it under 150 words.',
    maxTokens: 400,
  },
  {
    name: 'group-chat',
    intro:
      'You are recapping a Spades card game as a passive-aggressive group chat thread between the four players the morning after. Petty grievances, backhanded "congrats", "no worries!" that clearly means worries, someone leaving people on read. Reference the actual turning points — comebacks, blowouts, failed nils, bag penalties — as the things they\'re subtweeting about. PG-13.',
    outro:
      'Write 4-7 short chat messages, each prefixed with the sender\'s name and a colon (e.g. "Alice: ..."), one per line. Output only the messages — no title, no commentary.',
    maxTokens: 350,
  },
];

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
      model: MODEL_HAIKU,
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

  const style =
    SUMMARY_STYLES[Math.floor(Math.random() * SUMMARY_STYLES.length)];
  console.log(`[ai] generating game summary in style: ${style.name}`);

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: style.maxTokens,
      messages: [
        {
          role: 'user',
          content: `${style.intro}

Winner: ${data.teamNames[data.winningTeam]}
Final score: ${data.teamNames.team1} ${data.finalScores.team1.score} (${data.finalScores.team1.bags} bags) - ${data.teamNames.team2} ${data.finalScores.team2.score} (${data.finalScores.team2.bags} bags)

Players: ${playerList}

Score progression:
${scoreProgression}

Bid details:
${bidSummary}

${style.outro}`,
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
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 1024,
      system: `You are a Spades bidding advisor. You will be given a hand of exactly 13 cards. Your job is to recommend a bid and provide a brief explanation. Do not reference any card not in the hand you are given.

## Bidding Rules

**These rules apply when evaluating a regular (non-nil) bid. They do not apply when evaluating nil — see the Nil Bid Consideration section below.**

Regular bid calculation — sum the following:

- Spades (high cards)
  - A♠ = 1 trick
  - K♠ = 1 trick if you hold at least one other spade
  - Q♠ = 1 trick if you hold at least two other spades
  - J♠ = 1 trick if you hold at least three other spades
- Spades (length)
  - Each spade beyond the 4th = 1 trick
- Side suits
  - Any side suit **Ace** = 1 trick
  - K in a side suit where you hold 2+ cards of that suit = 0.5-1 trick (lower confidence with every card more than 2 in the suit, since opponents will be more likely to be short and thus trump)
  - Q in a side suit where you hold 3+ cards of that suit = 0.1-0.5 tricks (lower confidence with every card more than 3 in the suit, since opponents will be more likely to be short and thus trump)
- Short side suits (trumping potential)
  - A void in a side suit = 1-2 additional tricks (you can trump early, **if** you have the spades to do it and those spades aren't already counted in your projected tricks)
  - A singleton in a side suit = roughly 1 additional trick (again, **only if** you have unassigned spades to trump with)
  - A doubleton in a side suit = 0.5 additional trick with unassigned spades
- Rounding and adjustment
  - When your trick count is a fraction, **always** round down, not up. A bid of 2 on a 2.5-count hand is correct; a bid of 3 is an overbid.
  - If the sum of bids already placed is high (9+), shade your bid further downward — tricks are finite.
  - The average sum of all four players' bids in well-played games is approximately 10-11 out of 13 tricks total. Consistently underbidding by a half-trick is better than overbidding by a half-trick — overtricks cost 1 point each, but a failed contract costs 10x your bid.

## Nil bid consideration

**The regular bid rules above do not apply here. When evaluating nil, high cards are assessed purely by suit length — a high card is only dangerous if the suit is likely to be led enough times to force it out before you are void.**

Consider bidding nil (0) only if ALL of the following are true:

- No A♠ (the Ace of Spades is literally always fatal for nil)
- No K♠ or Q♠ without sufficient low spade cover (K♠ needs 1+ other spades; Q♠ needs 2+ other spades)
- A total of 3 or fewer spades. With 4+ spades (no matter their rank) there is a very high risk of being the last player with spades and being forced to take a trick
- For each side suit, evaluate high card danger by suit length and rank:
  - **Ace** in a side suit: safe only with 4+ other cards in that suit (you cannot duck under a higher card — partner must trump or the suit must exhaust)
  - **King** in a side suit: safe with 3+ other cards; marginal with 2; dangerous as singleton or doubleton
  - **Queen** in a side suit: safe with 2+ other cards; marginal with 1; note that a Q can also be saved by ducking under partner's K or A if they hold one
  - Multiple high cards in the same suit stack the danger — evaluate the suit as a whole, not card by card

If the hand fails any of these checks, do not bid nil.`,
      tools: [
        {
          name: 'recommend_bid',
          description:
            'Recommend a bid based on the hand analysis. Count tricks suit by suit using the bidding rules.',
          input_schema: {
            type: 'object' as const,
            properties: {
              recommendedBid: {
                type: 'number' as const,
                description:
                  'The recommended bid: 0 for nil, 1-13 for trick count',
              },
              analysis: {
                type: 'string' as const,
                description:
                  '1-2 short sentences (under 200 characters). Name only the key cards driving the bid — do not list every suit.',
              },
            },
            required: ['recommendedBid', 'analysis'],
          },
        },
      ],
      tool_choice: { type: 'tool' as const, name: 'recommend_bid' },
      messages: [
        {
          role: 'user',
          content: `Recommend a bid for this hand. Here are the ONLY cards in my hand — do not reference any other cards:

${handBySuit}

Scores: Team 1: ${data.scores.team1.score} pts (${data.scores.team1.bags} bags) | Team 2: ${data.scores.team2.score} pts (${data.scores.team2.bags} bags) | Winning: ${data.winningScore}
Position: ${data.myPosition} (${data.myTeam}) | Dealer: ${data.dealerPosition}
Bids placed: ${bidsPlaced}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (toolUse?.type !== 'tool_use') {
      console.warn('[ai] No tool use found in bid advice response');
      return null;
    }

    const parsed = toolUse.input as BidAdviceResult;

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
      analysis: parsed.analysis.slice(0, 250),
    };
  } catch (err) {
    console.warn('[ai] Failed to generate bid advice:', err);
    return null;
  }
}
