import { test, expect, type Page } from '../fixtures/game-fixtures';
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

  test('3rd player has bids disabled when team total would exceed 13', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Player 1 (position 0) bids 5
    let bidder = await findCurrentBidder(players);
    await placeBid(bidder, 5);

    // Player 2 (position 1) bids 6
    bidder = await findCurrentBidder(players);
    await placeBid(bidder, 6);

    // Player 3 (position 2, partner of position 0) should now be bidding
    // Partner bid 5, so max allowed is 8 (5+8=13)
    // Buttons 9-13 should be disabled
    bidder = await findCurrentBidder(players);

    // First reveal cards
    const seeCards = bidder.getByRole('button', { name: 'See Cards' });
    if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeCards.click();
    }

    // Check that buttons 9-13 are disabled
    for (let i = 9; i <= 13; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeDisabled();
    }

    // Check that buttons 1-8 are enabled
    for (let i = 1; i <= 8; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeEnabled();
    }
  });

  test('4th player has bids disabled when team total would exceed 13', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Player 1 (position 0) bids 5
    let bidder = await findCurrentBidder(players);
    await placeBid(bidder, 5);

    // Player 2 (position 1) bids 6
    bidder = await findCurrentBidder(players);
    await placeBid(bidder, 6);

    // Player 3 (position 2) bids 4
    bidder = await findCurrentBidder(players);
    await placeBid(bidder, 4);

    // Player 4 (position 3, partner of position 1) should now be bidding
    // Partner bid 6, so max allowed is 7 (6+7=13)
    // Buttons 8-13 should be disabled
    bidder = await findCurrentBidder(players);

    // First reveal cards
    const seeCards = bidder.getByRole('button', { name: 'See Cards' });
    if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeCards.click();
    }

    // Check that buttons 8-13 are disabled
    for (let i = 8; i <= 13; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeDisabled();
    }

    // Check that buttons 1-7 are enabled
    for (let i = 1; i <= 7; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeEnabled();
    }
  });

  test('3rd player can bid full range when partner bid nil', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Player 1 (position 0) bids nil
    let bidder = await findCurrentBidder(players);
    await placeNilBid(bidder);

    // Player 2 (position 1) bids 5
    bidder = await findCurrentBidder(players);
    await placeBid(bidder, 5);

    // Player 3 (position 2, partner of position 0) should now be bidding
    // Partner bid nil (0), so max allowed is 13
    // All buttons should be enabled
    bidder = await findCurrentBidder(players);

    // First reveal cards
    const seeCards = bidder.getByRole('button', { name: 'See Cards' });
    if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeCards.click();
    }

    // Check that all buttons 1-13 are enabled
    for (let i = 1; i <= 13; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeEnabled();
    }
  });

  test('first two players have no bid restrictions', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;

    // Player 1 (position 0) should see all buttons enabled
    let bidder = await findCurrentBidder(players);

    // First reveal cards
    const seeCards = bidder.getByRole('button', { name: 'See Cards' });
    if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeCards.click();
    }

    // Check that all buttons 1-13 are enabled
    for (let i = 1; i <= 13; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeEnabled();
    }

    // Place bid and move to next player
    await placeBid(bidder, 5);

    // Player 2 (position 1) should also see all buttons enabled
    bidder = await findCurrentBidder(players);

    // First reveal cards
    const seeCards2 = bidder.getByRole('button', { name: 'See Cards' });
    if (await seeCards2.isVisible({ timeout: 1000 }).catch(() => false)) {
      await seeCards2.click();
    }

    // Check that all buttons 1-13 are enabled
    for (let i = 1; i <= 13; i++) {
      const button = bidder.getByRole('button', {
        name: String(i),
        exact: true,
      });
      await expect(button).toBeEnabled();
    }
  });
});

/**
 * Helper function to find the current bidder.
 * Exported to avoid duplication with bidding-helpers.ts
 */
async function findCurrentBidder(pages: Page[]): Promise<Page> {
  // Poll until one page shows bidding controls
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const page of pages) {
      // Check for "See Cards" button (pre-reveal) or "Submit Bid" button (post-reveal)
      const seeCards = page.getByRole('button', { name: 'See Cards' });
      const bidNil = page.getByRole('button', { name: 'Nil' });
      const blindNil = page.getByRole('button', { name: 'Bid Blind Nil' });

      if (
        (await seeCards.isVisible({ timeout: 100 }).catch(() => false)) ||
        (await bidNil.isVisible({ timeout: 100 }).catch(() => false)) ||
        (await blindNil.isVisible({ timeout: 100 }).catch(() => false))
      ) {
        return page;
      }
    }
    await pages[0].waitForTimeout(500);
  }
  throw new Error('Could not find current bidder');
}
