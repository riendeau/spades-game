import React, { useEffect, useState } from 'react';
import type { AuthUser } from './user-context.js';
import { UserContext } from './user-context.js';

interface LoginGateProps {
  children: React.ReactNode;
}

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' };

export function LoginGate({ children }: LoginGateProps) {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    fetch('/auth/me')
      .then((res) => {
        if (res.ok) return res.json() as Promise<AuthUser>;
        if (res.status === 401) return null;
        throw new Error(`Unexpected status ${res.status}`);
      })
      .then((user) => {
        if (user) {
          setAuthState({ status: 'authenticated', user });
        } else {
          setAuthState({ status: 'unauthenticated' });
        }
      })
      .catch(() => {
        setAuthState({ status: 'unauthenticated' });
      });
  }, []);

  if (authState.status === 'loading') {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>
            Loading...
          </div>
          <div style={{ color: '#6b7280' }}>Please wait</div>
        </div>
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    const params = new URLSearchParams(window.location.search);
    const notAllowed = params.get('error') === 'not_allowed';

    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '40px 48px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            maxWidth: '360px',
            width: '100%',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>♠</div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              margin: '0 0 8px',
              color: '#111827',
            }}
          >
            Spades
          </h1>
          <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '14px' }}>
            Sign in to play with friends
          </p>

          {notAllowed && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '20px',
                padding: '10px 14px',
              }}
            >
              Your account is not on the guest list.
            </div>
          )}

          <a
            href="/auth/google"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              color: '#374151',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
              padding: '10px 20px',
              textDecoration: 'none',
              transition: 'background-color 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={authState.user}>
      {children}
    </UserContext.Provider>
  );
}
