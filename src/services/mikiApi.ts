import { Character, WorldLocation, StoryEntry, Monster, Quest } from '../types/rpg';
import { simpleRpgRuleEngineService } from './simpleRpgRuleEngineService';
import { unifiedMikiExperienceService } from './unifiedMikiExperienceService';

export interface NarrateResponse {
  narration: string;
  mikiComment?: string;
  suggestedActions: string[];
  hpDelta?: number;
  mpDelta?: number;
  goldDelta?: number;
  xpDelta?: number;
  triggerCombat?: boolean;
  monster?: Monster | null;
}

export interface CombatResponse {
  narrative: string;
  playerDamage: number;
  monsterDamage: number;
  isCritical: boolean;
  mikiComment?: string;
}

/**
 * 冒険ナレーションの生成（作業指示書 v21: (A) 純粋なロジックとしてクライアント内で直接呼び出し）
 */
export async function requestNarration(
  action: string,
  character: Character,
  worldState: WorldLocation,
  recentHistory?: StoryEntry[],
  rollResult?: { dice: number; mod: number; total: number }
): Promise<NarrateResponse> {
  const deterministicSeed = rollResult?.total ?? Date.now();
  const data = simpleRpgRuleEngineService.narrate(action, character, worldState, deterministicSeed);
  unifiedMikiExperienceService.observeRpg({
    action: 'narrate',
    input: String(action || ''),
    outcome: 'SUCCESS',
    verified: true,
    capabilityIds: ['simple_rpg.combat'],
    lesson: 'narration outcome joined unified experience',
  });
  return data;
}

/**
 * クエスト生成（作業指示書 v21: (A) 純粋なロジックとしてクライアント内で直接呼び出し）
 */
export async function generateAIQuest(
  character: Character,
  setting: string,
  difficulty: string
): Promise<Quest> {
  const quest = simpleRpgRuleEngineService.quest(setting, difficulty, character);
  unifiedMikiExperienceService.observeRpg({
    action: 'quest',
    input: `${setting || ''}|${difficulty || ''}`,
    outcome: 'SUCCESS',
    verified: true,
    capabilityIds: ['simple_rpg.guild'],
    lesson: 'quest planning joined unified experience',
  });
  return quest;
}

/**
 * 戦闘ターン解決（作業指示書 v21: (A) 純粋なロジックとしてクライアント内で直接呼び出し）
 */
export async function resolveCombatTurn(
  playerMove: string,
  character: Character,
  monster: Monster,
  rollResult?: { dice: number; mod: number; total: number }
): Promise<CombatResponse> {
  const deterministicSeed = Number(rollResult?.total || 0);
  const data = simpleRpgRuleEngineService.combat(playerMove, character, monster, deterministicSeed);
  unifiedMikiExperienceService.observeRpg({
    action: 'combat',
    input: `${playerMove || ''}|${monster?.name || ''}`,
    outcome: data.playerDamage > 0 ? 'SUCCESS' : 'FAILURE',
    verified: true,
    capabilityIds: ['simple_rpg.combat', 'simple_rpg.equipment'],
    lesson: data.isCritical ? 'critical hit combat observed directly' : 'combat mechanics observed directly',
  });
  return data;
}

/**
 * Mikiとの会話（作業指示書 v21: (A) 純粋なロジックとしてクライアント内で直接呼び出し）
 */
export async function talkToMiki(
  message: string,
  character: Character,
  worldState: WorldLocation
): Promise<string> {
  const reply = simpleRpgRuleEngineService.chat(message, character, worldState);
  unifiedMikiExperienceService.observeRpg({
    action: 'chat',
    input: String(message || ''),
    outcome: 'SUCCESS',
    verified: true,
    capabilityIds: ['simple_rpg.combat', 'simple_rpg.equipment'],
    lesson: 'rpg-chat is part of the unified experience',
  });
  return reply;
}
