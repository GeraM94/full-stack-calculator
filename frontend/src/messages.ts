// Every string a person can see or hear, in one place.

import type { ErrorCode, Operation } from "./api/types";

interface OperationText {
  /** What the key shows. */
  label: string;
  /** What the expression line shows between the operands. */
  symbol: string;
  /** What a screen reader says. */
  ariaLabel: string;
}

export const operationText: Record<Operation, OperationText> = {
  add: { label: "+", symbol: "+", ariaLabel: "Add" },
  subtract: { label: "−", symbol: "−", ariaLabel: "Subtract" },
  multiply: { label: "×", symbol: "×", ariaLabel: "Multiply" },
  divide: { label: "÷", symbol: "÷", ariaLabel: "Divide" },
  power: { label: "xʸ", symbol: "^", ariaLabel: "Power" },
  squareRoot: { label: "√", symbol: "√", ariaLabel: "Square root" },
  percentage: { label: "%", symbol: "%", ariaLabel: "Percentage" },
};

export const commandText = {
  clear: { label: "C", ariaLabel: "Clear" },
  toggleSign: { label: "±", ariaLabel: "Toggle sign" },
  delete: { label: "⌫", ariaLabel: "Delete last digit" },
  evaluate: { label: "=", ariaLabel: "Equals" },
  decimalPoint: { label: ".", ariaLabel: "Decimal point" },
} as const;

/** Codes without an entry fall back to the message the server sent. Those
 *  codes mean the client built a bad request, which is a bug, not something
 *  to explain to the person using the calculator. */
export const errorText: Partial<Record<ErrorCode, string>> = {
  DIVISION_BY_ZERO: "Cannot divide by zero",
  NEGATIVE_SQUARE_ROOT: "Cannot take the square root of a negative number",
  NON_FINITE_RESULT: "The result is not a finite number",
  INTERNAL_ERROR: "The server had a problem. Try again.",
  NETWORK_ERROR: "Cannot reach the server",
  INVALID_RESPONSE: "Unexpected response from the server",
};

export const messages = {
  backendBadge: "Go",
  frontendBadge: "React + TypeScript",
  displayLabel: "Display",
  keypadLabel: "Keypad",
  loading: "Calculating…",
  unknownError: "Something went wrong",
  footer: "Every calculation runs on the Go backend",
} as const;
