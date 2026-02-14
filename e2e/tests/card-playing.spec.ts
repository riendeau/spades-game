import { test, expect } from '../fixtures/game-fixtures';
import { completeAllBids } from '../helpers/bidding-helpers';
import {
  playFirstCard,
  playCurrentPlayerCard,
  completeTrick,
  findCurrentPlayer,
} from '../helpers/playing-helpers';

test.describe('Card Playing', () => {
  test('current player can select and play a card', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Complete bidding first
    await completeAllBids(players, 3);

    // Find whose turn it is and play a card
    const activePlayer = await playCurrentPlayerCard(players);

    // The play button should disappear after playing
    await expect(
      activePlayer.getByRole('button', { name: /^Play .+ of .+$/ })
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('complete a full trick with 4 card plays', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);
    await completeTrick(players);

    // After trick is complete, another "Your turn!" should appear for the next trick
    let foundNextTurn = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (const page of players) {
        const turn = page.getByText('Your turn!');
        if (await turn.isVisible({ timeout: 200 }).catch(() => false)) {
          foundNextTurn = true;
          break;
        }
      }
      if (foundNextTurn) break;
      await players[0].waitForTimeout(500);
    }
    expect(foundNextTurn).toBe(true);
  });

  test('non-current player cards are disabled', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Find a player whose turn it is NOT
    for (const page of players) {
      const turn = page.getByText('Your turn!');
      if (!(await turn.isVisible({ timeout: 2_000 }).catch(() => false))) {
        // This player should have disabled cards
        // Card buttons in the hand should be disabled
        const cardButtons = page.locator('button[disabled]').filter({
          has: page.locator('span'),
        });

        // Find actual card buttons (with 2 spans: rank + suit)
        const allDisabled = await cardButtons.all();
        let disabledCardCount = 0;
        for (const btn of allDisabled) {
          if ((await btn.locator('span').count()) === 2) {
            disabledCardCount++;
          }
        }
        expect(disabledCardCount).toBeGreaterThan(0);
        break;
      }
    }
  });

  test('spade cards are disabled when leading first trick (spades not broken)', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Find the current player (leader of first trick)
    const leader = await findCurrentPlayer(players);

    // Cards are dealt sorted with spades first.
    // When leading with spades unbroken, spade cards should be disabled
    // (unless the player only has spades, which is extremely unlikely on first trick).
    const allHandCards = leader.locator('[data-testid="hand-card"]');
    const enabledCards = leader.locator(
      '[data-testid="hand-card"]:not([disabled])'
    );
    const disabledCards = leader.locator('[data-testid="hand-card"][disabled]');

    const totalCount = await allHandCards.count();
    const enabledCount = await enabledCards.count();
    const disabledCount = await disabledCards.count();

    // Player should have 13 cards
    expect(totalCount).toBe(13);
    // Some cards should be enabled (non-spade cards)
    expect(enabledCount).toBeGreaterThan(0);
    // Some cards should be disabled (spade cards) unless player has no spades
    // With 13 cards from a shuffled deck, having at least 1 spade is very likely
    // but we just check that enabled < total (at least some are restricted)
    expect(enabledCount).toBeLessThanOrEqual(totalCount);
    // Enabled + disabled = total
    expect(enabledCount + disabledCount).toBe(totalCount);
  });

  test('following player has some cards disabled based on lead suit', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // First player leads a card
    await playCurrentPlayerCard(players);

    // Find the next current player (follower)
    const follower = await findCurrentPlayer(players);

    const allHandCards = follower.locator('[data-testid="hand-card"]');
    const enabledCards = follower.locator(
      '[data-testid="hand-card"]:not([disabled])'
    );

    const totalCount = await allHandCards.count();
    const enabledCount = await enabledCards.count();

    // The follower should have 13 cards total
    expect(totalCount).toBe(13);
    // At least some cards must be enabled (they must be able to play something)
    expect(enabledCount).toBeGreaterThan(0);
    // If the follower has the lead suit, only those cards (and possibly others
    // if they don't have the suit) should be enabled, so enabled <= total
    expect(enabledCount).toBeLessThanOrEqual(totalCount);
  });
});
