import { modRegistry } from './mod-registry.js';
import { suicideSpadesMod, jokerSpadesMod } from '@spades/mods';
import { classicTheme, neonTheme, minimalistTheme } from '@spades/mods';

export function loadBuiltInMods(): void {
  // Load rule mods
  modRegistry.registerRuleMod(suicideSpadesMod);
  modRegistry.registerRuleMod(jokerSpadesMod);

  // Load theme mods
  modRegistry.registerThemeMod(classicTheme);
  modRegistry.registerThemeMod(neonTheme);
  modRegistry.registerThemeMod(minimalistTheme);

  console.log(`Loaded ${modRegistry.getAllMods().length} built-in mods`);
}
