import type { RuleMod, ThemeMod, Mod } from '@spades/shared';

class ModRegistry {
  private ruleMods: Map<string, RuleMod> = new Map();
  private themeMods: Map<string, ThemeMod> = new Map();

  registerRuleMod(mod: RuleMod): void {
    this.ruleMods.set(mod.id, mod);
    console.log(`Registered rule mod: ${mod.name}`);
  }

  registerThemeMod(mod: ThemeMod): void {
    this.themeMods.set(mod.id, mod);
    console.log(`Registered theme mod: ${mod.name}`);
  }

  getRuleMod(id: string): RuleMod | undefined {
    return this.ruleMods.get(id);
  }

  getThemeMod(id: string): ThemeMod | undefined {
    return this.themeMods.get(id);
  }

  getAllRuleMods(): RuleMod[] {
    return Array.from(this.ruleMods.values());
  }

  getAllThemeMods(): ThemeMod[] {
    return Array.from(this.themeMods.values());
  }

  getAllMods(): Mod[] {
    return [...this.getAllRuleMods(), ...this.getAllThemeMods()];
  }

  getModList(): Array<{ id: string; name: string; type: 'rule' | 'theme'; description: string }> {
    return this.getAllMods().map(mod => ({
      id: mod.id,
      name: mod.name,
      type: mod.type,
      description: mod.description
    }));
  }
}

export const modRegistry = new ModRegistry();
