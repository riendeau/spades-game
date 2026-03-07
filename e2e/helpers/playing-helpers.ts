import type { Page } from '@playwright/test';

/**
 * Plays the first available (non-disabled) card on the given page.
 * The page must be the current player's turn.
 */
export async function playFirstCard(page: Page): Promise<void> {
  // Wait for it to be this player's turn
  await page.locator('[data-testid="my-turn"]').waitFor({ timeout: 15_000 });

  // Count cards before playing so we can verify the play was confirmed
  const handCards = page.locator('[data-testid="hand-card"]');
  const countBefore = await handCards.count();

  // Double-click the first playable card to play it
  const card = page
    .locator('[data-testid="hand-card"]:not([disabled])')
    .first();
  await card.dblclick();

  // Wait for the server to confirm the play (card removed from hand)
  // This prevents findCurrentPlayer from picking a stale page on the next call
  await page.waitForFunction(
    (before: number) =>
      document.querySelectorAll('[data-testid="hand-card"]').length < before,
    countBefore,
    { timeout: 10_000 }
  );
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
 * Finds which page is the current player (has the my-turn indicator).
 */
export async function findCurrentPlayer(pages: Page[]): Promise<Page> {
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const page of pages) {
      const turnIndicator = page.locator('[data-testid="my-turn"]');
      if (await turnIndicator.isVisible({ timeout: 100 }).catch(() => false)) {
        return page;
      }
    }
    await pages[0].waitForTimeout(500);
  }
  throw new Error('Could not find current player');
}
