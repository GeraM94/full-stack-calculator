import { useEffect } from "react";
import type { CalculatorClient } from "./api/client";
import { Display } from "./components/Display";
import { Keypad } from "./components/Keypad";
import { actionForKey, useCalculator } from "./hooks/useCalculator";
import { messages } from "./messages";

interface AppProps {
  /** Injected so tests, and any future transport, can swap it. */
  client: CalculatorClient;
}

export default function App({ client }: AppProps) {
  const { display, expression, activeOperation, status, errorMessage, dispatch } =
    useCalculator(client);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Leave browser shortcuts such as Ctrl+R and Ctrl+- alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const action = actionForKey(event.key);
      if (action === null) return;
      // Without this, Enter would also click whichever key has the focus.
      event.preventDefault();
      dispatch(action);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  return (
    <main className="calculator">
      <header className="header">
        <span className="badge">{messages.backendBadge}</span>
        <span className="arrow" aria-hidden="true">
          ↔
        </span>
        <span className="badge">{messages.frontendBadge}</span>
      </header>

      <Display expression={expression} value={display} status={status} errorMessage={errorMessage} />
      <Keypad activeOperation={activeOperation} disabled={status === "loading"} onAction={dispatch} />

      <footer className="footer">{messages.footer}</footer>
    </main>
  );
}
