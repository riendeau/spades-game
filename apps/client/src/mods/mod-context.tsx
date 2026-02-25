import React, { createContext, useContext, useState } from 'react';

interface ModInfo {
  id: string;
  name: string;
  type: 'rule' | 'theme';
  description: string;
}

interface ModContextType {
  availableMods: ModInfo[];
  activeMods: string[];
  setAvailableMods: (mods: ModInfo[]) => void;
  toggleMod: (modId: string) => void;
  isModActive: (modId: string) => boolean;
}

const ModContext = createContext<ModContextType>({
  availableMods: [],
  activeMods: [],
  setAvailableMods: () => {},
  toggleMod: () => {},
  isModActive: () => false,
});

export function ModProvider({ children }: { children: React.ReactNode }) {
  const [availableMods, setAvailableMods] = useState<ModInfo[]>([]);
  const [activeMods, setActiveMods] = useState<string[]>([]);

  const toggleMod = (modId: string) => {
    setActiveMods((prev) =>
      prev.includes(modId)
        ? prev.filter((id) => id !== modId)
        : [...prev, modId]
    );
  };

  const isModActive = (modId: string) => activeMods.includes(modId);

  return (
    <ModContext.Provider
      value={{
        availableMods,
        activeMods,
        setAvailableMods,
        toggleMod,
        isModActive,
      }}
    >
      {children}
    </ModContext.Provider>
  );
}

export function useMods() {
  return useContext(ModContext);
}
