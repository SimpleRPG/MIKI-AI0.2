import { Character, Monster, Quest, WorldLocation } from '../types/rpg';
import { apiUrl } from './api';

async function post(path: string, body: unknown) {
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'RPG operation failed');
  return json;
}

export const deterministicMikiChat = async (message: string, character: Character, worldState: WorldLocation) => (await post('/api/miki/chat', { message, character, worldState })).reply as string;
export const deterministicNarrate = async (action: string, character: Character, worldState: WorldLocation, seed = 0) => (await post('/api/miki/narrate', { action, character, worldState, seed })).data;
export const deterministicQuest = async (character: Character, setting: string, difficulty: string, seed = 0) => (await post('/api/miki/quest', { character, setting, difficulty, seed })).quest as Quest;
export const deterministicCombat = async (playerMove: string, character: Character, monster: Monster, seed = 0) => (await post('/api/miki/combat', { playerMove, character, monster, seed })).data;
export const deterministicRpgAction = async (body: Record<string, unknown>) => post('/api/miki/rpg/action', body);
