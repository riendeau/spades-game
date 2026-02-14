import type { Page } from '@playwright/test';

/**
 * Places a numeric bid (1-13) on a page that is the current bidder.
 * Handles the See Cards step if cards haven't been revealed yet.
 */
export async function placeBid(page: Page, value: number): Promise<void> {
  // If we see the "See Cards" button, click it first
  const seeCards = page.getByRole('button', { name: 'See Cards' });
  if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
    await seeCards.click();
  }

  // Select the bid value
  await page.getByRole('button', { name: String(value), exact: true }).click();
  await page.getByRole('button', { name: 'Submit Bid' }).click();
}

/**
 * Places a nil bid on a page that is the current bidder.
 */
export async function placeNilBid(page: Page): Promise<void> {
  // If we see the "See Cards" button, click it first
  const seeCards = page.getByRole('button', { name: 'See Cards' });
  if (await seeCards.isVisible({ timeout: 1000 }).catch(() => false)) {
    await seeCards.click();
  }

  await page.getByRole('button', { name: 'Nil' }).click();
  await page.getByRole('button', { name: 'Submit Bid' }).click();
}

/**
 * Places a blind nil bid on a page that is the current bidder.
 */
export async function placeBlindNilBid(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Bid Blind Nil' }).click();
}

/**
 * Completes all 4 bids by finding the current bidder among the pages.
 * Each player bids the given value.
 */
export async function completeAllBids(
  pages: Page[],
  bidValue: number
): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const bidder = await findCurrentBidder(pages);
    await placeBid(bidder, bidValue);
  }
}

/**
 * Finds which page currently has bidding controls visible.
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
