import React, { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../../hooks/use-is-mobile';
import { LOBBY_MOTTO, LOBBY_TITLE } from '../../lobby-branding';
import { AdUnit } from '../ads/AdUnit';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface JoinRoomProps {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (roomId: string, nickname: string) => void;
  initialRoomId?: string;
  initialNickname?: string;
}

export function JoinRoom({
  onCreateRoom,
  onJoinRoom,
  initialRoomId,
  initialNickname,
}: JoinRoomProps) {
  const [nickname, setNickname] = useState(initialNickname ?? '');
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [mode, setMode] = useState<'create' | 'join'>(
    initialRoomId ? 'join' : 'create'
  );
  const autoJoinAttempted = useRef(false);
  const isMobile = useIsMobile();

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
        maxWidth: '420px',
        margin: '0 auto',
        padding: isMobile ? '24px 16px' : '48px 20px',
      }}
    >
      <h1
        style={{
          fontSize: '38px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '4px',
          color: '#ffffff',
          letterSpacing: '0.03em',
          textShadow:
            '0 0 20px rgba(255,255,255,0.25), 0 0 40px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        {LOBBY_TITLE}
      </h1>

      <p
        style={{
          textAlign: 'center',
          fontStyle: 'italic',
          fontSize: '14px',
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.65)',
          marginBottom: '28px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          textShadow: '0 1px 6px rgba(0,0,0,0.3)',
        }}
      >
        {LOBBY_MOTTO}
      </p>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: isMobile ? '24px 20px' : '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
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

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <a
          href="/stats"
          style={{
            display: 'inline-block',
            color: 'rgba(255,255,255,0.75)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            padding: '8px 20px',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '20px',
            letterSpacing: '0.03em',
            transition: 'all 0.15s ease',
          }}
        >
          Your Stats
        </a>
      </div>

      <AdUnit
        slot="5367664982"
        format="auto"
        fullWidthResponsive
        style={{ marginTop: '24px' }}
      />
    </div>
  );
}
