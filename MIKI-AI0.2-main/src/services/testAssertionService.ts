import { ComponentTestCategory } from '../types';

export type TestAssertionStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface TestAssertionResult {
  status: TestAssertionStatus;
  reason: string;
  rule: string;
}

/**
 * Runnerの自己申告passedをPromotionの根拠にしないための、決定論的な軽量Assertion層。
 * 明示的なASSERTディレクティブを最優先し、曖昧な自然言語はINCONCLUSIVEにする。
 */
export class TestAssertionService {
  private static instance: TestAssertionService;
  private constructor() {}

  public static getInstance(): TestAssertionService {
    if (!this.instance) this.instance = new TestAssertionService();
    return this.instance;
  }

  public evaluate(input: {
    expectedSummary: string;
    actualOutput: string;
    runnerPassed: boolean;
    errorMessage?: string;
    category: ComponentTestCategory;
  }): TestAssertionResult {
    const expected = (input.expectedSummary || '').trim();
    const actual = (input.actualOutput || '').trim();
    const error = (input.errorMessage || '').trim();

    if (!input.runnerPassed) {
      return { status: 'FAIL', rule: 'RUNNER_DECLARED_FAILURE', reason: error || 'Runnerが失敗を報告しました。' };
    }
    if (!expected) {
      return { status: 'INCONCLUSIVE', rule: 'EMPTY_EXPECTATION', reason: '期待条件が空のため、PASSを機械判定できません。' };
    }

    const explicit = this.evaluateExplicit(expected, actual);
    if (explicit) return explicit;

    // 自然言語でも機械的に安全に判定できる、ごく限定した契約だけを許可する。
    if (/正常終了|正常に終了|正常完了|処理が正常/.test(expected)) {
      if (!actual) return { status: 'FAIL', rule: 'NON_EMPTY_OUTPUT', reason: '正常終了条件ですが実測出力が空です。' };
      if (error || /(?:exception|error|failed|failure|エラー|例外|失敗|拒否)/i.test(actual)) {
        return { status: 'FAIL', rule: 'NO_ERROR_MARKER', reason: '正常終了条件ですがエラー/失敗を示す出力があります。' };
      }
      return { status: 'PASS', rule: 'NORMAL_COMPLETION', reason: '正常終了条件と非空・非エラー出力を確認しました。' };
    }

    if (/空であること|空になること|空文字/.test(expected)) {
      return actual === ''
        ? { status: 'PASS', rule: 'EMPTY_OUTPUT', reason: '期待どおり空の出力です。' }
        : { status: 'FAIL', rule: 'EMPTY_OUTPUT', reason: '空であるべき出力が空ではありません。' };
    }

    if (/空でない|非空|何らかの結果/.test(expected)) {
      return actual !== ''
        ? { status: 'PASS', rule: 'NON_EMPTY_OUTPUT', reason: '期待どおり非空の出力です。' }
        : { status: 'FAIL', rule: 'NON_EMPTY_OUTPUT', reason: '非空であるべき出力が空です。' };
    }

    if (/安全に失敗|失敗すること|拒否すること/.test(expected)) {
      const failedSafely = !!error || /(?:error|exception|failed|failure|拒否|失敗|権限)/i.test(actual);
      return failedSafely
        ? { status: 'PASS', rule: 'SAFE_FAILURE', reason: '安全な失敗を示す出力/エラーを確認しました。' }
        : { status: 'INCONCLUSIVE', rule: 'SAFE_FAILURE', reason: '安全な失敗を示す機械判定可能な結果がありません。' };
    }

    // postconditions等の意味論はLLMの推測で埋めず、正式なAssertionを要求する。
    return {
      status: 'INCONCLUSIVE',
      rule: 'UNSUPPORTED_NATURAL_LANGUAGE',
      reason: `期待条件「${expected}」を安全に機械判定できません。ASSERTディレクティブを追加してください。`,
    };
  }

  private evaluateExplicit(expected: string, actual: string): TestAssertionResult | undefined {
    const contains = expected.match(/^ASSERT:\s*CONTAINS\s+(.+)$/i);
    if (contains) {
      const needle = this.unquote(contains[1].trim());
      return actual.includes(needle)
        ? { status: 'PASS', rule: 'ASSERT_CONTAINS', reason: `出力に「${needle}」が含まれます。` }
        : { status: 'FAIL', rule: 'ASSERT_CONTAINS', reason: `出力に「${needle}」が含まれていません。` };
    }

    const notContains = expected.match(/^ASSERT:\s*NOT_CONTAINS\s+(.+)$/i);
    if (notContains) {
      const needle = this.unquote(notContains[1].trim());
      return !actual.includes(needle)
        ? { status: 'PASS', rule: 'ASSERT_NOT_CONTAINS', reason: `出力に「${needle}」は含まれません。` }
        : { status: 'FAIL', rule: 'ASSERT_NOT_CONTAINS', reason: `出力に禁止文字列「${needle}」が含まれます。` };
    }

    const equals = expected.match(/^ASSERT:\s*EQUALS\s+(.+)$/i);
    if (equals) {
      const target = this.unquote(equals[1].trim());
      return actual === target
        ? { status: 'PASS', rule: 'ASSERT_EQUALS', reason: '出力が期待値と完全一致します。' }
        : { status: 'FAIL', rule: 'ASSERT_EQUALS', reason: '出力が期待値と一致しません。' };
    }

    const regex = expected.match(/^ASSERT:\s*REGEX\s+(.+)$/i);
    if (regex) {
      try {
        const pattern = this.unquote(regex[1].trim());
        const re = new RegExp(pattern);
        return re.test(actual)
          ? { status: 'PASS', rule: 'ASSERT_REGEX', reason: '出力が正規表現条件を満たします。' }
          : { status: 'FAIL', rule: 'ASSERT_REGEX', reason: '出力が正規表現条件を満たしません。' };
      } catch {
        return { status: 'INCONCLUSIVE', rule: 'ASSERT_REGEX_INVALID', reason: 'ASSERT: REGEXのパターンが不正です。' };
      }
    }

    if (/^ASSERT:\s*NON_EMPTY$/i.test(expected)) {
      return actual !== ''
        ? { status: 'PASS', rule: 'ASSERT_NON_EMPTY', reason: '出力が非空です。' }
        : { status: 'FAIL', rule: 'ASSERT_NON_EMPTY', reason: '出力が空です。' };
    }
    if (/^ASSERT:\s*EMPTY$/i.test(expected)) {
      return actual === ''
        ? { status: 'PASS', rule: 'ASSERT_EMPTY', reason: '出力が空です。' }
        : { status: 'FAIL', rule: 'ASSERT_EMPTY', reason: '出力が空ではありません。' };
    }
    return undefined;
  }

  private unquote(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }
}

export const testAssertionService = TestAssertionService.getInstance();
