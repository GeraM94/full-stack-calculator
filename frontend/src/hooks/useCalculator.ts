// The calculator is a state machine. The reducer is pure; the hook adds the one
// side effect, which is asking the injected client for a result.
//
// Transition table
//
//   DIGIT        after a result or an operation key  -> starts a new number
//                a second "." in the same number     -> ignored
//                a leading zero                      -> replaced, never "007"
//                beyond MAXIMUM_DIGITS               -> ignored
//   OPERATION    nothing pending                     -> stores the display as the
//                                                       left operand, arms the operation
//                pressed again, no operand typed yet -> replaces the pending operation
//                pending and an operand was typed    -> evaluates first, then arms the
//                                                       new operation (chaining)
//                unary (square root)                 -> evaluates the display at once;
//                                                       a pending operation is kept
//   EVALUATE     nothing pending                     -> does nothing
//                repeated                            -> does nothing: "=" clears the pending
//                                                       operation, nothing is re-applied
//   SUCCESS      -> shows the result; the next digit starts a new number
//   FAILURE      -> shows the message, keeps the display, clears the pending operation
//   DELETE       -> removes the last digit; after a result, resets the display to 0
//   TOGGLE_SIGN  -> flips the sign of the display, except for 0
//   CLEAR        -> initial state, and abandons a request in flight
//
//   While a request is in flight every action except SUCCESS, FAILURE, and
//   CLEAR is ignored. The guard sits in the reducer, so the physical keyboard
//   cannot get around it the way it could get around a disabled button.

import { useEffect, useReducer } from "react";
import type { CalculatorClient } from "../api/client";
import { ApiError } from "../api/types";
import type { CalculateRequest, Operation } from "../api/types";
import { errorText, messages, operationText } from "../messages";
import { formatNumber } from "../utilities/formatNumber";

export type Status = "idle" | "loading" | "error";

export interface State {
  /** What is being typed, as text ("12.5", "-3"). The display shows this. */
  input: string;
  /** Left operand of the pending operation. */
  accumulator: number | null;
  /** Binary operation waiting for its right operand. */
  pendingOperation: Operation | null;
  /** The next digit starts a new number instead of extending the input. */
  overwrite: boolean;
  /** An operation key was the last thing pressed: no right operand yet. */
  awaitingOperand: boolean;
  status: Status;
  /** What the effect must send; set exactly while status is "loading". */
  request: CalculateRequest | null;
  /** Operation to arm when the request in flight succeeds (chaining). */
  nextOperation: Operation | null;
  /** Set exactly while status is "error". */
  errorMessage: string | null;
}

export type Action =
  | { type: "DIGIT"; digit: string }
  | { type: "OPERATION"; operation: Operation }
  | { type: "EVALUATE" }
  | { type: "DELETE" }
  | { type: "TOGGLE_SIGN" }
  | { type: "CLEAR" }
  | { type: "SUCCESS"; result: number }
  | { type: "FAILURE"; message: string };

export const initialState: State = {
  input: "0",
  accumulator: null,
  pendingOperation: null,
  overwrite: false,
  awaitingOperand: false,
  status: "idle",
  request: null,
  nextOperation: null,
  errorMessage: null,
};

/** float64 round-trips 15 significant decimal digits; more would be a lie. */
export const MAXIMUM_DIGITS = 15;

const UNARY_OPERATIONS: ReadonlySet<Operation> = new Set<Operation>(["squareRoot"]);

