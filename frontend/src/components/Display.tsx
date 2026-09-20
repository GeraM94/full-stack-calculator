import type { Status } from "../hooks/useCalculator";
import { messages } from "../messages";

interface DisplayProps {
  /** Upper line: the left operand and the pending operation, or empty. */
  expression: string;
  value: string;
  status: Status;
  errorMessage: string | null;
}

export function Display({ expression, value, status, errorMessage }: DisplayProps) {
  return (
    <>
      <section className="display" aria-label={messages.displayLabel}>
        <div className="expression">{expression}</div>
        {/* <output> is a live region (implicit role "status"): a screen reader
            announces each new result without any extra markup. */}
        <output className="result">{value}</output>
      </section>

      {status === "error" ? (
        <p className="message has-error" role="alert">
          {errorMessage}
        </p>
      ) : (
        <p className="message">{status === "loading" ? messages.loading : ""}</p>
      )}
    </>
  );
}
