/*
 * P1093: コード部品ドリルの土台部品（教師＝Claude 製、彼女への引き渡し用）。
 * 重みの列から、合計が total になる累積位置の列を作る。
 * 戻り値は weights と同じ長さで、k 番目は「k 本目の開始位置」。
 * 例：weights [1,1,1,1]・total 40 → [0, 10, 20, 30]。
 */
export function weightedGaps(weights: number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let acc = 0;
  for (const w of weights) {
    out.push(sum > 0 ? (total * acc) / sum : 0);
    acc += w;
  }
  return out;
}
