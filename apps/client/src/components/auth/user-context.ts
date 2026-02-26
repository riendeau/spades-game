import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  pictureUrl: string | null;
}

export const UserContext = createContext<AuthUser | null>(null);

export function useUser(): AuthUser | null {
  return useContext(UserContext);
}
