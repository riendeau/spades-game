import type { Page } from '@playwright/test';

/**
 * Plays an available (non-disabled) card on the given page.
 * Prefers non-spade cards to avoid "Cannot lead with spades until broken".
 * Waits for the card to be removed from the hand (server acknowledgement).
 */
export async function playFirstCard(page: Page): Promise<void> {
  await page.getByText('Your turn!').waitFor({ timeout: 15_000 });

  const handCards = page.locator('[data-testid="hand-card"]:not([disabled])');
  const cardCount = await handCards.count();

  // Prefer non-spade cards to avoid leading-with-spades violation
  let cardToClick = handCards.first();
  for (let i = 0; i < cardCount; i++) {
    const text = await handCards.nth(i).textContent() || '';
    if (!text.includes('\u2660')) {
      cardToClick = handCards.nth(i);
      break;
    }
  }

  await cardToClick.click();

  // Wait for the Play button to appear and click it
  const playButton = page.getByRole('button', { name: /^Play .+ of .+$/ });
  await playButton.waitFor({ timeout: 5_000 });
  await playButton.click();

  // Wait for server acknowledgement — card count should decrease
  const expectedCount = cardCount - 1;
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[data-testid="hand-card"]').length === expected,
    expectedCount,
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
