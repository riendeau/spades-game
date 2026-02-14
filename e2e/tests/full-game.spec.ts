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

  // FLAKE HISTORY:
  // - 2026-02-14: Intermittent timeout during second round bidding (PR #20)
  //   - Failed during full suite run with "Target page, context or browser has been closed"
  //   - Error occurred at completeAllBids() when clicking bid button '3'
  //   - Test passed when run in isolation (21.7s)
  //   - Test passed on subsequent full suite run
  //   Analysis: Long-running test (13 tricks = 52 card plays) is sensitive to resource
  //   contention when running in full suite. Timeout occurred at 180s limit during
  //   bidding phase of second round, suggesting cumulative timing issues rather than
  //   a specific bug in the card interaction changes that were being tested.
  //   Potential fixes if this becomes recurring:
  //   - Increase timeout beyond 180s
  //   - Add explicit waits between rounds for server state to stabilize
  //   - Run full-game tests in parallel worker to isolate from other tests
  //   - Add retry logic specifically for the second round bidding phase
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
