import type { Page } from '@playwright/test';

/**
 * Dismisses the team name reveal modal if it's present on the page.
 * Waits up to the given timeout for the dismiss button to appear.
 */
export async function dismissTeamNameReveal(
  page: Page,
  timeout = 12_000
): Promise<void> {
  const dismissBtn = page.locator('[data-testid="team-reveal-dismiss"]');
  if (await dismissBtn.isVisible({ timeout }).catch(() => false)) {
    await dismissBtn.click();
    // Wait for the modal overlay to disappear
    await page
      .locator('[data-testid="team-reveal-dismiss"]')
      .waitFor({ state: 'hidden', timeout: 2000 })
      .catch(() => {});
  }
}
