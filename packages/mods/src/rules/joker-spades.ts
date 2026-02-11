import type { RuleMod, TrickCompleteContext } from '@spades/shared';

/**
 * Joker Spades: Two jokers are added to the deck.
 * Big Joker beats everything, Little Joker beats all spades.
 * Note: This mod requires deck modification which isn't fully implemented here.
 * This is a template showing how such a mod would work.
 */
export const jokerSpadesMod: RuleMod = {
  id: 'joker-spades',
  name: 'Joker Spades',
  description: 'Adds two jokers that beat all other cards. Big Joker > Little Joker > Ace of Spades.',
  version: '1.0.0',
  type: 'rule',
  author: 'Spades Team',

  hooks: {
    onTrickComplete: (context: TrickCompleteContext): TrickCompleteContext => {
      // This is a placeholder - in a full implementation,
      // we'd need to extend the Card type to include jokers
      // and modify the deck creation and trick resolution logic

      // For now, this demonstrates the hook pattern
      return context;
    }
  }
};
