import { worldModelGraphService } from '../../selfAwareness/services/worldModelGraphService';
import { claimDatabaseService } from '../../memory/services/claimDatabaseService';
import { roleplaySessionService } from './roleplaySessionService';
import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';

/**
 * P525/P526/P528-P530: 段落合成（決定論）。
 *
 * 彼女の回答は「結論1文＋付属品」で終わりがちで、文章を段落として
 * 編む段が無かった。ここでは、彼女が既に検証済みで持っている材料
 * だけを使って、2文目・3文目を組み立てる。新しい事実は作らない。
 * 材料が無ければ段落は付かない。
 *
 * 材料の種類:
 *   RELATION (P525): 世界モデルの確定した関係を、関係タイプごとの
 *     言い換え型で文にする（仮の関係 provisional は使わない）。
 *   CLAIM (P525): 同じ主題の検証済み Claim の statement そのもの。
 *     findBestMatchingClaim の supportingClaims は主 Claim 自身しか
 *     返さないため、台帳から直接拾う。
 *   ANALOGY (P528): 類推の表現化。主題と同じ「関係の形」を持つ別の
 *     実体（彼女がよく知っているもの）を引き、似ていることを言葉に
 *     する。比喩は世界モデルの構造写像として作る。
 *   SCENE (P526/P530): なりチャの地の文。場面に合う描写を、彼女が
 *     学んだ Claim の描写文から優先して選び、無ければ場面の型から。
 *
 * P529: 候補を作って選ぶ。材料は候補として集め、「適合」と「新し
 * さ（最近使っていないか）」で採点して最大2文を選ぶ。使用した材
 * 料は台帳に残し、同じ材料が続けて出ないようにする。材料が彼女の
 * 中で育つほど、段落の顔ぶれは変わっていく。
 */

type MaterialType = 'RELATION' | 'CLAIM' | 'ANALOGY';

interface MaterialCandidate {
  type: MaterialType;
  key: string;
  text: string;
  fit: number;
}

interface UsageEntry {
  key: string;
  at: number;
}

const USAGE_KEY = 'miki_paragraph_material_usage_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

class ParagraphCompositionService {
  // ---- 使用台帳（新しさの物差し） ----

  private loadUsage(): UsageEntry[] {
    try {
      const raw = storageService.getItem(USAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as UsageEntry[]) : [];
      const cutoff = Date.now() - 14 * DAY_MS;
      return (Array.isArray(parsed) ? parsed : []).filter((e) => e && e.key && e.at >= cutoff).slice(-120);
    } catch {
      return [];
    }
  }

  private recordUsage(keys: string[]): void {
    try {
      const usage = this.loadUsage();
      const now = Date.now();
      for (const key of keys) usage.push({ key, at: now });
      storageService.setItem(USAGE_KEY, JSON.stringify(usage.slice(-120)));
    } catch { /* 台帳は補助 */ }
  }

  private noveltyScore(key: string, usage: UsageEntry[]): number {
    let last = 0;
    for (const e of usage) if (e.key === key && e.at > last) last = e.at;
    if (!last) return 1.5;
    const age = Date.now() - last;
    if (age < 60 * 60 * 1000) return -5;
    if (age < DAY_MS) return -3;
    return 1;
  }

  // ---- 段落の材料集めと選択 ----

