import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Must import after mock is set up
const { generateTeamNames, generateGameSummary } =
  await import('../../ai/claude-service.js');

beforeEach(() => {
  mockCreate.mockReset();
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe('generateTeamNames', () => {
  it('returns null when no API key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns parsed team names on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"team1":"Alice\'s Aces","team2":"Charlie\'s Chumps","startButton":"Deal the Pain!"}',
        },
      ],
    });

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result).toEqual({
      team1: "Alice's Aces",
      team2: "Charlie's Chumps",
      startButton: 'Deal the Pain!',
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('returns null on API error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result).toBeNull();
  });

  it('returns null on invalid JSON response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Not valid JSON at all' }],
    });

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result).toBeNull();
  });

  it('returns null when JSON is missing required fields', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"team1":"Only One"}' }],
    });

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result).toBeNull();
  });

  it('truncates long team names', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const longName = 'A'.repeat(60);
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ team1: longName, team2: 'Short' }),
        },
      ],
    });

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result?.team1.length).toBe(40);
    expect(result?.team2).toBe('Short');
    expect(result?.startButton).toBe("Let's Go!");
  });
});

describe('generateGameSummary', () => {
  const sampleData = {
    winningTeam: 'team1' as const,
    finalScores: {
      team1: { score: 500, bags: 3 },
      team2: { score: 320, bags: 7 },
    },
    scoreHistory: [
      { round: 0, team1Score: 0, team2Score: 0 },
      { round: 1, team1Score: 120, team2Score: 80 },
      { round: 2, team1Score: 250, team2Score: 150 },
      { round: 3, team1Score: 500, team2Score: 320 },
    ],
    roundBids: [
      {
        roundNumber: 1,
        position: 0,
        bid: 3,
        isNil: false,
        isBlindNil: false,
        tricksWon: 4,
      },
    ],
    players: [
      { nickname: 'Alice', position: 0, team: 'team1' as const },
      { nickname: 'Bob', position: 1, team: 'team2' as const },
      { nickname: 'Charlie', position: 2, team: 'team1' as const },
      { nickname: 'Dana', position: 3, team: 'team2' as const },
    ],
    teamNames: { team1: "Alice's Aces", team2: "Bob's Blunders" },
  };

  it('returns null when no API key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await generateGameSummary(sampleData);
    expect(result).toBeNull();
  });

  it('returns summary text on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const summaryText =
      "What a game! Alice's Aces dominated from start to finish.";
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: summaryText }],
    });

    const result = await generateGameSummary(sampleData);
    expect(result).toBe(summaryText);
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('returns null on API error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValueOnce(new Error('Service unavailable'));

    const result = await generateGameSummary(sampleData);
    expect(result).toBeNull();
  });

  it('returns null on empty response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '   ' }],
    });

    const result = await generateGameSummary(sampleData);
    expect(result).toBeNull();
  });
});
