import { storageService } from './storageService';

export interface CoreCycleSettings {
  conversationMaxCycles:number;
  selfImprovementMaxCycles:number;
}

const KEY='miki.core.cycle.settings.v1';
const DEFAULTS:CoreCycleSettings={conversationMaxCycles:3,selfImprovementMaxCycles:64};
const HARD_MAX=100;

const clamp=(value:number,fallback:number)=>Math.max(1,Math.min(HARD_MAX,Number.isFinite(value)?Math.floor(value):fallback));

class CoreCycleSettingsService {
  get():CoreCycleSettings {
    try {
      const raw=storageService.getItem(KEY);
      if(!raw)return {...DEFAULTS};
      const parsed=JSON.parse(raw) as Partial<CoreCycleSettings>;
      return {
        conversationMaxCycles:clamp(Number(parsed.conversationMaxCycles),DEFAULTS.conversationMaxCycles),
        selfImprovementMaxCycles:clamp(Number(parsed.selfImprovementMaxCycles),DEFAULTS.selfImprovementMaxCycles),
      };
    } catch { return {...DEFAULTS}; }
  }
  save(input:Partial<CoreCycleSettings>):CoreCycleSettings {
    const current=this.get();
    const next={
      conversationMaxCycles:clamp(Number(input.conversationMaxCycles),current.conversationMaxCycles),
      selfImprovementMaxCycles:clamp(Number(input.selfImprovementMaxCycles),current.selfImprovementMaxCycles),
    };
    storageService.setItem(KEY,JSON.stringify(next));
    return next;
  }
  maxCyclesFor(kind:'USER_REQUEST'|'SELF_IMPROVEMENT'|'EXECUTION_EVENT'|'VERIFICATION_EVENT'|'SYSTEM_TASK'):number {
    const s=this.get();
    return kind==='SELF_IMPROVEMENT'?s.selfImprovementMaxCycles:kind==='USER_REQUEST'?s.conversationMaxCycles:DEFAULTS.conversationMaxCycles;
  }
  hardMax(){return HARD_MAX;}
}
export const coreCycleSettingsService=new CoreCycleSettingsService();