  public buildSupplements(params: {
    subjectTerms: string[];
    supportingClaims: Array<{ claim_id: string; statement: string }>;
    excludeClaimId?: string;
    excludeText: string;
  }): string[] {
    const terms = [...new Set(params.subjectTerms)].filter((t) => t && t.length >= 2);
    const candidates: MaterialCandidate[] = [];
    const seenTexts: string[] = [params.excludeText];
    const addCandidate = (c: MaterialCandidate) => {
      if (!c.text) return;
      if (seenTexts.some((s) => s.includes(c.text.slice(0, 12)))) return;
      if (candidates.some((x) => x.text.includes(c.text.slice(0, 12)) || c.text.includes(x.text.slice(0, 12)))) return;
      seenTexts.push(c.text);
      candidates.push(c);
    };

    try {
      this.collectRelationAndAnalogy(terms, addCandidate);
    } catch {
      /* 世界モデルが読めなければ Claim の材料だけにする */
    }

    // CLAIM: 台帳から同じ主題の検証済み Claim を拾う
    if (terms.length > 0) {
      try {
        for (const claim of params.supportingClaims || []) {
          if (params.excludeClaimId && claim.claim_id === params.excludeClaimId) continue;
          const st = String(claim.statement || '').trim();
          if (st.length >= 8 && st.length <= 140 && terms.some((t) => st.includes(t))) {
            addCandidate({ type: 'CLAIM', key: `claim:${claim.claim_id}`, text: /[。．.]$/.test(st) ? st : `${st}。`, fit: 2 });
          }
        }
        for (const claim of claimDatabaseService.listClaims()) {
          if (params.excludeClaimId && claim.claim_id === params.excludeClaimId) continue;
          if (claim.status !== 'SUPPORTED' && claim.status !== 'DEVICE_VERIFIED') continue;
          const st = String(claim.statement || '').trim();
          if (st.length < 8 || st.length > 140) continue;
          if (!terms.some((t) => st.includes(t))) continue;
          addCandidate({ type: 'CLAIM', key: `claim:${claim.claim_id}`, text: /[。．.]$/.test(st) ? st : `${st}。`, fit: 2 });
        }
      } catch {
        /* 台帳が読めなければ他の材料だけにする */
      }
    }

    if (candidates.length === 0) return [];

    // P529: 適合＋新しさで採点し、種類の多様さを少し優遇して2文まで選ぶ
    const usage = this.loadUsage();
    const scored = candidates
      .map((c) => ({ c, score: c.fit + this.noveltyScore(c.key, usage) }))
      .sort((a, b) => b.score - a.score);
    const picked: MaterialCandidate[] = [];
    for (const { c, score } of scored) {
      if (picked.length >= 2) break;
      if (picked.length === 1 && picked[0].type === c.type) {
        const diverse = scored.find((x) => x.c.type !== c.type && !picked.includes(x.c) && x.score >= score - 1);
        if (diverse) {
          picked.push(diverse.c);
          continue;
        }
      }
      picked.push(c);
    }

    this.recordUsage(picked.map((c) => c.key));
    try {
      systemLogger.info('CHAT', `🧩 [段落合成] 候補 ${candidates.length} 件から ${picked.map((c) => c.type).join('+')} を選んで段落を編みました`);
    } catch { /* ログは補助 */ }
    return picked.map((c) => c.text);
  }

  private collectRelationAndAnalogy(
    terms: string[],
    addCandidate: (c: MaterialCandidate) => void,
  ): void {
    const entities = worldModelGraphService.entities();
    const relations = worldModelGraphService.relations().filter((r) => !r.provisional);
    // WorldRelation の from/to は実体の「名前」で保持されている。
    const matchedNames: string[] = [];
    for (const t of terms) {
      for (const e of entities) {
        if ((t === e.name || t.includes(e.name)) && !matchedNames.includes(e.name)) matchedNames.push(e.name);
      }
    }
    if (matchedNames.length === 0) return;

    const byConfidence = (a: { confidence?: number }, b: { confidence?: number }) => (b.confidence || 0) - (a.confidence || 0);
    for (const r of relations.filter((r) => matchedNames.includes(r.from) || matchedNames.includes(r.to)).sort(byConfidence)) {
      const sentence = this.verbalizeRelation(r.type, r.from, r.to);
      if (sentence) {
        addCandidate({ type: 'RELATION', key: `rel:${r.from}:${r.type}:${r.to}`, text: sentence, fit: 3 });
      }
    }

    // P528: 類推。主題の関係と同じ形を持つ、よく知っている別の実体を引く。
    const subject = matchedNames[0];
    const familiarity = new Map<string, number>();
    for (const r of relations) {
      familiarity.set(r.from, (familiarity.get(r.from) || 0) + 1);
      familiarity.set(r.to, (familiarity.get(r.to) || 0) + 1);
    }
    const subjectRelations = relations.filter((r) => r.from === subject && ['USED_FOR', 'CAUSES', 'ENABLES'].includes(r.type));
    const analogyTypesUsed = new Set<string>();
    for (const r of subjectRelations) {
      if (analogyTypesUsed.size >= 2) break;
      if (analogyTypesUsed.has(r.type)) continue;
      const parallels = relations
        .filter((x) => x.type === r.type && x.from !== subject && x.from !== r.to)
        .sort((a, b) => (familiarity.get(b.from) || 0) - (familiarity.get(a.from) || 0));
      const parallel = parallels[0];
      if (!parallel) continue;
      const text = this.verbalizeAnalogy(r.type, subject, r.to, parallel.from, parallel.to);
      if (text) {
        analogyTypesUsed.add(r.type);
        addCandidate({ type: 'ANALOGY', key: `ana:${subject}:${r.type}:${parallel.from}`, text, fit: 2.5 });
      }
    }
  }

