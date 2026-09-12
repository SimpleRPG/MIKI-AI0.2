/** 設計思想 第31章 31.8: コード読解クイズ自動生成 */
import { CodeUnderstandingIR } from '../types';
export interface CodeComprehensionQuiz { id: string; question: string; expectedAnswer: string; criteria: string; source: 'STATIC_IR'; difficulty: 'EASY'|'NORMAL'|'HARD'; }
class CodeComprehensionQuizService {
  public generate(ir: CodeUnderstandingIR, limit = 10): CodeComprehensionQuiz[] {
    const out: CodeComprehensionQuiz[] = [];
    for (const qa of ir.comprehensionQA.slice(0, limit)) out.push({ id: `quiz_${ir.id}_${out.length}`, question: qa.question, expectedAnswer: qa.answer, criteria: qa.criteria, source: 'STATIC_IR', difficulty: 'NORMAL' });
    if (out.length < limit) for (const proc of ir.procedures) {
      if (out.length >= limit) break;
      out.push({ id: `quiz_${ir.id}_${out.length}`, question: `${proc.procedureName}が書き込む対象は何ですか？`, expectedAnswer: proc.writes.join(', ') || '書き込みなし', criteria: 'IRのwritesと一致すること', source: 'STATIC_IR', difficulty: 'EASY' });
    }
    return out;
  }
}
export const codeComprehensionQuizService = new CodeComprehensionQuizService();
