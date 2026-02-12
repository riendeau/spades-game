import { test, expect } from '../fixtures/game-fixtures';
import { createRoom, joinRoom } from '../helpers/room-helpers';

test.describe('Error Handling', () => {
  test('empty nickname disables submit button', async ({ createPlayerPage }) => {
    const page = await createPlayerPage('_unused');

    // Clear the nickname field (should be empty by default)
    const nicknameInput = page.getByPlaceholder('Enter your nickname');
    await nicknameInput.clear();

    await expect(page.getByRole('button', { name: 'Create Room' })).toBeDisabled();
  });

  test('empty room code disables join button', async ({ createPlayerPage }) => {
    const page = await createPlayerPage('_unused');

    await page.getByRole('button', { name: 'Join Game' }).click();
    await page.getByPlaceholder('Enter your nickname').fill('Alice');

    // Room code field should be empty
    await expect(page.getByRole('button', { name: 'Join Room' })).toBeDisabled();
  });

  test('fifth player cannot join a full room', async ({ createPlayerPage }) => {
    const p1 = await createPlayerPage('P1');
    const roomCode = await createRoom(p1, 'P1');

    const p2 = await createPlayerPage('P2');
    await joinRoom(p2, roomCode, 'P2');

    const p3 = await createPlayerPage('P3');
    await joinRoom(p3, roomCode, 'P3');

    const p4 = await createPlayerPage('P4');
    await joinRoom(p4, roomCode, 'P4');

    // Fifth player tries to join
    const p5 = await createPlayerPage('P5');
    await p5.getByRole('button', { name: 'Join Game' }).click();
    await p5.getByPlaceholder('Enter your nickname').fill('P5');
    await p5.getByPlaceholder('e.g. ABC123').fill(roomCode);
    await p5.getByRole('button', { name: 'Join Room' }).click();

    // Should show an error
    await expect(p5.getByText(/full|no.*room|cannot join/i)).toBeVisible({ timeout: 5_000 });
  });
});
