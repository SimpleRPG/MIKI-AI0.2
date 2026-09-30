export interface SemanticRequirementContract {
  goal:string;
  actions:string[];
  entities:string[];
  constraints:string[];
  acceptanceCriteria:string[];
  nonGoals:string[];
  ambiguities:string[];
  language:'ja'|'en'|'mixed';
  confidence:number;
}
class SemanticRequirementCompilerService {
  private readonly cache=new Map<string,SemanticRequirementContract>();
  compile(requirements:string[]):SemanticRequirementContract {
    const normalized=[...new Set(requirements.map(value=>value.trim()).filter(Boolean))];
    const key=normalized.join('\u0000');
    const cached=this.cache.get(key);
    if(cached)return cached;
    const text=normalized.join('。');
    const hasJapanese=/[ぁ-んァ-ヶ一-龠]/.test(text);
    const hasEnglish=/[A-Za-z]/.test(text);
    const constraints=normalized.filter(value=>/必須|禁止|してはならない|維持|互換|上限|以下|以上|must|never|preserve|limit/i.test(value));
    const acceptanceCriteria=normalized.filter(value=>/確認|検証|合格|成功|完了|動作|accept|verify|pass|works/i.test(value));
    const nonGoals=normalized.filter(value=>/不要|対象外|しない|除外|not required|out of scope/i.test(value));
    const ambiguities=normalized.filter(value=>/など|適切|必要に応じ|可能なら|etc|appropriate|as needed/i.test(value));
    const actions=[...new Set(text.match(/(?:実装|修正|追加|削除|移行|最適化|検証|生成|解析|検索|保存|復元|implement|fix|add|remove|migrate|optimize|verify|generate|analyze)/gi)||[])];
    const entities=[...new Set(text.match(/[A-Za-z_][A-Za-z0-9_.-]{2,}|[一-龠ァ-ヶ]{2,}/g)||[])].slice(0,80);
    const contract:SemanticRequirementContract={
      goal:normalized[0]||'REQUEST_GOAL_UNSPECIFIED',actions,entities,constraints,acceptanceCriteria,nonGoals,ambiguities,
      language:hasJapanese&&hasEnglish?'mixed':hasJapanese?'ja':'en',
      confidence:Math.max(0.45,Math.min(0.99,0.55+Math.min(normalized.length,8)*0.04+(constraints.length?0.08:0)+(acceptanceCriteria.length?0.08:0)-(ambiguities.length?0.05:0)))
    };
    this.cache.set(key,contract);
    if(this.cache.size>200){const first=this.cache.keys().next().value;if(first)this.cache.delete(first);}
    return contract;
  }
}
export const semanticRequirementCompilerService=new SemanticRequirementCompilerService();
