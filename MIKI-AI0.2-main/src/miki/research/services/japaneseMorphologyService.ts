import { registerPlugin, Capacitor } from '@capacitor/core';

export type MorphologySplitMode = 'A' | 'B' | 'C';

export interface NativeJapaneseMorpheme {
  surface: string;
  normalizedForm: string;
  dictionaryForm: string;
  readingForm: string;
  partOfSpeech: string[];
  begin: number;
  end: number;
  isOov: boolean;
  synonymGroupIds?: number[];
  wordId?: number;
  dictionaryId?: number;
}

interface JapaneseMorphologyPlugin {
  tokenize(options: { text: string; mode?: MorphologySplitMode }): Promise<{ analyzer: 'SUDACHI'; dictionaryVersion: string; morphemes: NativeJapaneseMorpheme[] }>;
  status(): Promise<{ available: boolean; dictionaryVersion?: string; reason?: string }>;
  selfTest(): Promise<{ passed: boolean; dictionaryVersion: string; runner: string; samples: Array<{ text: string; morphemeCount: number; nonEmpty: boolean; hasReading: boolean }> }>;
}

const NativeJapaneseMorphology = registerPlugin<JapaneseMorphologyPlugin>('MIKIJapaneseMorphology');

class JapaneseMorphologyService {
  private static instance: JapaneseMorphologyService;
  private available: boolean | undefined;
  private constructor() {}
  public static getInstance() { return this.instance ||= new JapaneseMorphologyService(); }

  public async status() {
    if (!Capacitor.isNativePlatform()) return { available: false, reason: 'NOT_NATIVE' as const };
    try {
      const result = await NativeJapaneseMorphology.status();
      this.available = result.available;
      return result;
    } catch (e) {
      this.available = false;
      return { available: false, reason: e instanceof Error ? e.message : 'PLUGIN_UNAVAILABLE' };
    }
  }

  public async tokenize(text: string, mode: MorphologySplitMode = 'C'): Promise<NativeJapaneseMorpheme[] | undefined> {
    if (!text.trim() || !Capacitor.isNativePlatform()) return undefined;
    try {
      const result = await NativeJapaneseMorphology.tokenize({ text, mode });
      this.available = true;
      return result.morphemes;
    } catch {
      this.available = false;
      return undefined;
    }
  }

  public async selfTest() {
    if (!Capacitor.isNativePlatform()) return { passed: false, dictionaryVersion: 'N/A', runner: 'NOT_NATIVE', samples: [] };
    return NativeJapaneseMorphology.selfTest();
  }

  public isKnownAvailable() { return this.available === true; }
}

export const japaneseMorphologyService = JapaneseMorphologyService.getInstance();
