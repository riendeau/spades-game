import type { Page } from '@playwright/test';

/**
 * Creates a new room and returns the room code.
 */
export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.getByPlaceholder('Enter your nickname').fill(nickname);
  await page.getByRole('button', { name: 'Create Room' }).click();
  await page.getByText('Waiting Room').waitFor();
  // Select the room code specifically (the first code element with click-to-copy title)
  const code = await page.locator('code[title="Click to copy"]').first().textContent();
  if (!code) throw new Error('Room code not found');
  return code;
}

/**
 * Joins an existing room by code.
 */
export async function joinRoom(page: Page, roomCode: string, nickname: string): Promise<void> {
  await page.getByRole('button', { name: 'Join Game' }).click();
  await page.getByPlaceholder('Enter your nickname').fill(nickname);
  await page.getByPlaceholder('e.g. ABC123').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await page.getByText('Waiting Room').waitFor();
}
