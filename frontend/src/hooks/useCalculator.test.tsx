import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalculatorClient } from "../api/client";
import { ApiError } from "../api/types";
import type { CalculateRequest } from "../api/types";
import { useCalculator } from "./useCalculator";
import type { Action } from "./useCalculator";

/** A client the test settles by hand, so the loading state can be observed.
 *  This is the seam the injected CalculatorClient exists for: no network, no
 *  mocking library. */
function createFakeClient() {
  const requests: CalculateRequest[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  let resolvePending: (result: number) => void = () => {};
  let rejectPending: (error: unknown) => void = () => {};

  const client: CalculatorClient = {
    calculate(request, signal) {
      requests.push(request);
      signals.push(signal);
      return new Promise<number>((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    },
  };

  return {
    client,
    requests,
    signals,
    resolve: (result: number) => resolvePending(result),
    reject: (error: unknown) => rejectPending(error),
  };
}

const TWO_PLUS_THREE: Action[] = [
  { type: "DIGIT", digit: "2" },
  { type: "OPERATION", operation: "add" },
  { type: "DIGIT", digit: "3" },
  { type: "EVALUATE" },
];

function renderCalculator() {
  const fake = createFakeClient();
  const { result } = renderHook(() => useCalculator(fake.client));
  const dispatchAll = (actions: Action[]) =>
    act(() => {
      for (const action of actions) result.current.dispatch(action);
    });
  return { fake, result, dispatchAll };
}

describe("useCalculator", () => {
  it("starts idle with a zero on the display", () => {
    const { result, fake } = renderCalculator();

    expect(result.current.display).toBe("0");
    expect(result.current.status).toBe("idle");
    expect(result.current.expression).toBe("");
    expect(fake.requests).toEqual([]);
  });

  it("shows the pending operation on the expression line", () => {
    const { result, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE.slice(0, 2));

    expect(result.current.expression).toBe("2 +");
    expect(result.current.activeOperation).toBe("add");
  });

  it("asks the client, is loading meanwhile, then shows the result", async () => {
    const { result, fake, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE);
    expect(result.current.status).toBe("loading");
    expect(fake.requests).toEqual([{ operation: "add", operands: [2, 3] }]);

    await act(async () => fake.resolve(5));
    expect(result.current.status).toBe("idle");
    expect(result.current.display).toBe("5");
    expect(result.current.expression).toBe("");
  });

  it("shows the message of a rejection and keeps the display", async () => {
    const { result, fake, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE);
    await act(async () => fake.reject(new ApiError("DIVISION_BY_ZERO", "cannot divide by zero")));

    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toBe("Cannot divide by zero");
    expect(result.current.display).toBe("3");
    expect(result.current.activeOperation).toBeNull();
  });

  it("recovers from an error with the next calculation", async () => {
    const { result, fake, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE);
    await act(async () => fake.reject(new ApiError("NETWORK_ERROR", "unreachable")));
    expect(result.current.errorMessage).toBe("Cannot reach the server");

    dispatchAll(TWO_PLUS_THREE);
    await act(async () => fake.resolve(5));

    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.display).toBe("5");
  });

  it("ignores input while loading: one request, not two", () => {
    const { fake, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE);
    dispatchAll([{ type: "EVALUATE" }, { type: "DIGIT", digit: "9" }, { type: "EVALUATE" }]);

    expect(fake.requests).toHaveLength(1);
  });

  it("clear during a request aborts it and ignores the late answer", async () => {
    const { result, fake, dispatchAll } = renderCalculator();

    dispatchAll(TWO_PLUS_THREE);
    dispatchAll([{ type: "CLEAR" }]);
    expect(fake.signals[0]?.aborted).toBe(true);

    await act(async () => fake.resolve(5));
    expect(result.current.display).toBe("0");
    expect(result.current.status).toBe("idle");
  });

  it("sends a unary operation with one operand", () => {
    const { fake, dispatchAll } = renderCalculator();

    dispatchAll([
      { type: "DIGIT", digit: "9" },
      { type: "OPERATION", operation: "squareRoot" },
    ]);

    expect(fake.requests).toEqual([{ operation: "squareRoot", operands: [9] }]);
  });
});
