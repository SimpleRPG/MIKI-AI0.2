import { Character, WorldLocation, StoryEntry, Monster, Quest } from '../types/rpg';

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

export async function requestNarration(
  action: string,
  character: Character,
  worldState: WorldLocation,
  recentHistory: StoryEntry[],
  rollResult?: { dice: number; mod: number; total: number }
): Promise<NarrateResponse> {
  const res = await fetch('/api/miki/narrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      character,
      worldState,
      recentHistory,
      rollResult
    })
  });

  if (!res.ok) {
    throw new Error('Failed to communicate with MIKI AI');
  }

  const json = await res.json();
  return json.data;
}

export async function generateAIQuest(
  character: Character,
  setting: string,
  difficulty: string
): Promise<Quest> {
  const res = await fetch('/api/miki/quest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ character, setting, difficulty })
  });

  if (!res.ok) {
    throw new Error('Failed to generate quest from MIKI');
  }

  const json = await res.json();
  return json.quest;
}

export async function resolveCombatTurn(
  playerMove: string,
  character: Character,
  monster: Monster,
  rollResult?: { dice: number; mod: number; total: number }
): Promise<CombatResponse> {
  const res = await fetch('/api/miki/combat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerMove, character, monster, rollResult })
  });

  if (!res.ok) {
    throw new Error('Failed to resolve combat round');
  }

  const json = await res.json();
  return json.data;
}

export async function talkToMiki(
  message: string,
  character: Character,
  worldState: WorldLocation
): Promise<string> {
  const res = await fetch('/api/miki/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, character, worldState })
  });

  if (!res.ok) {
    throw new Error('MIKI is resting right now');
  }

  const json = await res.json();
  return json.reply;
}
