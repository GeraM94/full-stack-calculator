import type { Operation } from "../api/types";
import type { Action } from "../hooks/useCalculator";
import { commandText, messages, operationText } from "../messages";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

interface KeyDefinition {
  label: string;
  ariaLabel: string;
  action: Action;
  variant: ButtonVariant;
  className?: string;
}

function digitKey(digit: string, className?: string): KeyDefinition {
  return { label: digit, ariaLabel: digit, action: { type: "DIGIT", digit }, variant: "digit", className };
}

function operationKey(operation: Operation, variant: ButtonVariant = "operator"): KeyDefinition {
  const { label, ariaLabel } = operationText[operation];
  return { label, ariaLabel, action: { type: "OPERATION", operation }, variant };
}

/** Row by row, four columns. "=" spans two rows and "0" two columns, so the
 *  last two rows hold three keys each. */
const KEYS: readonly KeyDefinition[] = [
  { ...commandText.clear, action: { type: "CLEAR" }, variant: "function" },
  { ...commandText.toggleSign, action: { type: "TOGGLE_SIGN" }, variant: "function" },
  { ...commandText.delete, action: { type: "DELETE" }, variant: "function" },
  operationKey("divide"),

  operationKey("squareRoot", "function"),
  operationKey("power", "function"),
  operationKey("percentage", "function"),
  operationKey("multiply"),

  digitKey("7"),
  digitKey("8"),
  digitKey("9"),
  operationKey("subtract"),

  digitKey("4"),
  digitKey("5"),
  digitKey("6"),
  operationKey("add"),

  digitKey("1"),
  digitKey("2"),
  digitKey("3"),
  { ...commandText.evaluate, action: { type: "EVALUATE" }, variant: "equals", className: "tall" },

  digitKey("0", "wide"),
  { ...commandText.decimalPoint, action: { type: "DIGIT", digit: "." }, variant: "digit" },
];

interface KeypadProps {
  activeOperation: Operation | null;
  /** True while a request is in flight. Clear stays enabled: it cancels. */
  disabled: boolean;
  onAction: (action: Action) => void;
}

export function Keypad({ activeOperation, disabled, onAction }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label={messages.keypadLabel}>
      {KEYS.map((key) => (
        <Button
          key={key.ariaLabel}
          label={key.label}
          ariaLabel={key.ariaLabel}
          variant={key.variant}
          className={key.className}
          disabled={disabled && key.action.type !== "CLEAR"}
          pressed={
            key.action.type === "OPERATION" ? key.action.operation === activeOperation : undefined
          }
          onClick={() => onAction(key.action)}
        />
      ))}
    </div>
  );
}
