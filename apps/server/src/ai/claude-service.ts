import Anthropic from '@anthropic-ai/sdk';

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

    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
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
