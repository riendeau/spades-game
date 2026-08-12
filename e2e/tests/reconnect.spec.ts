import { LOBBY_TITLE } from '../../apps/client/src/lobby-branding';
import { test, expect, type Page } from '../fixtures/game-fixtures';
import { findCurrentBidder, placeBid } from '../helpers/bidding-helpers';

// Regression tests for issue #230: a network blip mid-game triggers the
// reconnect flow (socket.io auto-reconnect → player:reconnect →
// reconnect:success). The reveal decision after reconnecting must match the
// seat's See Cards / Bid Blind Nil state, not unconditionally flip cards
// face-up — an unconditional reveal robs the player of Bid Blind Nil.
//
// Note: these tests blip the socket transport via the dev-only __blipSocket
// helper, not page.reload() or context.setOffline(). A blip is the narrower
// signal — it keeps the Zustand store, so only the reveal decision is under
// test. (setOffline is never usable: it leaves the websocket up until the ~45s
// ping timeout notices it.) The reload path — where the store is lost and
// reconnect:success has to rebuild roomId/myPosition — is covered separately
// in the 'Reconnect after page reload' describe below (issue #299).

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

async function reloadAndReconnect(page: Page): Promise<void> {
  // Same deterministic signal as blipConnection. Armed before the reload
  // (console listeners survive navigation) so a fast reconnect can't land in
  // the gap — no reconnect has happened on this page yet, so there's no stale
  // message for it to match.
  const reconnected = page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('[game] reconnect:success'),
    timeout: 15000,
  });
  await page.reload();
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

  // The client re-asserts its See Cards decision as `viewedRound` on every
  // player:reconnect, so the server can recover a `game:see-cards` that never
  // arrived (lost on a half-open socket, or flushed as a buffered packet
  // before player:reconnect attached a session — socket.io emits buffered
  // packets ahead of the 'connect' listener). Without it the seat comes back
  // face-down with a Bid Blind Nil it had already forfeited.
  //
  // This asserts the client half: the decision is persisted, survives a full
  // reload, and goes out on the wire. The server half — actually applying it,
  // and refusing a stale or malformed claim — is covered deterministically in
  // apps/server/src/__tests__/reconnect-auto-reveal.test.ts, since forcing the
  // event to be lost from a real browser is inherently racy.
  test('reload after See Cards re-asserts the reveal decision to the server', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await bidder.getByRole('button', { name: 'See Cards' }).click();
    await expect(bidder.getByText('Select your bid:')).toBeVisible();

    const emitted = bidder.waitForEvent('console', {
      predicate: (msg) =>
        msg.text().includes('[game] emitting player:reconnect') &&
        /viewedRound=\d+/.test(msg.text()),
      timeout: 15000,
    });
    await bidder.reload();
    await emitted;

    await expect(bidder.getByText('Select your bid:')).toBeVisible({
      timeout: 15000,
    });
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

// Regression tests for issue #299: a full page reload wipes the Zustand store,
// so reconnect:success is the only chance to restore roomId/myPosition. Before
// the fix the server reattached the seat but the client kept rendering the
// lobby, stranding the player mid-game.
test.describe('Reconnect after page reload', () => {
  test('reload during bidding returns to the game table, not the lobby', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await reloadAndReconnect(bidder);

    await expect(
      bidder.getByRole('heading', { name: LOBBY_TITLE })
    ).not.toBeVisible();
    // The seat had made no See Cards / Bid Blind Nil decision, so both are
    // still on offer — the reload must not have committed one implicitly.
    await expect(
      bidder.getByRole('button', { name: 'Bid Blind Nil' })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      bidder.getByRole('button', { name: 'See Cards' })
    ).toBeVisible();
  });

  test('reload after placing a bid restores the revealed hand', async ({
    fourPlayerBidding,
  }) => {
    const { players } = fourPlayerBidding;
    const bidder = await findCurrentBidder(players);

    await placeBid(bidder, 3);
    await expect(bidder.getByText('Your bid:')).toBeVisible();

    await reloadAndReconnect(bidder);

    await expect(
      bidder.getByRole('heading', { name: LOBBY_TITLE })
    ).not.toBeVisible();
    await expect(bidder.getByText('Your bid:')).toBeVisible({ timeout: 15000 });
    // myPosition was restored too, so the seat's own hand renders face-up.
    await expect(
      bidder.locator('[data-testid="hand-card"]').first()
    ).toBeVisible();
  });
});
