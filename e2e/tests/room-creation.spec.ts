import { test, expect } from '../fixtures/game-fixtures';
import { createRoom, joinRoom } from '../helpers/room-helpers';

test.describe('Room Creation', () => {
  test('creating a room shows the waiting room with a 6-character code', async ({
    createPlayerPage,
  }) => {
    const page = await createPlayerPage('Alice');
    const roomCode = await createRoom(page, 'Alice');

    await expect(page.getByText('Waiting Room')).toBeVisible();
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('second player can join with room code', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    const p2 = await createPlayerPage('Bob');
    await joinRoom(p2, roomCode, 'Bob');

    // Both players should see each other
    await expect(p1.getByText('Bob')).toBeVisible();
    await expect(p2.getByText('Alice')).toBeVisible();
  });

  test('invalid room code shows error', async ({ createPlayerPage }) => {
    const page = await createPlayerPage('Alice');
    await page.getByRole('button', { name: 'Join Game' }).click();
    await page.getByPlaceholder('Enter your nickname').fill('Alice');
    await page.getByPlaceholder('e.g. ABC123').fill('ZZZZZ9');
    await page.getByRole('button', { name: 'Join Room' }).click();

    // Should show an error (stays on join screen, error toast appears)
    await expect(
      page.getByText(/not found|invalid|does not exist/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('four players can all join the same room', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    const p2 = await createPlayerPage('Bob');
    await joinRoom(p2, roomCode, 'Bob');

    const p3 = await createPlayerPage('Charlie');
    await joinRoom(p3, roomCode, 'Charlie');

    const p4 = await createPlayerPage('Diana');
    await joinRoom(p4, roomCode, 'Diana');

    // Player 1 should see all four players
    await expect(p1.getByText('Alice')).toBeVisible();
    await expect(p1.getByText('Bob')).toBeVisible();
    await expect(p1.getByText('Charlie')).toBeVisible();
    await expect(p1.getByText('Diana')).toBeVisible();
  });
});
