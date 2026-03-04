import type {
  RuleMod,
  RoundEndContext,
  RoundEndResult,
  RoundEffect,
} from '@spades/shared';

const SCORE_TRIGGERS: { score: number; effectId: string }[] = [
  { score: 345, effectId: 'bowling-strike' },
  { score: 245, effectId: 'fake-victory' },
];

declare const process: { env: Record<string, string | undefined> } | undefined;

function isDevMode(): boolean {
  return (
    typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
  );
}

export const scoreEffectsMod: RuleMod = {
  id: 'score-effects',
  name: 'Score Effects',
  description:
    'Triggers fun audio/visual effects when a team hits specific score values.',
  version: '1.0.0',
  type: 'rule',
  author: 'Spades Team',

  hooks: {
    onRoundEnd: (context: RoundEndContext): RoundEndResult => {
      const { gameState } = context;
      const effects: RoundEffect[] = [];

      // In dev mode, fire a random effect after every round for easy testing
      if (isDevMode()) {
        const allEffectIds = SCORE_TRIGGERS.map((t) => t.effectId);
        const pick =
          allEffectIds[Math.floor(Math.random() * allEffectIds.length)];
        effects.push({ id: pick, teamId: 'team1' });
        return { effects };
      }

      for (const teamId of ['team1', 'team2'] as const) {
        const score = gameState.scores[teamId].score;

        for (const trigger of SCORE_TRIGGERS) {
          if (score === trigger.score) {
            effects.push({ id: trigger.effectId, teamId });
          }
        }
      }

      return effects.length > 0 ? { effects } : {};
    },
  },
};
