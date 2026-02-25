import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { createRoom, joinRoom } from '../helpers/room-helpers';

interface GameFixtures {
  createPlayerPage: (nickname: string) => Promise<Page>;
  fourPlayerRoom: { players: Page[]; roomCode: string };
  fourPlayerBidding: { players: Page[]; roomCode: string };
}

export const test = base.extend<GameFixtures>({
  createPlayerPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const factory = async (nickname: string): Promise<Page> => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/');
      await page.getByText('Spades').waitFor();
      return page;
    };

    await use(factory);

    // Cleanup all contexts
    for (const ctx of contexts) {
      await ctx.close();
    }
  },

  fourPlayerRoom: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const createCtx = async (): Promise<Page> => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/');
      await page.getByText('Spades').waitFor();
      return page;
    };

    // Player 1 creates the room
    const p1 = await createCtx();
    const roomCode = await createRoom(p1, 'Player1');

    // Players 2-4 join
    const p2 = await createCtx();
    await joinRoom(p2, roomCode, 'Player2');
    const p3 = await createCtx();
    await joinRoom(p3, roomCode, 'Player3');
    const p4 = await createCtx();
    await joinRoom(p4, roomCode, 'Player4');

    await use({ players: [p1, p2, p3, p4], roomCode });

    for (const ctx of contexts) {
      await ctx.close();
    }
  },

  fourPlayerBidding: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    const createCtx = async (): Promise<Page> => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/');
      await page.getByText('Spades').waitFor();
      return page;
    };

    // Player 1 creates the room
    const p1 = await createCtx();
    const roomCode = await createRoom(p1, 'Player1');

    // Players 2-4 join
    const p2 = await createCtx();
    await joinRoom(p2, roomCode, 'Player2');
    const p3 = await createCtx();
    await joinRoom(p3, roomCode, 'Player3');
    const p4 = await createCtx();
    await joinRoom(p4, roomCode, 'Player4');

    const players = [p1, p2, p3, p4];

    // All players ready up
    for (const page of players) {
      await page.getByRole('button', { name: 'Ready', exact: true }).click();
    }

    // Wait for bidding phase to appear on any page
    // Check for bidding controls to appear on at least one player
    let found = false;
    for (let attempt = 0; attempt < 30 && !found; attempt++) {
      for (const page of players) {
        const seeCards = page.getByRole('button', { name: 'See Cards' });
        if (await seeCards.isVisible({ timeout: 100 }).catch(() => false)) {
          found = true;
          break;
        }
      }
      if (!found) {
        await p1.waitForTimeout(500);
      }
    }

    if (!found) {
      throw new Error('Bidding phase did not start within timeout');
    }

    await use({ players, roomCode });

    for (const ctx of contexts) {
      await ctx.close();
    }
  },
});

export { expect, type Page } from '@playwright/test';
