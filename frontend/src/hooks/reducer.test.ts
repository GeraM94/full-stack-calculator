import { describe, expect, it } from "vitest";
import { MAXIMUM_DIGITS, actionForKey, initialState, reducer, toErrorMessage } from "./useCalculator";
import type { Action, State } from "./useCalculator";
import { ApiError } from "../api/types";

function stateWith(changes: Partial<State>): State {
  return { ...initialState, ...changes };
}

/** "5 +" typed, nothing after the operator yet. */
const awaitingRightOperand = stateWith({
  input: "5",
  accumulator: 5,
  pendingOperation: "add",
  overwrite: true,
  awaitingOperand: true,
});

/** "5 + 3" typed. */
const rightOperandTyped = stateWith({
  input: "3",
  accumulator: 5,
  pendingOperation: "add",
});

/** "5 + 3 =" sent, no answer yet. */
const loading = stateWith({
  input: "3",
  accumulator: 5,
  pendingOperation: "add",
  status: "loading",
  request: { operation: "add", operands: [5, 3] },
});

/** A result is on the display. */
const afterResult = stateWith({ input: "8", overwrite: true });

const afterFailure = stateWith({
  input: "0",
  overwrite: true,
  status: "error",
  errorMessage: "Cannot divide by zero",
});

describe("reducer transitions", () => {
  const testCases: { name: string; before: State; action: Action; after: State }[] = [
    // DIGIT
    {
      name: "a digit replaces the initial zero",
      before: initialState,
      action: { type: "DIGIT", digit: "7" },
      after: stateWith({ input: "7" }),
    },
    {
      name: "a digit extends the number",
      before: stateWith({ input: "7" }),
      action: { type: "DIGIT", digit: "5" },
      after: stateWith({ input: "75" }),
    },
    {
      name: "a digit after a result starts a new number",
      before: afterResult,
      action: { type: "DIGIT", digit: "4" },
      after: stateWith({ input: "4" }),
    },
    {
      name: "a digit after an operator starts the right operand",
      before: awaitingRightOperand,
      action: { type: "DIGIT", digit: "3" },
      after: rightOperandTyped,
    },
    {
      name: "leading zeros are blocked",
      before: initialState,
      action: { type: "DIGIT", digit: "0" },
      after: initialState,
    },
    {
      name: "a decimal point on zero keeps the zero",
      before: initialState,
      action: { type: "DIGIT", digit: "." },
      after: stateWith({ input: "0." }),
    },
    {
      name: "a decimal point after a result starts at 0.",
      before: afterResult,
      action: { type: "DIGIT", digit: "." },
      after: stateWith({ input: "0." }),
    },
    {
      name: "a second decimal point is ignored",
      before: stateWith({ input: "1.5" }),
      action: { type: "DIGIT", digit: "." },
      after: stateWith({ input: "1.5" }),
    },
    {
      name: "digits beyond the maximum are ignored",
      before: stateWith({ input: "1".repeat(MAXIMUM_DIGITS) }),
      action: { type: "DIGIT", digit: "9" },
      after: stateWith({ input: "1".repeat(MAXIMUM_DIGITS) }),
    },
    {
      name: "the sign and the point do not count as digits",
      before: stateWith({ input: "-" + "1".repeat(MAXIMUM_DIGITS - 1) + "." }),
      action: { type: "DIGIT", digit: "9" },
      after: stateWith({ input: "-" + "1".repeat(MAXIMUM_DIGITS - 1) + ".9" }),
    },
    {
      name: "a digit after an error clears the message and starts a new number",
      before: afterFailure,
      action: { type: "DIGIT", digit: "6" },
      after: stateWith({ input: "6" }),
    },

    // OPERATION
    {
      name: "an operation stores the display and waits for the right operand",
      before: stateWith({ input: "5" }),
      action: { type: "OPERATION", operation: "add" },
      after: awaitingRightOperand,
    },
    {
      name: "an operation pressed twice replaces the pending one",
      before: awaitingRightOperand,
      action: { type: "OPERATION", operation: "multiply" },
      after: { ...awaitingRightOperand, pendingOperation: "multiply" },
    },
    {
      name: "an operation with a pending one and a right operand evaluates first",
      before: rightOperandTyped,
      action: { type: "OPERATION", operation: "multiply" },
      after: {
        ...rightOperandTyped,
        status: "loading",
        request: { operation: "add", operands: [5, 3] },
        nextOperation: "multiply",
      },
    },
    {
      name: "a unary operation evaluates the display at once",
      before: stateWith({ input: "9" }),
      action: { type: "OPERATION", operation: "squareRoot" },
      after: stateWith({
        input: "9",
        status: "loading",
        request: { operation: "squareRoot", operands: [9] },
      }),
    },
    {
      name: "a unary operation keeps the pending binary operation",
      before: stateWith({ input: "16", accumulator: 9, pendingOperation: "add" }),
      action: { type: "OPERATION", operation: "squareRoot" },
      after: stateWith({
        input: "16",
        accumulator: 9,
        pendingOperation: "add",
        status: "loading",
        request: { operation: "squareRoot", operands: [16] },
      }),
    },

    // EVALUATE
    {
      name: "evaluate with nothing pending does nothing",
      before: stateWith({ input: "5" }),
      action: { type: "EVALUATE" },
      after: stateWith({ input: "5" }),
    },
    {
      name: "evaluate after a result does nothing: the operation is not re-applied",
      before: afterResult,
      action: { type: "EVALUATE" },
      after: afterResult,
    },
    {
      name: "evaluate sends the pending operation",
      before: rightOperandTyped,
      action: { type: "EVALUATE" },
      after: loading,
    },
    {
      name: "evaluate right after an operator uses the display as the right operand",
      before: awaitingRightOperand,
      action: { type: "EVALUATE" },
      after: {
        ...awaitingRightOperand,
        status: "loading",
        request: { operation: "add", operands: [5, 5] },
      },
    },

    // SUCCESS
    {
      name: "a result replaces the display and clears the pending operation",
      before: loading,
      action: { type: "SUCCESS", result: 8 },
      after: afterResult,
    },
    {
      name: "a result while chaining becomes the left operand of the next operation",
      before: { ...loading, nextOperation: "multiply" },
      action: { type: "SUCCESS", result: 8 },
      after: stateWith({
        input: "8",
        accumulator: 8,
        pendingOperation: "multiply",
        overwrite: true,
        awaitingOperand: true,
      }),
    },
    {
      name: "a unary result replaces the display only",
      before: stateWith({
        input: "16",
        accumulator: 9,
        pendingOperation: "add",
        status: "loading",
        request: { operation: "squareRoot", operands: [16] },
      }),
      action: { type: "SUCCESS", result: 4 },
      after: stateWith({ input: "4", accumulator: 9, pendingOperation: "add", overwrite: true }),
    },
    {
      name: "a result is formatted for the display",
      before: loading,
      action: { type: "SUCCESS", result: 0.30000000000000004 },
      after: stateWith({ input: "0.3", overwrite: true }),
    },
    {
      name: "a response that nobody waits for is ignored",
      before: stateWith({ input: "5" }),
      action: { type: "SUCCESS", result: 99 },
      after: stateWith({ input: "5" }),
    },

    // FAILURE
    {
      name: "a failure shows the message, keeps the display, clears the pending operation",
      before: loading,
      action: { type: "FAILURE", message: "Cannot divide by zero" },
      after: stateWith({
        input: "3",
        overwrite: true,
        status: "error",
        errorMessage: "Cannot divide by zero",
      }),
    },
    {
      name: "a failure that nobody waits for is ignored",
      before: initialState,
      action: { type: "FAILURE", message: "late" },
      after: initialState,
    },

    // DELETE
    {
      name: "delete removes the last digit",
      before: stateWith({ input: "125" }),
      action: { type: "DELETE" },
      after: stateWith({ input: "12" }),
    },
    {
      name: "delete on a single digit leaves zero",
      before: stateWith({ input: "7" }),
      action: { type: "DELETE" },
      after: initialState,
    },
    {
      name: "delete on a negative single digit leaves zero, not a lone sign",
      before: stateWith({ input: "-7" }),
      action: { type: "DELETE" },
      after: initialState,
    },
    {
      name: "delete after a result resets the display",
      before: afterResult,
      action: { type: "DELETE" },
      after: initialState,
    },

    // TOGGLE_SIGN
    {
      name: "toggle sign makes a number negative",
      before: stateWith({ input: "12" }),
      action: { type: "TOGGLE_SIGN" },
      after: stateWith({ input: "-12" }),
    },
    {
      name: "toggle sign makes a negative number positive",
      before: stateWith({ input: "-12" }),
      action: { type: "TOGGLE_SIGN" },
      after: stateWith({ input: "12" }),
    },
    {
      name: "toggle sign leaves zero alone",
      before: initialState,
      action: { type: "TOGGLE_SIGN" },
      after: initialState,
    },

    // CLEAR
    {
      name: "clear returns to the initial state",
      before: rightOperandTyped,
      action: { type: "CLEAR" },
      after: initialState,
    },
    {
      name: "clear removes an error",
      before: afterFailure,
      action: { type: "CLEAR" },
      after: initialState,
    },
    {
      name: "clear abandons a request in flight",
      before: loading,
      action: { type: "CLEAR" },
      after: initialState,
    },
  ];

  it.each(testCases)("$name", ({ before, action, after }) => {
    expect(reducer(before, action)).toEqual(after);
  });
});