  /**
   * P532: 話題についての質問を組み立てる。主題の世界モデルの関係
   * から「続きを聞く」質問を作る。関係が無ければ作らない（知らな
   * いことを知ったかぶりで聞かない）。
   */
  public buildTopicQuestion(subjectTerms: string[]): string | undefined {
    try {
      const terms = [...new Set(subjectTerms)].filter((t) => t && t.length >= 2);
      if (terms.length === 0) return undefined;
      const entities = worldModelGraphService.entities();
      const relations = worldModelGraphService.relations().filter((r) => !r.provisional);
      let subject: string | undefined;
      for (const t of terms) {
        const hit = entities.find((e) => t === e.name || t.includes(e.name));
        if (hit) { subject = hit.name; break; }
      }
      if (!subject) return undefined;
      const mine = relations
        .filter((r) => r.from === subject || r.to === subject)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      for (const r of mine) {
        const q = this.questionForRelation(r.type, subject, r.from === subject ? r.to : r.from, r.from === subject);
        if (q) return q;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private questionForRelation(type: string, subject: string, other: string, subjectIsFrom: boolean): string | undefined {
    switch (type) {
      case 'USED_FOR':
        return subjectIsFrom
          ? `${subject}は、${other}以外にも何かに使えますか？`
          : `${subject}に使われるものは、他にもありますか？`;
      case 'IS_A':
        return subjectIsFrom
          ? `${subject}のような${other}は、他にもいますか？`
          : `${other}の他に、${subject}にはどんなものがいますか？`;
      case 'CAUSES':
        return subjectIsFrom
          ? `${subject}が${other}を引き起こすのは、どんなときですか？`
          : `${subject}を引き起こすものは、他にもありますか？`;
      case 'ENABLES':
        return subjectIsFrom ? `${subject}があると、他にはどんなことができますか？` : undefined;
      case 'PART_OF':
        return subjectIsFrom ? `${other}には、${subject}の他に何がありますか？` : undefined;
      default:
        return undefined;
    }
  }

  private verbalizeRelation(type: string, from?: string, to?: string): string | undefined {
    if (!from || !to) return undefined;
    switch (type) {
      case 'IS_A': return `${from}は${to}の一種です。`;
      case 'PART_OF': return `${from}は${to}の一部です。`;
      case 'CAUSES': return `${from}は${to}を引き起こすことがあります。`;
      case 'ENABLES': return `${from}があると、${to}ができるようになります。`;
      case 'USED_FOR': return `${from}は${to}に使われます。`;
      default: return undefined;
    }
  }

  private verbalizeAnalogy(type: string, subject: string, subjectTo: string, other: string, otherTo: string): string | undefined {
    // 関係そのものの文と重ならないよう、対比の形で1文にまとめる。
    switch (type) {
      case 'USED_FOR':
        return `${subject}が${subjectTo}に使われるのは、${other}が${otherTo}に使われるのに似ています。`;
      case 'CAUSES':
        return `${subject}が${subjectTo}を引き起こすのは、${other}が${otherTo}を引き起こすのに似ています。`;
      case 'ENABLES':
        return `${subject}があると${subjectTo}ができるのは、${other}があると${otherTo}ができるのに似ています。`;
      default:
        return undefined;
    }
  }

  // ---- なりチャの地の文 ----

  /**
   * P526/P530: 場面の地の文（接尾辞として本文に足す1文）。
   * セッションが無ければ undefined。約3回に1回は間引く。
   * P530: 彼女が学んだ Claim の描写文（場面を含み、感覚の言葉を
   * 持つもの）を優先し、最近使ったものは避ける。無ければ型から。
   */
  public sceneTextureSuffix(seedText: string): string | undefined {
    const session = roleplaySessionService.getSession();
    if (!session) return undefined;
    const scene = String(session.scene || '').trim();
    if (!scene) return undefined;
    const seed = seedText.length + scene.length + (session.notedTerms?.length || 0);
    if (seed % 3 === 0) return undefined;

    // P530: 学んだ描写文から選ぶ
    try {
      const usage = this.loadUsage();
      const sensory = /景色|眺め|音|香|匂い|光|風|静か|ざわめき|輝|染ま|揺れ|温か|冷た|夕暮れ|朝日/;
      const learned = claimDatabaseService
        .listClaims()
        .filter((c) => (c.status === 'SUPPORTED' || c.status === 'DEVICE_VERIFIED'))
        .map((c) => ({ claim: c, st: String(c.statement || '').trim() }))
        .filter(({ st }) => st.length >= 8 && st.length <= 140 && st.includes(scene) && sensory.test(st))
        .map(({ claim, st }) => ({ key: `scene:${claim.claim_id}`, text: /[。．.]$/.test(st) ? st : `${st}。`, novelty: this.noveltyScore(`scene:${claim.claim_id}`, usage) }))
        .filter((x) => x.novelty > -3)
        .sort((a, b) => b.novelty - a.novelty);
      if (learned.length > 0) {
        this.recordUsage([learned[0].key]);
        return learned[0].text;
      }
    } catch {
      /* 学んだ描写が無ければ型から選ぶ */
    }

    const pools: Array<[RegExp, string[]]> = [
      [/教室|学校|授業/, ['黒板には、今日の予定が書かれています。', '窓の外からは、校庭のざわめきが聞こえてきます。']],
      [/海|浜|港|船/, ['波の音が、静かに繰り返し聞こえています。', '潮風が、頬を撫でていきます。']],
      [/森|林|山/, ['木漏れ日が、足元に揺れています。', '鳥の声が、遠くで聞こえています。']],
      [/街|町|店/, ['通りのざわめきが、少し遠くに聞こえています。']],
      [/城|宮殿/, ['石の廊下に、足音が低く響いています。']],
      [/部屋|家|自宅/, ['部屋の中は、静かな空気に満ちています。']],
    ];
    for (const [pattern, pool] of pools) {
      if (pattern.test(scene)) return pool[seed % pool.length];
    }
    const generic = [
      `${scene}の時間が、ゆっくりと流れています。`,
      `${scene}は、穏やかな空気に包まれています。`,
    ];
    return generic[seed % generic.length];
  }

  /**
   * P536: 場面の進行（接尾辞として本文に足す1文）。地の文が
   * 「空気」を足すのに対して、こちらは「出来事」で場面を一歩
   * 進める。歩数はセッションに数え、3ターンに1回だけ進める
   * （進む回は地の文の代わりになる）。場面プールは出来事の型、
   * 歩数で順に回す。
   */
  public sceneProgressionSuffix(): string | undefined {
    const session = roleplaySessionService.getSession();
    if (!session) return undefined;
    const scene = String(session.scene || '').trim();
    if (!scene) return undefined;
    const beat = roleplaySessionService.advanceSceneBeat();
    if (beat % 3 !== 0) return undefined;
    const stepIndex = Math.floor(beat / 3) - 1;
    const pools: Array<[RegExp, string[]]> = [
      [/教室|学校|授業/, ['チャイムが鳴って、休み時間になりました。', '窓の外で、運動場の声が大きくなってきました。']],
      [/海|浜|港|船/, ['波の音が、少しずつ強くなってきました。', '遠くの海で、船の汽笛が聞こえました。']],
      [/森|林|山/, ['木の間を、風が通り抜けていきました。', 'どこかで、小鳥が鳴き始めました。']],
      [/街|町|店/, ['通りの向こうで、店の明かりが灯り始めました。', '人通りが、少しずつ増えてきました。']],
      [/城|宮殿/, ['遠くで、鐘が鳴りました。', '廊下を、衛兵の足音が過ぎていきました。']],
      [/部屋|家|自宅/, ['窓の外が、少し暗くなってきました。', '時計の針が、カチリと進みました。']],
    ];
    for (const [pattern, pool] of pools) {
      if (pattern.test(scene)) return ` ${pool[stepIndex % pool.length]}`;
    }
    return ` ${scene}の時間が、少し進みました。`;
  }
}

export const paragraphCompositionService = new ParagraphCompositionService();
