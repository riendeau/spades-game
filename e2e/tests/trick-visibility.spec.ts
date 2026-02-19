import { test, expect } from '../fixtures/game-fixtures';
import { completeAllBids } from '../helpers/bidding-helpers';
import {
  completeTrick,
  playCurrentPlayerCard,
} from '../helpers/playing-helpers';

test.describe('trick card visibility after completion', () => {
  // After the 4th card is played the server briefly holds the game in
  // trick-end phase before dispatching COLLECT_TRICK (1500ms delay).
  // During that window all 4 played cards must be visible in the trick area.

  test('all 4 played cards are visible until the trick is collected', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Play the first 3 cards of the opening trick
    for (let i = 0; i < 3; i++) {
      await playCurrentPlayerCard(players);
    }

    // Play the 4th card — after server confirmation the game is in trick-end
    // phase and game:state-update has been sent with all 4 plays present
    await playCurrentPlayerCard(players);

    // All 4 trick cards must be visible before the server collects the trick
    await expect(players[0].locator('[data-testid="trick-card"]')).toHaveCount(
      4,
      { timeout: 3_000 }
    );

    // After ~1.5s the server dispatches COLLECT_TRICK and sends a cleared
    // game:state-update — the trick area should return to empty
    await expect(players[0].locator('[data-testid="trick-card"]')).toHaveCount(
      0,
      { timeout: 5_000 }
    );
  });

  test('all 4 played cards are visible on the final trick before the round summary appears', async ({
    fourPlayerBidding,
  }) => {
    test.setTimeout(180_000);
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Play tricks 1–12 using the standard helper
    for (let trick = 0; trick < 12; trick++) {
      await completeTrick(players);
    }

    // Play the first 3 cards of the 13th (final) trick
    for (let i = 0; i < 3; i++) {
      await playCurrentPlayerCard(players);
    }

    // Play the 4th and final card of the round
    await playCurrentPlayerCard(players);

    // All 4 trick cards must be visible in the trick-end window
    await expect(players[0].locator('[data-testid="trick-card"]')).toHaveCount(
      4,
      { timeout: 3_000 }
    );

    // After COLLECT_TRICK runs the round summary modal should appear
    await expect(players[0].getByText(/Round \d+ Complete/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
