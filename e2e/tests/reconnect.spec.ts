import { test, expect, type Page } from '../fixtures/game-fixtures';
import { findCurrentBidder, placeBid } from '../helpers/bidding-helpers';

// Regression tests for issue #230: a network blip mid-game triggers the
// reconnect flow (socket.io auto-reconnect → player:reconnect →
// reconnect:success). The reveal decision after reconnecting must match the
// seat's See Cards / Bid Blind Nil state, not unconditionally flip cards
// face-up — an unconditional reveal robs the player of Bid Blind Nil.
//
// Note: these tests blip the socket transport via the dev-only __blipSocket
// helper, not page.reload() or context.setOffline(). A reload loses the
// Zustand store (reconnect:success does not restore roomId/myPosition, so a
// reloaded page lands in the lobby — a separate pre-existing issue outside
// #230's scope), and setOffline leaves the websocket up until the ~45s ping
// timeout notices it.

async function blipConnection(page: Page): Promise<void> {
  // Wait for the use-game reconnect:success log — the deterministic signal
  // that the handler (the code under test) has run.
  const reconnected = page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('[game] reconnect:success'),
    timeout: 15000,
  });
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__blipSocket();
  });
  await reconnected;
}

test.describe('Reconnect card reveal', () => {
  test('reconnect during bidding before the See Cards decision keeps Blind Nil available', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await blipConnection(bidder);

    // The decision must still be open after reconnecting: both pre-reveal
    // buttons present, no bid grid.
    await expect(
      bidder.getByRole('button', { name: 'Bid Blind Nil' })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      bidder.getByRole('button', { name: 'See Cards' })
    ).toBeVisible();
    await expect(bidder.getByText('Select your bid:')).not.toBeVisible();
  });

  test('reconnect during bidding after clicking See Cards keeps cards revealed', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await bidder.getByRole('button', { name: 'See Cards' }).click();
    await expect(bidder.getByText('Select your bid:')).toBeVisible();

    await blipConnection(bidder);

    // The See Cards decision was already committed — the server auto-reveals
    // and the bid grid comes straight back.
    await expect(bidder.getByText('Select your bid:')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      bidder.getByRole('button', { name: 'See Cards' })
    ).not.toBeVisible();
  });

  test('reconnect during bidding after placing a bid keeps cards revealed', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await placeBid(bidder, 3);
    await expect(bidder.getByText('Your bid:')).toBeVisible();

    await blipConnection(bidder);

    // A placed bid commits past the decision point: reveal persists.
    await expect(bidder.getByText('Your bid:')).toBeVisible({
      timeout: 15000,
    });
    await expect(
      bidder.getByRole('button', { name: 'Bid Blind Nil' })
    ).not.toBeVisible();
  });
});
