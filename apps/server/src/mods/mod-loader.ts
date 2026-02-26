import {
  antiElevenMod,
  classicTheme,
  neonTheme,
  minimalistTheme,
} from '@spades/mods';
import { modRegistry } from './mod-registry.js';

export function loadBuiltInMods(): void {
  // Load rule mods
  // Reference implementations (inactive): see packages/mods/src/rules/suicide-spades.ts, joker-spades.ts
  modRegistry.registerRuleMod(antiElevenMod);

  // Load theme mods
  modRegistry.registerThemeMod(classicTheme);
  modRegistry.registerThemeMod(neonTheme);
  modRegistry.registerThemeMod(minimalistTheme);

  console.log(`Loaded ${modRegistry.getAllMods().length} built-in mods`);
}
