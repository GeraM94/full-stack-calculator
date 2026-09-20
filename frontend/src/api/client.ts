// The only module that knows where the API lives and the only one that calls
// fetch. Everything else depends on the CalculatorClient interface.

import { ApiError } from "./types";
import type { CalculateRequest, CalculateResponse, ErrorResponse } from "./types";

export interface CalculatorClient {
  /** Resolves with the result, or rejects with an ApiError. */
  calculate(request: CalculateRequest, signal?: AbortSignal): Promise<number>;
}

const CALCULATE_PATH = "/api/v1/calculate";

/** The default base URL is empty: same origin, where Vite (development) and
 *  nginx (Docker) proxy /api to the backend. */
export function createHttpClient(
  baseUrl: string = import.meta.env.VITE_API_URL ?? "",
): CalculatorClient {
  return {
    async calculate(request, signal) {
      let response: Response;
      try {
        response = await fetch(baseUrl + CALCULATE_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });
      } catch (error) {
        // An aborted request is the caller's own doing, not a failure to report.
        if (signal?.aborted) throw error;
        throw new ApiError("NETWORK_ERROR", "the request did not reach the server");
      }

      const body = await readJson(response);
      if (response.ok && isCalculateResponse(body)) {
        return body.result;
      }
      if (isErrorResponse(body)) {
        throw new ApiError(body.error.code, body.error.message);
      }
      // No envelope: the answer came from something in front of the API, such
      // as a proxy reporting that the backend is down.
      throw new ApiError(
        response.status >= 500 ? "NETWORK_ERROR" : "INVALID_RESPONSE",
        `unexpected response (HTTP ${response.status})`,
      );
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isCalculateResponse(body: unknown): body is CalculateResponse {
  return isRecord(body) && typeof body.result === "number";
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  return (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.code === "string" &&
    typeof body.error.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
