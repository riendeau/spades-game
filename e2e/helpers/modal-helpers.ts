import type { Page } from '@playwright/test';

/**
 * Dismisses the team name reveal modal if it's present on the page.
 * Waits up to the given timeout for the dismiss button to appear.
 *
 * The default budget has to clear TeamNameRevealModal's own 10s fallback timer:
 * locally there is no ANTHROPIC_API_KEY, so `generateTeamNames` returns null,
 * the server never emits `game:team-names`, and the modal spins on "Setting up
 * game..." until that timer swaps in placeholder names and renders this button.
 * Callers that pass a short timeout (e.g. placeBid's 1s) are saying "dismiss it
 * only if it happens to be up already".
 */
export async function dismissTeamNameReveal(
  page: Page,
  timeout = 25_000
): Promise<void> {
  const dismissBtn = page.locator('[data-testid="team-reveal-dismiss"]');
  // `click({ timeout })` auto-waits for the button, unlike the previous
  // `isVisible({ timeout })` gate — Playwright ignores the timeout option on
  // isVisible, making it an immediate check. The first page in a fixture's
  // dismiss loop is checked while its modal still shows the spinner, so it was
  // skipped every single run; the overlay then stayed up and swallowed clicks
  // for the rest of the test. Tests that only touch the other three pages
  // passed, which is why this looked like a ~25% flake rather than a bug.
  await dismissBtn.click({ timeout }).catch(() => {});
  await dismissBtn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
}
