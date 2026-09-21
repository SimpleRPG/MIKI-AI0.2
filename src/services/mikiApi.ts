import { Character, WorldLocation } from '../types/rpg';
import { generateSmartCompanionReply } from '../utils/companionEngine';
import { PersonaConfig } from '../types';

export async function talkToMiki(
  message: string,
  character?: Character,
  worldLocation?: WorldLocation
): Promise<string> {
  const persona: PersonaConfig = {
    name: 'みき',
    userNickname: character?.name || '冒険者',
    basePersonality: '明るく親しみやすい冒険の相棒。元気にプレイヤーをサポートする',
    speakingStyle: 'タメ口',
  };

  const contextPrompt = worldLocation
    ? `[現在地: ${worldLocation.name} (${worldLocation.biome}) / 危険度: ${worldLocation.dangerLevel}]\nプレイヤー: ${message}`
    : message;

  return generateSmartCompanionReply(contextPrompt, persona, []);
}
