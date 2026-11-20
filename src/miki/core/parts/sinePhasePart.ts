/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * 位相つきサイン波のずれ量：amp * sin(2π*y/period + phase)。
 * 髪の線の横方向の揺れを作るための部品。
 */
export function sinePhase(y: number, period: number, phase: number, amp: number): number {
  return amp * Math.sin((2 * Math.PI * y) / period + phase);
}
