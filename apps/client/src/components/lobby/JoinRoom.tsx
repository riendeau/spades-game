import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface JoinRoomProps {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (roomId: string, nickname: string) => void;
  initialRoomId?: string;
}

export function JoinRoom({
  onCreateRoom,
  onJoinRoom,
  initialRoomId,
}: JoinRoomProps) {
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [mode, setMode] = useState<'create' | 'join'>(
    initialRoomId ? 'join' : 'create'
  );
  const autoJoinAttempted = useRef(false);

  // Auto-join feature: check for autoName query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoName = params.get('autoName');

    if (autoName && !autoJoinAttempted.current) {
      // Set the nickname from URL
      setNickname(autoName);

      // If we have a room ID (from URL) and a name, auto-join
      if (initialRoomId) {
        setMode('join');
        // Auto-submit after a short delay to ensure everything is ready
        autoJoinAttempted.current = true;
        setTimeout(() => {
          onJoinRoom(initialRoomId.toUpperCase(), autoName);
        }, 500);
      }
    }
  }, [initialRoomId, onJoinRoom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    if (mode === 'create') {
      onCreateRoom(nickname.trim());
    } else {
      if (!roomId.trim()) return;
      onJoinRoom(roomId.trim().toUpperCase(), nickname.trim());
    }
  };

  return (
    <div
      style={{
        maxWidth: '400px',
        margin: '0 auto',
        padding: '40px 20px',
      }}
    >
      <h1
        style={{
          fontSize: '32px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px',
          color: '#1f2937',
        }}
      >
        {'\u2660'} Spades
      </h1>
      <p
        style={{
          textAlign: 'center',
          color: '#6b7280',
          marginBottom: '32px',
        }}
      >
        Play with friends online
      </p>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        <Button
          variant={mode === 'create' ? 'primary' : 'secondary'}
          onClick={() => setMode('create')}
          style={{ flex: 1 }}
        >
          Create Game
        </Button>
        <Button
          variant={mode === 'join' ? 'primary' : 'secondary'}
          onClick={() => setMode('join')}
          style={{ flex: 1 }}
        >
          Join Game
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <Input
          label="Nickname"
          placeholder="Enter your nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
        />

        {mode === 'join' && (
          <Input
            label="Room Code"
            placeholder="e.g. ABC123"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
          />
        )}

        <Button
          type="submit"
          size="large"
          disabled={!nickname.trim() || (mode === 'join' && !roomId.trim())}
          style={{ marginTop: '8px' }}
        >
          {mode === 'create' ? 'Create Room' : 'Join Room'}
        </Button>
      </form>
    </div>
  );
}
