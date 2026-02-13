import type { Page } from '@playwright/test';

/**
 * Plays an available (non-disabled) card on the given page.
 * Prefers non-spade cards to avoid "Cannot lead with spades until broken".
 * Waits for the card to be removed from the hand (server acknowledgement).
 */
export async function playFirstCard(page: Page): Promise<void> {
  await page.getByText('Your turn!').waitFor({ timeout: 15_000 });

  // Count cards before playing so we can verify the play was confirmed
  const handCards = page.locator('[data-testid="hand-card"]');
  const countBefore = await handCards.count();

  // Use data-testid + :not([disabled]) to target playable hand cards
  const card = page.locator('[data-testid="hand-card"]:not([disabled])').first();
  await card.click();

  // Wait for the Play button to appear and click it
  const playButton = page.getByRole('button', { name: /^Play .+ of .+$/ });
  await playButton.waitFor({ timeout: 5_000 });
  await playButton.click();

  // Wait for the server to confirm the play (card removed from hand)
  // This prevents findCurrentPlayer from picking a stale page on the next call
  await page.waitForFunction(
    (before: number) => document.querySelectorAll('[data-testid="hand-card"]').length < before,
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
 * Finds which page currently shows "Your turn!".
 */
export async function findCurrentPlayer(pages: Page[]): Promise<Page> {
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
