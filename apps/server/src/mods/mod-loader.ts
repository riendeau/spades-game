import {
  suicideSpadesMod,
  jokerSpadesMod,
  classicTheme,
  neonTheme,
  minimalistTheme,
} from '@spades/mods';
import { modRegistry } from './mod-registry.js';

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
