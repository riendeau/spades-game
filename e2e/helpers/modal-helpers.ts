import { errors, type Page } from '@playwright/test';

const MODAL_ROOT = '[data-testid="team-reveal-modal"]';
const DISMISS_BTN = '[data-testid="team-reveal-dismiss"]';

/**
 * Clicks the dismiss button, tolerating "it never showed up" but nothing else.
 *
 * A timeout means the button never appeared, which each caller below has
 * already decided is acceptable. Anything else — detached mid-click during the
 * modal's name-swap re-render, or an interception by another overlay — is a
 * real failure and must not be swallowed: silently leaving the overlay up is
 * what produced misleading "<div> intercepts pointer events" errors on
 * unrelated buttons several steps later.
 */
async function clickDismiss(page: Page, timeout: number): Promise<void> {
  const dismissBtn = page.locator(DISMISS_BTN);
  try {
    await dismissBtn.click({ timeout });
  } catch (err) {
    if (!(err instanceof errors.TimeoutError)) throw err;
    return;
  }
  await dismissBtn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
}

/**
 * Waits for the team name reveal modal to appear, then dismisses it.
 *
 * For callers that have just triggered the game start and therefore *know* the
 * modal is coming. The modal only mounts once the page processes `game:started`
 * (`GameTable.tsx`, gated on `teamNameReveal`), which is an async socket event
 * relative to the caller — so this waits for the root to attach rather than
 * sampling for it. A `count()`-style instant check would return "not there"
 * during the tens of milliseconds before the event lands, the modal would mount
 * a moment later, and its overlay would swallow clicks for the rest of the test.
 *
 * The button wait then has to clear TeamNameRevealModal's own 10s fallback
 * timer: locally there is no ANTHROPIC_API_KEY, so `generateTeamNames` returns
 * null, the server never emits `game:team-names`, and the modal spins on
 * "Setting up game..." until that timer swaps in placeholder names and renders
 * the button. (Auto-waiting via `click({ timeout })` is what fixed the original
 * bug here: Playwright ignores the timeout option on `isVisible`, so the old
 * gate was an instant check that skipped the first page in a dismiss loop on
 * every single run.)
 */
export async function dismissTeamNameReveal(
  page: Page,
  timeout = 25_000
): Promise<void> {
  const attached = await page
    .locator(MODAL_ROOT)
    .waitFor({ state: 'attached', timeout })
    .then(() => true)
    .catch(() => false);
  // Bail rather than falling through to a second full-timeout wait on a button
  // that cannot exist. A modal that never mounts means the game never started,
  // which the caller's own next assertion reports far more usefully than this
  // helper could.
  if (!attached) return;
  await clickDismiss(page, timeout);
}

/**
 * Dismisses the modal only if it is already on the page, returning immediately
 * when it is not.
 *
 * For defensive callers deep in a test, where the fixture has long since
 * dismissed the modal and its absence is the expected case. The instant
 * `count()` check on the root is what keeps them from paying `timeout` on every
 * invocation — the root is the right thing to check because the dismiss button
 * is absent both when there is no modal and when the modal is still spinning,
 * and those two need opposite handling.
 */
export async function dismissTeamNameRevealIfPresent(
  page: Page,
  timeout = 1000
): Promise<void> {
  if ((await page.locator(MODAL_ROOT).count()) === 0) return;
  await clickDismiss(page, timeout);
}
