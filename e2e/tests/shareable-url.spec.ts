import { test, expect } from '../fixtures/game-fixtures';
import { createRoom } from '../helpers/room-helpers';

test.describe('Shareable URL', () => {
  test('waiting room displays shareable URL after room creation', async ({
    createPlayerPage,
  }) => {
    const page = await createPlayerPage('Alice');
    const roomCode = await createRoom(page, 'Alice');

    // Should show "Share Link:" text
    await expect(page.getByText('Share Link:')).toBeVisible();

    // Should show the URL with the room code in it
    const urlElement = page
      .locator('code')
      .filter({ hasText: `/room/${roomCode}` });
    await expect(urlElement).toBeVisible();

    // Should include the origin (http://localhost:5173)
    const urlText = await urlElement.textContent();
    expect(urlText).toContain('http://localhost:5173');
    expect(urlText).toContain(`/room/${roomCode}`);
  });

  test('clicking shareable URL copies it to clipboard', async ({
    createPlayerPage,
  }) => {
    const page = await createPlayerPage('Alice');
    const roomCode = await createRoom(page, 'Alice');

    // Grant clipboard permissions
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click on the URL container (not just the code element)
    const urlContainer = page
      .locator('code')
      .filter({ hasText: `/room/${roomCode}` })
      .locator('..');
    await urlContainer.click();

    // Verify clipboard content
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toContain(`/room/${roomCode}`);
    expect(clipboardText).toContain('http://localhost:5173');
  });

  test('navigating to shareable URL pre-fills room code', async ({
    createPlayerPage,
    browser,
  }) => {
    // Player 1 creates a room
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // Player 2 navigates directly to the shareable URL
    const context2 = await browser.newContext();
    const p2 = await context2.newPage();
    await p2.goto(`/room/${roomCode}`);

    // Should be on the join screen (Join Game tab is pre-selected when a room code is in the URL)
    await expect(p2.getByRole('button', { name: 'Join Game' })).toBeVisible();

    // The room code field should be visible and pre-filled
    const roomCodeInput = p2.getByPlaceholder('e.g. ABC123');
    await expect(roomCodeInput).toBeVisible();
    await expect(roomCodeInput).toHaveValue(roomCode);

    await context2.close();
  });

  test('joining room via pre-filled shareable URL works', async ({
    createPlayerPage,
    browser,
  }) => {
    // Player 1 creates a room
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // Player 2 navigates to shareable URL and joins
    const context2 = await browser.newContext();
    const p2 = await context2.newPage();
    await p2.goto(`/room/${roomCode}`);

    // Fill in nickname (room code is already pre-filled)
    await p2.getByPlaceholder('Enter your nickname').fill('Bob');
    await p2.getByRole('button', { name: 'Join Room' }).click();

    // Should join the waiting room
    await expect(p2.getByText('Waiting Room')).toBeVisible();

    // Both players should see each other
    await expect(p1.getByText('Bob')).toBeVisible();
    await expect(p2.getByText('Alice')).toBeVisible();

    await context2.close();
  });

  test('shareable URL with invalid room code shows error', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to a shareable URL with invalid room code
    await page.goto('/room/INVALID');

    // Room code should be pre-filled
    await expect(page.getByPlaceholder('e.g. ABC123')).toHaveValue('INVALID');

    // Try to join
    await page.getByPlaceholder('Enter your nickname').fill('Alice');
    await page.getByRole('button', { name: 'Join Room' }).click();

    // Should show error
    await expect(
      page.getByText(/not found|invalid|does not exist/i)
    ).toBeVisible({ timeout: 5_000 });

    await context.close();
  });

  test('shareable URL is case-insensitive', async ({
    createPlayerPage,
    browser,
  }) => {
    // Player 1 creates a room
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // Player 2 navigates to lowercase version of URL
    const context2 = await browser.newContext();
    const p2 = await context2.newPage();
    await p2.goto(`/room/${roomCode.toLowerCase()}`);

    // Room code should be pre-filled and uppercased
    const roomCodeInput = p2.getByPlaceholder('e.g. ABC123');
    await expect(roomCodeInput).toHaveValue(roomCode);

    // Should be able to join
    await p2.getByPlaceholder('Enter your nickname').fill('Bob');
    await p2.getByRole('button', { name: 'Join Room' }).click();

    await expect(p2.getByText('Waiting Room')).toBeVisible();
    await expect(p1.getByText('Bob')).toBeVisible();

    await context2.close();
  });
});