describe("while a request is in flight", () => {
  const ignored: Action[] = [
    { type: "DIGIT", digit: "1" },
    { type: "OPERATION", operation: "add" },
    { type: "OPERATION", operation: "squareRoot" },
    { type: "EVALUATE" },
    { type: "DELETE" },
    { type: "TOGGLE_SIGN" },
  ];

  it.each(ignored)("ignores $type", (action) => {
    expect(reducer(loading, action)).toBe(loading);
  });
});

describe("key sequences", () => {
  /** Plays actions in order. A request is answered by the given results, one
   *  per request, the way the hook's effect would. */
  function play(actions: Action[], results: number[] = []): State {
    const pendingResults = [...results];
    let state = initialState;
    for (const action of actions) {
      state = reducer(state, action);
      if (state.status === "loading") {
        const result = pendingResults.shift();
        if (result === undefined) throw new Error("the sequence sent more requests than expected");
        state = reducer(state, { type: "SUCCESS", result });
      }
    }
    expect(pendingResults).toEqual([]);
    return state;
  }

  const digit = (value: string): Action => ({ type: "DIGIT", digit: value });
  const add: Action = { type: "OPERATION", operation: "add" };
  const multiply: Action = { type: "OPERATION", operation: "multiply" };
  const evaluate: Action = { type: "EVALUATE" };

  it("5 + × 3 = sends one multiplication", () => {
    const state = play([digit("5"), add, multiply, digit("3"), evaluate], [15]);
    expect(state.input).toBe("15");
  });

  it("2 + 3 = = = sends one request", () => {
    const state = play([digit("2"), add, digit("3"), evaluate, evaluate, evaluate], [5]);
    expect(state.input).toBe("5");
    expect(state.pendingOperation).toBeNull();
  });

  it("2 + 3 × 4 = chains: two requests, left to right", () => {
    const state = play([digit("2"), add, digit("3"), multiply, digit("4"), evaluate], [5, 20]);
    expect(state.input).toBe("20");
  });

  it("a digit after a result starts over, and the old result is not an operand", () => {
    const state = play([digit("2"), add, digit("3"), evaluate, digit("9"), add, digit("1"), evaluate], [5, 10]);
    expect(state.input).toBe("10");
  });

  it("a result can be the left operand of the next operation", () => {
    const afterFirst = play([digit("2"), add, digit("3"), evaluate, multiply], [5]);
    expect(afterFirst.accumulator).toBe(5);
    expect(afterFirst.pendingOperation).toBe("multiply");
  });

  it("an error, then a digit, then a new calculation", () => {
    let state = play([digit("8"), { type: "OPERATION", operation: "divide" }, digit("0")]);
    state = reducer(state, evaluate);
    state = reducer(state, { type: "FAILURE", message: "Cannot divide by zero" });
    expect(state.status).toBe("error");
    expect(state.input).toBe("0");

    state = reducer(state, digit("6"));
    expect(state.status).toBe("idle");
    expect(state.errorMessage).toBeNull();
    expect(state.input).toBe("6");
    expect(state.pendingOperation).toBeNull();
  });
});

