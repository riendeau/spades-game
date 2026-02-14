import { test, expect } from '../fixtures/game-fixtures';
import {
  placeBid,
  placeNilBid,
  placeBlindNilBid,
  completeAllBids,
} from '../helpers/bidding-helpers';

test.describe('Bidding', () => {
  test('only the current bidder sees bidding controls', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Exactly one player should see bidding controls (See Cards or bid grid)
    let biddersCount = 0;
    for (const page of players) {
      const seeCards = page.getByRole('button', { name: 'See Cards' });
      const blindNil = page.getByRole('button', { name: 'Bid Blind Nil' });
      if (
        (await seeCards.isVisible({ timeout: 2_000 }).catch(() => false)) ||
        (await blindNil.isVisible({ timeout: 500 }).catch(() => false))
      ) {
        biddersCount++;
      }
    }
    expect(biddersCount).toBe(1);

    // Other players should see "Waiting for ... to bid..."
    let waitingCount = 0;
    for (const page of players) {
      const waiting = page.getByText(/Waiting for .+ to bid/);
      if (await waiting.isVisible({ timeout: 500 }).catch(() => false)) {
        waitingCount++;
      }
    }
    expect(waitingCount).toBe(3);
  });

  test('player can place a regular bid', async ({ fourPlayerBidding }) => {
    const { players } = fourPlayerBidding;

    // Find the current bidder and place a bid
    for (const page of players) {
      const seeCards = page.getByRole('button', { name: 'See Cards' });
      if (await seeCards.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await placeBid(page, 3);

        // Should now show "Your bid: 3"
        await expect(page.getByText('Your bid:')).toBeVisible();
        break;
      }
    }
  });

  test('player can bid blind nil before seeing cards', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Find the current bidder
    for (const page of players) {
      const blindNilBtn = page.getByRole('button', { name: 'Bid Blind Nil' });
      if (await blindNilBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await placeBlindNilBid(page);

        // Should show "Your bid: Blind Nil"
        await expect(page.getByText('My Bid: Blind Nil')).toBeVisible();
        break;
      }
    }
  });

  test('player can bid nil after seeing cards', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Find the current bidder
    for (const page of players) {
      const seeCards = page.getByRole('button', { name: 'See Cards' });
      if (await seeCards.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await placeNilBid(page);

        // Should show nil confirmation
        await expect(page.getByText(/Your bid:.*Nil/)).toBeVisible();
        break;
      }
    }
  });

  test('all 4 bids transitions to playing phase', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    await completeAllBids(players, 3);

    // Should transition to playing phase — one player's button shows "Select Card"
    let foundTurn = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      for (const page of players) {
        const turnButton = page.getByRole('button', {
          name: /^(Select Card|Play .+ of .+)$/,
        });
        if (await turnButton.isVisible({ timeout: 200 }).catch(() => false)) {
          foundTurn = true;
          break;
        }
      }
      if (foundTurn) break;
      await players[0].waitForTimeout(500);
    }
    expect(foundTurn).toBe(true);
  });
});
