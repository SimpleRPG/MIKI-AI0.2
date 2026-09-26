import { AnswerContentIR } from '../../../types';
import { canonicalSha256 } from '../../core/services/canonicalSha256Service';

export type AnswerSectionKind =
  | 'OPENING'
  | 'DIRECT_ANSWER'
  | 'FACTS'
  | 'REASONING'
  | 'CONDITIONS'
  | 'EXCEPTIONS'
  | 'UNKNOWN'
  | 'NEXT_ACTION'
  | 'CLOSING';

export interface AnswerCompositionSection {
  kind: AnswerSectionKind;
  required: boolean;
  sourceFields: Array<keyof AnswerContentIR>;
  reason: string;
}

export interface AutonomousAnswerCompositionPlan {
  schemaVersion: 1;
  planId: string;
  irId: string;
  sections: AnswerCompositionSection[];
  omittedSections: Array<{ kind: AnswerSectionKind; reason: string }>;
  epistemicClass: AnswerContentIR['certainty'];
  worldScope: AnswerContentIR['world_scope'];
  planSha256: string;
}

function hasText(values: string[]): boolean {
  return values.some(value => value.trim().length > 0);
}

export class AutonomousAnswerCompositionPlanService {
  public create(ir: AnswerContentIR): AutonomousAnswerCompositionPlan {
    const sections: AnswerCompositionSection[] = [];
    const omittedSections: Array<{ kind: AnswerSectionKind; reason: string }> = [];

    if (ir.interaction_mode === 'SAFETY_GATE') {
      sections.push({ kind: 'OPENING', required: true, sourceFields: ['interaction_mode'], reason: '安全境界を先に明示するため' });
    } else {
      omittedSections.push({ kind: 'OPENING', reason: '通常回答では固定の前置きを置かないため' });
    }

    sections.push({ kind: 'DIRECT_ANSWER', required: true, sourceFields: ['conclusion', 'target'], reason: '結論を最初に返すため' });

    if (hasText(ir.reasons)) {
      sections.push({ kind: ir.detail_level === 'BRIEF' ? 'FACTS' : 'REASONING', required: false, sourceFields: ['reasons'], reason: '結論の根拠が存在するため' });
    } else {
      omittedSections.push({ kind: 'REASONING', reason: '根拠要素がIRに存在しないため' });
    }

    if (hasText(ir.conditions)) {
      sections.push({ kind: 'CONDITIONS', required: true, sourceFields: ['conditions'], reason: '適用条件の欠落を防ぐため' });
    } else {
      omittedSections.push({ kind: 'CONDITIONS', reason: '条件要素がIRに存在しないため' });
    }

    if (hasText(ir.exceptions)) {
      sections.push({ kind: 'EXCEPTIONS', required: true, sourceFields: ['exceptions'], reason: '例外と否定条件を保持するため' });
    } else {
      omittedSections.push({ kind: 'EXCEPTIONS', reason: '例外要素がIRに存在しないため' });
    }

    if (ir.certainty === 'UNKNOWN' || ir.certainty === 'HYPOTHETICAL') {
      sections.push({ kind: 'UNKNOWN', required: true, sourceFields: ['certainty'], reason: '不確実性を表面文でも保持するため' });
    } else {
      omittedSections.push({ kind: 'UNKNOWN', reason: '未知または仮説の回答ではないため' });
    }

    if (hasText(ir.next_actions)) {
      sections.push({ kind: 'NEXT_ACTION', required: false, sourceFields: ['next_actions'], reason: '実行可能な次工程が存在するため' });
    } else {
      omittedSections.push({ kind: 'NEXT_ACTION', reason: '次工程がIRに存在しないため' });
    }

    if (ir.interaction_mode === 'NORMAL' && ir.detail_level !== 'BRIEF') {
      sections.push({ kind: 'CLOSING', required: false, sourceFields: ['interaction_mode', 'detail_level'], reason: '回答を自然に閉じるため' });
    } else {
      omittedSections.push({ kind: 'CLOSING', reason: '短答または成果物回答では固定終端を避けるため' });
    }

    const material = {
      schemaVersion: 1 as const,
      irId: ir.ir_id,
      sections,
      omittedSections,
      epistemicClass: ir.certainty,
      worldScope: ir.world_scope,
    };
    const planSha256 = canonicalSha256(material);
    return { ...material, planId: `ACP-${planSha256.slice(0, 20)}`, planSha256 };
  }
}

export const autonomousAnswerCompositionPlanService = new AutonomousAnswerCompositionPlanService();
