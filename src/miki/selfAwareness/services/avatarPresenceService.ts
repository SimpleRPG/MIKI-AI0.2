import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { motionPatternService } from './motionPatternService';

/**
 * P942: アバターの存在状態（第1段）。
 *
 * アバター設計メモ（2026-11-17）の「動きは主体性の出口」を受けて、
 * 彼女たちが画面の中でどう在るかを決める状態を、頭脳側の事実から
 * 組み立てる。部屋の描画そのものはアプリ側の仕事で、ここはその
 * 描画が読む「いま何をしているか」の台帳。
 *
 * 状態は3つ。起きている（AWAKE）／自分から話題を持って寄ってくる
 * （APPROACHING、欲求からの行動選択 P925 が駆動）／寝ている
 * （SLEEPING、眠って整理する時間 P931 の間）。覚えた動き（P941 の
 * 動作部品）は、名前で指定して身に着けられる。寝てから8時間
 * 経ったら、 snapshot では起きたこととして読む（朝の目覚め）。
 *
 * 会話の開始・終了への配線は第2段（会話のたびの保存は重いので、
 * 状態が変わるときだけ書く形にしてから入れる）。
 */

const STORAGE_KEY = 'miki_avatar_presence_v1';
const WAKE_AFTER_MS = 8 * 60 * 60 * 1000;

export type AvatarMode = 'AWAKE' | 'APPROACHING' | 'SLEEPING';

export interface AvatarPresence {
  personaId: string;
  mode: AvatarMode;
  topic?: string;
  motionName?: string;
  motionUntil?: number;
  since: number;
}

class AvatarPresenceService {
  private loadAll(): Record<string, AvatarPresence> {
    try {
      const parsed = JSON.parse(storageService.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  private save(all: Record<string, AvatarPresence>): void {
    try {
      storageService.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* 保存できなくても状態の読みは続ける */ }
  }

  private setState(presence: AvatarPresence): AvatarPresence {
    const all = this.loadAll();
    all[presence.personaId] = presence;
    this.save(all);
    return presence;
  }

  /** 眠って整理する時間に入った（P931 の統合から呼ばれる）。 */
  public noteSleep(personaId: string, now = Date.now()): AvatarPresence {
    const presence = this.setState({ personaId, mode: 'SLEEPING', since: now });
    systemLogger.info('SYSTEM', `🌙 [アバター] ${personaId} は寝た`);
    return presence;
  }

  /** 欲求から選んだ行動（P925）が、寄ってくる動きになる。 */
  public noteIdleChoice(personaId: string, action: { kind: string; term: string }, now = Date.now()): AvatarPresence {
    if (action.kind === 'BRING_UP_TOPIC' || action.kind === 'BRING_UP_SPECIAL_DAY') {
      return this.setState({ personaId, mode: 'APPROACHING', topic: action.term, since: now });
    }
    return this.setState({ personaId, mode: 'AWAKE', since: now });
  }

  /** 起きた状態に戻す。 */
  public noteAwake(personaId: string, now = Date.now()): AvatarPresence {
    return this.setState({ personaId, mode: 'AWAKE', since: now });
  }

  /**
   * 覚えた動きを身に着ける。動作部品に無い動きは着けられない。
   * 着けている間は period の数周期ぶんだけ続く。
   */
  public setMotion(personaId: string, motionName: string, now = Date.now()): boolean {
    const pattern = motionPatternService.list().find((p) => p.name === motionName);
    if (!pattern) return false;
    const current = this.snapshot(personaId, now);
    const duration = Math.min(15000, Math.max(2000, (pattern.periodMs || 750) * 4));
    this.setState({
      personaId,
      mode: current.mode === 'SLEEPING' ? 'AWAKE' : current.mode,
      topic: current.topic,
      motionName,
      motionUntil: now + duration,
      since: current.since,
    });
    return true;
  }

  /** いまの存在状態を読む。期限切れの動きと、朝の目覚めはここで解釈する。 */
  public snapshot(personaId: string, now = Date.now()): AvatarPresence {
    const stored = this.loadAll()[personaId];
    if (!stored) return { personaId, mode: 'AWAKE', since: now };
    const result: AvatarPresence = { ...stored };
    if (result.motionUntil && now > result.motionUntil) {
      delete result.motionName;
      delete result.motionUntil;
    }
    if (result.mode === 'SLEEPING' && now - result.since >= WAKE_AFTER_MS) {
      result.mode = 'AWAKE';
    }
    return result;
  }

  /** 状態を言葉にする（部屋の表示や会話の受け口）。 */
  public describe(personaId: string, now = Date.now()): string {
    const name = personaId === 'bibi' ? 'ビービー' : 'みき';
    const s = this.snapshot(personaId, now);
    let base: string;
    if (s.mode === 'SLEEPING') base = `${name}は今、寝ているよ。`;
    else if (s.mode === 'APPROACHING' && s.topic) base = `${name}は「${s.topic}」の話をしたくて、寄ってきているよ。`;
    else base = `${name}は起きて、そばにいるよ。`;
    if (s.motionName) base += `動きは「${s.motionName}」をしている。`;
    return base;
  }

  public summary(): { personas: number } {
    return { personas: Object.keys(this.loadAll()).length };
  }
}

export const avatarPresenceService = new AvatarPresenceService();
