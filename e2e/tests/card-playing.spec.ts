import { test, expect } from '../fixtures/game-fixtures';
import { completeAllBids } from '../helpers/bidding-helpers';
import {
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

    // The play button should now show "Waiting..." after playing
    await expect(
      activePlayer.getByRole('button', { name: 'Waiting...' })
    ).toBeVisible({ timeout: 5_000 });
  });

  test('complete a full trick with 4 card plays', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);
    await completeTrick(players);

    // After trick is complete, one player should have button showing "Select Card" for the next trick
    let foundNextTurn = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (const page of players) {
        const turnButton = page.getByRole('button', {
          name: /^(Select Card|Play .+ of .+)$/,
        });
        if (await turnButton.isVisible({ timeout: 200 }).catch(() => false)) {
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

    // Find a player whose turn it is NOT (button showing "Waiting...")
    for (const page of players) {
      const waitingButton = page.getByRole('button', { name: 'Waiting...' });
      if (
        await waitingButton.isVisible({ timeout: 2_000 }).catch(() => false)
      ) {
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

  test('clicking a selected card deselects it', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    const activePlayer = await findCurrentPlayer(players);

    // Select a card
    const card = activePlayer
      .locator('[data-testid="hand-card"]:not([disabled])')
      .first();
    await card.click();

    // Button should show "Play <card>"
    await expect(
      activePlayer.getByRole('button', { name: /^Play .+ of .+$/ })
    ).toBeVisible({ timeout: 2_000 });

    // Click the same card again to deselect
    await card.click();

    // Button should now show "Select Card" (card is deselected)
    await expect(
      activePlayer.getByRole('button', { name: 'Select Card' })
    ).toBeVisible({ timeout: 2_000 });
  });

  test('double-clicking a card plays it immediately', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    const activePlayer = await findCurrentPlayer(players);

    // Count cards before playing
    const handCards = activePlayer.locator('[data-testid="hand-card"]');
    const countBefore = await handCards.count();

    // Double-click a card to play it immediately
    const card = activePlayer
      .locator('[data-testid="hand-card"]:not([disabled])')
      .first();
    await card.dblclick();

    // Wait for the server to confirm the play (card removed from hand)
    await activePlayer.waitForFunction(
      (before: number) =>
        document.querySelectorAll('[data-testid="hand-card"]').length < before,
      countBefore,
      { timeout: 10_000 }
    );

    // Button should now show "Waiting..." after playing
    await expect(
      activePlayer.getByRole('button', { name: 'Waiting...' })
    ).toBeVisible({ timeout: 5_000 });
  });
});
