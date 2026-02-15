import { test, expect } from '../fixtures/game-fixtures';
import { createRoom, joinRoom } from '../helpers/room-helpers';

test.describe('Waiting Room', () => {
  test('ready button is disabled with fewer than 4 players', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    await expect(
      p1.getByRole('button', { name: 'Ready', exact: true })
    ).toBeDisabled();
  });

  test('all players readying up starts the game', async ({
    fourPlayerRoom,
  }) => {
    const { players } = fourPlayerRoom;

    // Ready buttons should be enabled now that we have 4 players
    for (const page of players) {
      await expect(
        page.getByRole('button', { name: 'Ready', exact: true })
      ).toBeEnabled();
    }

    // All players click ready
    for (const page of players) {
      await page.getByRole('button', { name: 'Ready', exact: true }).click();
    }

    // Should transition to bidding phase (check for bidding buttons)
    // One of the players should see bidding controls
    // Poll up to 10 times with 500ms intervals (max 5 seconds)
    let found = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const page of players) {
        const seeCards = page.getByRole('button', { name: 'See Cards' });
        if (await seeCards.isVisible({ timeout: 200 }).catch(() => false)) {
          found = true;
          break;
        }
      }
      if (found) break;
      await players[0].waitForTimeout(500);
    }
    expect(found).toBe(true);
  });

  test('player can leave the waiting room', async ({ createPlayerPage }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    await p1.getByRole('button', { name: 'Leave' }).click();

    // Should be back on the join/create screen
    await expect(p1.getByText('Play with friends online')).toBeVisible();
  });
});
