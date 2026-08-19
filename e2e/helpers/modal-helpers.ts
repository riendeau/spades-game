import { errors, type Page } from '@playwright/test';

/**
 * Dismisses the team name reveal modal if it's present on the page.
 *
 * Returns immediately when the modal isn't mounted at all — the common case
 * once a fixture has already dismissed it, and what keeps the defensive
 * short-timeout callers (placeBid and friends) from paying their full timeout
 * on every bid.
 *
 * When the modal *is* mounted, waits up to the given timeout for its dismiss
 * button. That wait has to clear TeamNameRevealModal's own 10s fallback timer:
 * locally there is no ANTHROPIC_API_KEY, so `generateTeamNames` returns null,
 * the server never emits `game:team-names`, and the modal spins on "Setting up
 * game..." until that timer swaps in placeholder names and renders the button.
 */
export async function dismissTeamNameReveal(
  page: Page,
  timeout = 25_000
): Promise<void> {
  // Immediate check on the modal root, not the button: the button is absent
  // both when there's no modal and when the modal is still spinning, and those
  // two need opposite handling.
  if ((await page.locator('[data-testid="team-reveal-modal"]').count()) === 0) {
    return;
  }

  const dismissBtn = page.locator('[data-testid="team-reveal-dismiss"]');
  // `click({ timeout })` auto-waits for the button, unlike the previous
  // `isVisible({ timeout })` gate — Playwright ignores the timeout option on
  // isVisible, making it an immediate check. The first page in a fixture's
  // dismiss loop is checked while its modal still shows the spinner, so it was
  // skipped every single run; the overlay then stayed up and swallowed clicks
  // for the rest of the test. Tests that only touch the other three pages
  // passed, which is why this looked like a ~25% flake rather than a bug.
  try {
    await dismissBtn.click({ timeout });
  } catch (err) {
    // A timeout means the button never appeared — for a short-timeout caller
    // that's the documented "dismiss it only if it's ready" semantics. Anything
    // else (detached mid-click during the modal's name-swap re-render, or an
    // interception by another overlay) is a real failure and must not be
    // swallowed: silently leaving the overlay up is what produced the
    // misleading "<div> intercepts pointer events" errors on unrelated buttons.
    if (!(err instanceof errors.TimeoutError)) throw err;
    return;
  }
  await dismissBtn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
}
