import type { Page } from '@playwright/test';

/**
 * Plays the first available (non-disabled) card on the given page.
 * The page must be showing "Your turn!".
 *
 * NOTE: This works reliably for the first play in a trick (no TrickArea cards yet).
 * For subsequent plays within a trick, TrickArea also renders non-disabled <Card>
 * buttons that can match the same selector. See full-game.spec.ts comments for details
 * on approaches to fix multi-play scenarios.
 */
export async function playFirstCard(page: Page): Promise<void> {
  await page.getByText('Your turn!').waitFor({ timeout: 15_000 });

  // Find the first enabled card button in the hand area.
  // Cards are <button> elements containing rank + suit spans.
  const cards = page.locator('button:not([disabled])').filter({
    has: page.locator('span'),
  });

  // Click the first card that looks like a playing card (has 2 spans: rank + suit)
  const cardButtons = await cards.all();
  for (const card of cardButtons) {
    const spans = await card.locator('span').count();
    if (spans === 2) {
      await card.click();
      break;
    }
  }

  // Wait for the Play button to appear and click it
  const playButton = page.getByRole('button', { name: /^Play .+ of .+$/ });
  await playButton.waitFor({ timeout: 5_000 });
  await playButton.click();
}

/**
 * Finds the page whose turn it is and plays a card.
 */
export async function playCurrentPlayerCard(pages: Page[]): Promise<Page> {
  const player = await findCurrentPlayer(pages);
  await playFirstCard(player);
  return player;
}

/**
 * Completes one trick (4 card plays).
 */
export async function completeTrick(pages: Page[]): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await playCurrentPlayerCard(pages);
  }
  // Brief pause for trick collection animation
  await pages[0].waitForTimeout(1000);
}

/**
 * Finds which page currently shows "Your turn!".
 */
async function findCurrentPlayer(pages: Page[]): Promise<Page> {
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const page of pages) {
      const turnIndicator = page.getByText('Your turn!');
      if (await turnIndicator.isVisible({ timeout: 100 }).catch(() => false)) {
        return page;
      }
    }
    await pages[0].waitForTimeout(500);
  }
  throw new Error('Could not find current player');
}
