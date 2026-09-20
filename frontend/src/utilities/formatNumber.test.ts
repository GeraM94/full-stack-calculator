import { describe, expect, it } from "vitest";
import { formatNumber } from "./formatNumber";

describe("formatNumber", () => {
  const testCases: { name: string; value: number; want: string }[] = [
    { name: "an integer", value: 13, want: "13" },
    { name: "zero", value: 0, want: "0" },
    { name: "a negative integer", value: -10, want: "-10" },
    { name: "a short decimal keeps its digits and gains no zeros", value: 2.5, want: "2.5" },
    { name: "a negative decimal", value: -0.5, want: "-0.5" },
    { name: "floating-point noise is dropped", value: 0.1 + 0.2, want: "0.3" },
    { name: "a repeating decimal is cut at ten places", value: 10 / 3, want: "3.3333333333" },
    { name: "a value below ten decimal places keeps its magnitude", value: 1e-12, want: "1e-12" },
    { name: "a very large integer", value: 1e21, want: "1e+21" },
  ];

  it.each(testCases)("$name", ({ value, want }) => {
    expect(formatNumber(value)).toBe(want);
  });
});
