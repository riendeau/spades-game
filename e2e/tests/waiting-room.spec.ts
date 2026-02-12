import { test, expect } from '../fixtures/game-fixtures';
import { createRoom, joinRoom } from '../helpers/room-helpers';

test.describe('Waiting Room', () => {
  test('ready button is disabled with fewer than 4 players', async ({ createPlayerPage }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    await expect(p1.getByRole('button', { name: 'Ready' })).toBeDisabled();
  });

  test('all players readying up starts the game', async ({ fourPlayerRoom }) => {
    const { players } = fourPlayerRoom;

    // Ready buttons should be enabled now that we have 4 players
    for (const page of players) {
      await expect(page.getByRole('button', { name: 'Ready' })).toBeEnabled();
    }

    // All players click ready
    for (const page of players) {
      await page.getByRole('button', { name: 'Ready' }).click();
    }

    // Should transition to bidding phase
    await expect(players[0].getByText(/Bidding Round/)).toBeVisible({ timeout: 15_000 });
  });

  test('player can leave the waiting room', async ({ createPlayerPage }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    await p1.getByRole('button', { name: 'Leave' }).click();

    // Should be back on the join/create screen
    await expect(p1.getByText('Play with friends online')).toBeVisible();
  });
});
