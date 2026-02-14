import { test, expect } from '../fixtures/game-fixtures';
import { completeAllBids } from '../helpers/bidding-helpers';
import { completeTrick } from '../helpers/playing-helpers';

test.describe('Full Game', () => {
  test('complete a round and see round summary', async ({
    fourPlayerBidding,
  }) => {
    test.setTimeout(180_000);
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Play all 13 tricks
    for (let trick = 0; trick < 13; trick++) {
      await completeTrick(players);
    }

    // Round summary modal should appear
    const roundComplete = players[0].getByText(/Round \d+ Complete/);
    await expect(roundComplete).toBeVisible({ timeout: 15_000 });

    // Should show Continue button
    await expect(
      players[0].getByRole('button', { name: 'Continue' })
    ).toBeVisible();
  });

  test('dismiss round summary and continue to next round', async ({
    fourPlayerBidding,
  }) => {
    test.setTimeout(180_000);
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Play all 13 tricks
    for (let trick = 0; trick < 13; trick++) {
      await completeTrick(players);
    }

    // Wait for round summary
    await players[0]
      .getByText(/Round \d+ Complete/)
      .waitFor({ timeout: 15_000 });

    // All players click Continue
    for (const page of players) {
      const continueBtn = page.getByRole('button', { name: 'Continue' });
      if (await continueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await continueBtn.click();
      }
    }

    // Should start next round — bidding appears again
    // Check for bidding buttons on at least one player
    let found = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      for (const page of players) {
        const seeCards = page.getByRole('button', { name: 'See Cards' });
        if (await seeCards.isVisible({ timeout: 100 }).catch(() => false)) {
          found = true;
          break;
        }
      }
      if (found) break;
      await players[0].waitForTimeout(500);
    }
    expect(found).toBe(true);
  });
});
