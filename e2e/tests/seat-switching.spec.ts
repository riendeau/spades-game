import { test, expect } from '../fixtures/game-fixtures';
import { createRoom, joinRoom } from '../helpers/room-helpers';

// Seat positions: 0=South, 1=West, 2=North, 3=East

test.describe('Seat switching', () => {
  test('"Sit here" buttons appear on empty seats but not on own seat', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    // With 1 player at South (0), the other 3 seats should have "Sit here"
    await expect(p1.getByRole('button', { name: 'Sit here' })).toHaveCount(3);

    // Own seat (South) must not have a "Sit here" button
    await expect(
      p1.getByTestId('seat-0').getByRole('button', { name: 'Sit here' })
    ).not.toBeVisible();

    // Each of the other three seats should have one
    await expect(
      p1.getByTestId('seat-1').getByRole('button', { name: 'Sit here' })
    ).toBeVisible();
    await expect(
      p1.getByTestId('seat-2').getByRole('button', { name: 'Sit here' })
    ).toBeVisible();
    await expect(
      p1.getByTestId('seat-3').getByRole('button', { name: 'Sit here' })
    ).toBeVisible();
  });

  test('clicking "Sit here" moves the player to that seat', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    await createRoom(p1, 'Alice');

    // Alice starts at South (0)
    await expect(p1.getByTestId('seat-0')).toContainText('Alice');

    // Move to North (2)
    await p1
      .getByTestId('seat-2')
      .getByRole('button', { name: 'Sit here' })
      .click();

    // Alice is now at North
    await expect(p1.getByTestId('seat-2')).toContainText('Alice');

    // South is now vacated — should show a "Sit here" button again
    await expect(
      p1.getByTestId('seat-0').getByRole('button', { name: 'Sit here' })
    ).toBeVisible();

    // North (own seat) must not have a "Sit here" button any more
    await expect(
      p1.getByTestId('seat-2').getByRole('button', { name: 'Sit here' })
    ).not.toBeVisible();

    // Still 3 empty seats → 3 "Sit here" buttons
    await expect(p1.getByRole('button', { name: 'Sit here' })).toHaveCount(3);
  });

  test('"Sit here" button count decreases as more players join', async ({
    createPlayerPage,
  }) => {
    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // 1 player: 3 empty seats
    await expect(p1.getByRole('button', { name: 'Sit here' })).toHaveCount(3);

    // Bob joins
    const p2 = await createPlayerPage('Bob');
    await joinRoom(p2, roomCode, 'Bob');

    // Both players now see 2 "Sit here" buttons
    await expect(p1.getByRole('button', { name: 'Sit here' })).toHaveCount(2);
    await expect(p2.getByRole('button', { name: 'Sit here' })).toHaveCount(2);

    // Charlie joins
    const p3 = await createPlayerPage('Charlie');
    await joinRoom(p3, roomCode, 'Charlie');

    // 1 seat left
    await expect(p1.getByRole('button', { name: 'Sit here' })).toHaveCount(1);
  });

  test('no "Sit here" buttons when all seats are occupied', async ({
    fourPlayerRoom,
  }) => {
    const { players } = fourPlayerRoom;

    for (const page of players) {
      await expect(page.getByRole('button', { name: 'Sit here' })).toHaveCount(
        0
      );
    }
  });

  test('second player is placed in the first available seat, not in the seat the first player moved away from', async ({
    createPlayerPage,
  }) => {
    // This test guards against the position-collision bug where handlePlayerJoin
    // used state.players.length as the next position, causing a collision when
    // the existing player had switched away from their initial seat.

    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // Alice starts at South (0), then moves to West (1)
    await p1
      .getByTestId('seat-1')
      .getByRole('button', { name: 'Sit here' })
      .click();
    await expect(p1.getByTestId('seat-1')).toContainText('Alice');

    // Bob joins — should be assigned to South (0), the first free seat, NOT West (1)
    const p2 = await createPlayerPage('Bob');
    await joinRoom(p2, roomCode, 'Bob');

    // Verify from Bob's perspective
    await expect(p2.getByTestId('seat-0')).toContainText('Bob');
    await expect(p2.getByTestId('seat-1')).toContainText('Alice');

    // Verify from Alice's perspective (state update received via socket)
    await expect(p1.getByTestId('seat-0')).toContainText('Bob');
    await expect(p1.getByTestId('seat-1')).toContainText('Alice');

    // Neither seat contains the wrong player
    await expect(p2.getByTestId('seat-0')).not.toContainText('Alice');
    await expect(p2.getByTestId('seat-1')).not.toContainText('Bob');
  });

  test('the moved-away seat is visible to the incoming player as occupied by the joiner', async ({
    createPlayerPage,
  }) => {
    // Regression: before the fix, the joining player would collide into the
    // seat the switcher moved to. Confirm both players see a clean layout
    // with distinct seats and no duplication.

    const p1 = await createPlayerPage('Alice');
    const roomCode = await createRoom(p1, 'Alice');

    // Alice moves from South (0) to East (3)
    await p1
      .getByTestId('seat-3')
      .getByRole('button', { name: 'Sit here' })
      .click();
    await expect(p1.getByTestId('seat-3')).toContainText('Alice');

    const p2 = await createPlayerPage('Bob');
    await joinRoom(p2, roomCode, 'Bob');

    // Bob should land on South (0) — the first free seat
    await expect(p2.getByTestId('seat-0')).toContainText('Bob');

    // East (3) belongs to Alice, not Bob
    await expect(p2.getByTestId('seat-3')).toContainText('Alice');
    await expect(p2.getByTestId('seat-3')).not.toContainText('Bob');

    // South (0) belongs to Bob, not Alice
    await expect(p2.getByTestId('seat-0')).not.toContainText('Alice');
  });
});
