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
const { generateTeamNames, generateGameSummary, generateBidAdvice } =
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

  it('strips markdown code fences from JSON response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '```json\n{"team1":"Fenced Aces","team2":"Fenced Chumps","startButton":"Go!"}\n```',
        },
      ],
    });

    const result = await generateTeamNames({
      team1: ['Alice', 'Bob'],
      team2: ['Charlie', 'Dana'],
    });

    expect(result).toEqual({
      team1: 'Fenced Aces',
      team2: 'Fenced Chumps',
      startButton: 'Go!',
    });
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

describe('generateBidAdvice', () => {
  const sampleHand = [
    { suit: 'spades', rank: 'A' },
    { suit: 'spades', rank: 'K' },
    { suit: 'spades', rank: '5' },
    { suit: 'hearts', rank: 'A' },
    { suit: 'hearts', rank: 'J' },
    { suit: 'hearts', rank: '8' },
    { suit: 'hearts', rank: '3' },
    { suit: 'diamonds', rank: 'Q' },
    { suit: 'diamonds', rank: '10' },
    { suit: 'diamonds', rank: '6' },
    { suit: 'clubs', rank: 'K' },
    { suit: 'clubs', rank: '9' },
    { suit: 'clubs', rank: '4' },
  ] as Parameters<typeof generateBidAdvice>[0]['hand'];

  const sampleData: Parameters<typeof generateBidAdvice>[0] = {
    hand: sampleHand,
    scores: {
      team1: { score: 120, bags: 2 },
      team2: { score: 80, bags: 1 },
    },
    currentBids: [],
    myPosition: 0,
    myTeam: 'team1',
    dealerPosition: 3,
    winningScore: 500,
  };

  it('returns null when no API key is set', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await generateBidAdvice(sampleData);
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('parses tool_use response correctly', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'recommend_bid',
          input: {
            recommendedBid: 4,
            analysis:
              'A♠ and K♠ with cover give 2 spade tricks. A♥ is a sure trick. K♣ with two other clubs is worth half a trick.',
          },
        },
      ],
    });

    const result = await generateBidAdvice(sampleData);
    expect(result).toEqual({
      recommendedBid: 4,
      analysis:
        'A♠ and K♠ with cover give 2 spade tricks. A♥ is a sure trick. K♣ with two other clubs is worth half a trick.',
    });
  });

  it('returns null when response has no tool_use block', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot help with that.' }],
    });

    const result = await generateBidAdvice(sampleData);
    expect(result).toBeNull();
  });

  it('returns null on invalid recommendedBid', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'recommend_bid',
          input: { recommendedBid: 15, analysis: 'Overbid.' },
        },
      ],
    });

    const result = await generateBidAdvice(sampleData);
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

    const result = await generateBidAdvice(sampleData);
    expect(result).toBeNull();
  });

  it('truncates long analysis', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const longAnalysis = 'A'.repeat(600);
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'recommend_bid',
          input: { recommendedBid: 3, analysis: longAnalysis },
        },
      ],
    });

    const result = await generateBidAdvice(sampleData);
    expect(result?.analysis.length).toBe(250);
  });

  it('rounds fractional recommendedBid', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_123',
          name: 'recommend_bid',
          input: { recommendedBid: 3.7, analysis: 'Close call.' },
        },
      ],
    });

    const result = await generateBidAdvice(sampleData);
    expect(result?.recommendedBid).toBe(4);
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
