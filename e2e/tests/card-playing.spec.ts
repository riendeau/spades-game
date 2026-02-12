import { test, expect } from '../fixtures/game-fixtures';
import { completeAllBids } from '../helpers/bidding-helpers';
import { playFirstCard, playCurrentPlayerCard, completeTrick } from '../helpers/playing-helpers';

test.describe('Card Playing', () => {
  test('current player can select and play a card', async ({ fourPlayerBidding }) => {
    const { players } = fourPlayerBidding;

    // Complete bidding first
    await completeAllBids(players, 3);

    // Find whose turn it is and play a card
    const activePlayer = await playCurrentPlayerCard(players);

    // The play button should disappear after playing
    await expect(activePlayer.getByRole('button', { name: /^Play .+ of .+$/ })).not.toBeVisible({ timeout: 5_000 });
  });

  test('complete a full trick with 4 card plays', async ({ fourPlayerBidding }) => {
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

  test('non-current player cards are disabled', async ({ fourPlayerBidding }) => {
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
});