export function reducer(state: State, action: Action): State {
  const isResponse = action.type === "SUCCESS" || action.type === "FAILURE";
  if (state.status === "loading") {
    if (!isResponse && action.type !== "CLEAR") return state;
  } else if (isResponse) {
    // A response nobody is waiting for, for example after CLEAR.
    return state;
  }

  switch (action.type) {
    case "DIGIT": {
      let base = state.overwrite ? "" : state.input;
      if (base === "0" && action.digit !== ".") base = "";
      if (action.digit === "." && base.includes(".")) return state;

      const input = action.digit === "." && base === "" ? "0." : base + action.digit;
      if (input.replace(/[-.]/g, "").length > MAXIMUM_DIGITS) return state;

      return { ...withoutError(state), input, overwrite: false, awaitingOperand: false };
    }

    case "OPERATION": {
      if (UNARY_OPERATIONS.has(action.operation)) {
        return send(state, { operation: action.operation, operands: [Number(state.input)] }, null);
      }
      if (state.pendingOperation !== null && state.awaitingOperand) {
        return { ...withoutError(state), pendingOperation: action.operation };
      }
      if (state.pendingOperation === null || state.accumulator === null) {
        return {
          ...withoutError(state),
          accumulator: Number(state.input),
          pendingOperation: action.operation,
          overwrite: true,
          awaitingOperand: true,
        };
      }
      return send(state, pendingRequest(state.pendingOperation, state.accumulator, state), action.operation);
    }

    case "EVALUATE": {
      if (state.pendingOperation === null || state.accumulator === null) return state;
      return send(state, pendingRequest(state.pendingOperation, state.accumulator, state), null);
    }

    case "SUCCESS": {
      const shown: State = {
        ...state,
        input: formatNumber(action.result),
        overwrite: true,
        awaitingOperand: false,
        status: "idle",
        request: null,
        nextOperation: null,
        errorMessage: null,
      };
      // A unary result replaces the display only: "9 + 16 √" is still "9 + 4".
      if (state.request !== null && UNARY_OPERATIONS.has(state.request.operation)) return shown;
      if (state.nextOperation !== null) {
        return {
          ...shown,
          accumulator: action.result,
          pendingOperation: state.nextOperation,
          awaitingOperand: true,
        };
      }
      return { ...shown, accumulator: null, pendingOperation: null };
    }

    case "FAILURE":
      return {
        ...state,
        accumulator: null,
        pendingOperation: null,
        overwrite: true,
        awaitingOperand: false,
        status: "error",
        request: null,
        nextOperation: null,
        errorMessage: action.message,
      };

    case "DELETE": {
      if (state.overwrite) {
        return { ...withoutError(state), input: "0", overwrite: false, awaitingOperand: false };
      }
      const input = state.input.slice(0, -1);
      return { ...withoutError(state), input: input === "" || input === "-" ? "0" : input };
    }

    case "TOGGLE_SIGN": {
      if (state.input === "0") return state;
      const input = state.input.startsWith("-") ? state.input.slice(1) : "-" + state.input;
      return { ...withoutError(state), input };
    }

    case "CLEAR":
      return initialState;
  }
  // No default: the switch covers the whole union. An Action added without a
  // case is a compile error here, because the function would stop returning.
}

function withoutError(state: State): State {
  return { ...state, status: "idle", errorMessage: null };
}

function send(state: State, request: CalculateRequest, nextOperation: Operation | null): State {
  return { ...state, status: "loading", request, nextOperation, errorMessage: null };
}

function pendingRequest(operation: Operation, accumulator: number, state: State): CalculateRequest {
  return { operation, operands: [accumulator, Number(state.input)] };
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return errorText[error.code] ?? error.message;
  return messages.unknownError;
}

/** Physical keyboard. Returns null for keys the calculator does not use. */
export function actionForKey(key: string): Action | null {
  if (key.length === 1 && key >= "0" && key <= "9") return { type: "DIGIT", digit: key };
  switch (key) {
    case ".":
    case ",":
      return { type: "DIGIT", digit: "." };
    case "+":
      return { type: "OPERATION", operation: "add" };
    case "-":
      return { type: "OPERATION", operation: "subtract" };
    case "*":
      return { type: "OPERATION", operation: "multiply" };
    case "/":
      return { type: "OPERATION", operation: "divide" };
    case "^":
      return { type: "OPERATION", operation: "power" };
    case "%":
      return { type: "OPERATION", operation: "percentage" };
    case "Enter":
    case "=":
      return { type: "EVALUATE" };
    case "Backspace":
      return { type: "DELETE" };
    case "Escape":
      return { type: "CLEAR" };
    default:
      return null;
  }
}

export function useCalculator(client: CalculatorClient) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const request = state.request;
    if (request === null) return;

    // Aborting covers CLEAR during a request, and the second mount that
    // StrictMode performs on purpose in development.
    const abortController = new AbortController();

    async function sendRequest(pending: CalculateRequest) {
      try {
        const result = await client.calculate(pending, abortController.signal);
        if (!abortController.signal.aborted) dispatch({ type: "SUCCESS", result });
      } catch (error) {
        if (!abortController.signal.aborted) {
          dispatch({ type: "FAILURE", message: toErrorMessage(error) });
        }
      }
    }
    void sendRequest(request);

    return () => abortController.abort();
  }, [state.request, client]);

  /** Upper line of the display: "12 ×" while the right operand is typed. */
  const expression =
    state.accumulator !== null && state.pendingOperation !== null
      ? `${formatNumber(state.accumulator)} ${operationText[state.pendingOperation].symbol}`
      : "";

  return {
    display: state.input,
    expression,
    activeOperation: state.pendingOperation,
    status: state.status,
    errorMessage: state.errorMessage,
    /** React keeps the identity of dispatch stable across renders. */
    dispatch,
  };
}