describe("actionForKey", () => {
  const testCases: { key: string; action: Action | null }[] = [
    { key: "7", action: { type: "DIGIT", digit: "7" } },
    { key: ".", action: { type: "DIGIT", digit: "." } },
    { key: ",", action: { type: "DIGIT", digit: "." } },
    { key: "+", action: { type: "OPERATION", operation: "add" } },
    { key: "-", action: { type: "OPERATION", operation: "subtract" } },
    { key: "*", action: { type: "OPERATION", operation: "multiply" } },
    { key: "/", action: { type: "OPERATION", operation: "divide" } },
    { key: "^", action: { type: "OPERATION", operation: "power" } },
    { key: "%", action: { type: "OPERATION", operation: "percentage" } },
    { key: "Enter", action: { type: "EVALUATE" } },
    { key: "=", action: { type: "EVALUATE" } },
    { key: "Backspace", action: { type: "DELETE" } },
    { key: "Escape", action: { type: "CLEAR" } },
    { key: "a", action: null },
    { key: "F5", action: null },
    { key: "Tab", action: null },
  ];

  it.each(testCases)("$key", ({ key, action }) => {
    expect(actionForKey(key)).toEqual(action);
  });
});

describe("toErrorMessage", () => {
  it("prefers the text for a known error code", () => {
    expect(toErrorMessage(new ApiError("DIVISION_BY_ZERO", "cannot divide by zero"))).toBe(
      "Cannot divide by zero",
    );
  });

  it("falls back to the server message for a code without its own text", () => {
    expect(toErrorMessage(new ApiError("UNKNOWN_OPERATION", 'unknown operation: "modulo"'))).toBe(
      'unknown operation: "modulo"',
    );
  });

  it("has a generic message for anything that is not an ApiError", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("Something went wrong");
    expect(toErrorMessage("boom")).toBe("Something went wrong");
  });
});
