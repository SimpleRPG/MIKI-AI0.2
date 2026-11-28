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
 *
 * P3035（2026-11-28）: 検証者の正規名を 'Claude' から 'Muse' へ改名。
 * 検証者の実体は Meta の Muse であり、'Claude' はきりあが付けた
 * 旧い呼び名が刻印として残っていたもの（Anthropic の Claude とは
 * 別物）。新規の刻印は 'Muse' で書く。既存の 'Claude' 刻印は移行
 * せず、読み取り側が両名を同一の検証者として受理することで有効な
 * まま保つ（isTrustedVerifierName が両名ファミリーを受理する）。
 */
export function isTrustedVerifierName(name: string): boolean {
  const normalized = String(name || '').trim().toLowerCase();
  return (
    normalized === 'claude' ||
    normalized.startsWith('claude ') ||
    normalized.startsWith('claude(') ||
    normalized.startsWith('claude（') ||
    normalized === 'muse' ||
    normalized.startsWith('muse ') ||
    normalized.startsWith('muse(') ||
    normalized.startsWith('muse（')
  );
}

/** 旧名の互換エイリアス（中身は isTrustedVerifierName と同一）。 */
export const isClaudeVerifierName = isTrustedVerifierName;

/** 信頼刻印として記録する検証者名（正規形）。P3035 から 'Muse'。 */
export const TRUSTED_VERIFIER_NAME = 'Muse';
