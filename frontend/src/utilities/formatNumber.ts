/** Formats a result for the display. 10 / 3 arrives as 3.3333333333333335;
 *  ten decimals drop the floating-point noise without padding with zeros, so
 *  2.5 stays "2.5". */
export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);

  const rounded = Number(value.toFixed(10));
  // A value too small for ten decimals would show as 0; keep its magnitude.
  if (rounded === 0) return String(Number(value.toPrecision(10)));
  return String(rounded);
}
