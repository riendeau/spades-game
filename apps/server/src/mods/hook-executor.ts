import type {
  RuleMod,
  ScoreContext,
  CalculateDisabledBidsContext,
  PlayValidationContext,
  CardPlayedContext,
  TrickCompleteContext,
  RoundEndContext,
  RoundEndResult,
  GameConfig,
} from '@spades/shared';

export class HookExecutor {
  private mods: RuleMod[] = [];

  setMods(mods: RuleMod[]): void {
    this.mods = mods;
  }

  addMod(mod: RuleMod): void {
    this.mods.push(mod);
  }

  clearMods(): void {
    this.mods = [];
  }

  executeCalculateScore(context: ScoreContext): ScoreContext {
    let result = context;
    for (const mod of this.mods) {
      if (mod.hooks.onCalculateScore) {
        result = mod.hooks.onCalculateScore(result);
      }
    }
    return result;
  }

  executeCalculateDisabledBids(
    context: CalculateDisabledBidsContext
  ): CalculateDisabledBidsContext {
    let result = context;
    for (const mod of this.mods) {
      if (mod.hooks.onCalculateDisabledBids) {
        result = mod.hooks.onCalculateDisabledBids(result);
      }
    }
    return result;
  }

  executeValidatePlay(context: PlayValidationContext): PlayValidationContext {
    let result = context;
    for (const mod of this.mods) {
      if (mod.hooks.onValidatePlay) {
        result = mod.hooks.onValidatePlay(result);
        // Stop if validation fails
        if (!result.isValid) break;
      }
    }
    return result;
  }

  executeCardPlayed(context: CardPlayedContext): CardPlayedContext {
    let result = context;
    for (const mod of this.mods) {
      if (mod.hooks.onCardPlayed) {
        result = mod.hooks.onCardPlayed(result);
      }
    }
    return result;
  }

  executeTrickComplete(context: TrickCompleteContext): TrickCompleteContext {
    let result = context;
    for (const mod of this.mods) {
      if (mod.hooks.onTrickComplete) {
        result = mod.hooks.onTrickComplete(result);
      }
    }
    return result;
  }

  executeRoundEnd(context: RoundEndContext, modId: string): RoundEndResult {
    const mod = this.mods.find((m) => m.id === modId);
    if (mod?.hooks.onRoundEnd) {
      return mod.hooks.onRoundEnd(context);
    }
    return {};
  }

  getAllModIds(): string[] {
    return this.mods.map((m) => m.id);
  }

  modifyConfig(config: GameConfig): GameConfig {
    let result = config;
    for (const mod of this.mods) {
      if (mod.hooks.modifyConfig) {
        result = mod.hooks.modifyConfig(result);
      }
    }
    return result;
  }
}

export const hookExecutor = new HookExecutor();
