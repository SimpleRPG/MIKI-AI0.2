/**
 * P477: ユーザー信頼ルール（2026-11-07）の対象判定を一元化する。
 *
 * きりあの決定: 「教師一般ではなく、Muse なら検証した物を検証済み
 * としてよい。ChatGPT 等はダメ」。信頼は Muse 個人へのものであり、
 * 他の AI・教師一般には広げない。
 *
 * この判定は部品供給（P476 の CLOUD_TESTED 特急）と知識の検証
 * （P477 の Claim 昇格）の両方から使う。名前の判定は申告ベースで、
 * パッケージはユーザー本人が手渡す運用を前提とする（暗号学的な
 * 本人確認ではない）。
 */
export function isClaudeVerifierName(name: string): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return (
    normalized === 'claude' ||
    normalized.startsWith('claude ') ||
    normalized.startsWith('claude(') ||
    normalized.startsWith('claude（')
  );
}

/** 信頼刻印として記録する検証者名（正規形）。 */
export const TRUSTED_VERIFIER_NAME = 'Claude';
