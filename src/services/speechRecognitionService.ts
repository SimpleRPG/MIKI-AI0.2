import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SpeechRecognitionStatus {
  available: boolean;
  mode: 'USER_TRIGGERED' | string;
  continuousListening: boolean;
  language: string;
}

export interface SpeechRecognitionResult {
  recognized: boolean;
  text: string;
  alternatives: string[];
  language: string;
  source: string;
  /** Recognition output is an observation, never truth by itself. */
  verified: false;
}

interface NativeSpeechRecognitionPlugin {
  status(): Promise<SpeechRecognitionStatus>;
  start(options?: { language?: string; maxResults?: number; prompt?: string }): Promise<SpeechRecognitionResult>;
}

const NativeSpeech = registerPlugin<NativeSpeechRecognitionPlugin>('MIKISpeechRecognition');

class SpeechRecognitionService {
  async status(): Promise<SpeechRecognitionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { available: 'SpeechRecognition' in window, mode: 'WEB_FALLBACK', continuousListening: false, language: 'ja-JP' };
    }
    try { return await NativeSpeech.status(); }
    catch { return { available: false, mode: 'UNAVAILABLE', continuousListening: false, language: 'ja-JP' }; }
  }

  async start(options: { language?: string; maxResults?: number; prompt?: string } = {}): Promise<SpeechRecognitionResult | undefined> {
    if (!Capacitor.isNativePlatform()) return this.startWebFallback(options);
    try { return await NativeSpeech.start(options); }
    catch { return undefined; }
  }

  private startWebFallback(options: { language?: string; maxResults?: number; prompt?: string }): Promise<SpeechRecognitionResult | undefined> {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const recognition = new Recognition();
      recognition.lang = options.language || 'ja-JP';
      recognition.maxAlternatives = options.maxResults || 3;
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event: any) => {
        const alternatives: string[] = [];
        const list = event.results?.[0];
        for (let i = 0; i < (list?.length || 0); i++) alternatives.push(String(list[i].transcript || ''));
        resolve({ recognized: alternatives.length > 0, text: alternatives[0] || '', alternatives, language: recognition.lang, source: 'WEB_SPEECH', verified: false });
      };
      recognition.onerror = () => resolve(undefined);
      recognition.onend = () => {};
      try { recognition.start(); } catch { resolve(undefined); }
    });
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
