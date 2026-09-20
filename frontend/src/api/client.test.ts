import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { CALCULATE_URL, TEST_BASE_URL, server } from "../test/server";
import { createHttpClient } from "./client";
import { ApiError } from "./types";

const client = createHttpClient(TEST_BASE_URL);

describe("createHttpClient", () => {
  it("posts the request as JSON and resolves with the result", async () => {
    let received: { method: string; contentType: string | null; body: unknown } | null = null;
    server.use(
      http.post(CALCULATE_URL, async ({ request }) => {
        received = {
          method: request.method,
          contentType: request.headers.get("Content-Type"),
          body: await request.json(),
        };
        return HttpResponse.json({ result: 2.5 });
      }),
    );

    await expect(client.calculate({ operation: "divide", operands: [10, 4] })).resolves.toBe(2.5);
    expect(received).toEqual({
      method: "POST",
      contentType: "application/json",
      body: { operation: "divide", operands: [10, 4] },
    });
  });

  it("resolves with a result of zero", async () => {
    server.use(http.post(CALCULATE_URL, () => HttpResponse.json({ result: 0 })));

    await expect(client.calculate({ operation: "subtract", operands: [2, 2] })).resolves.toBe(0);
  });

  const failures: { name: string; respond: () => Response; code: string; message: string }[] = [
    {
      name: "an error envelope becomes an ApiError with the code and message of the server",
      respond: () =>
        HttpResponse.json(
          { error: { code: "DIVISION_BY_ZERO", message: "cannot divide by zero" } },
          { status: 422 },
        ),
      code: "DIVISION_BY_ZERO",
      message: "cannot divide by zero",
    },
    {
      name: "a failed connection is a network error",
      respond: () => HttpResponse.error(),
      code: "NETWORK_ERROR",
      message: "the request did not reach the server",
    },
    {
      name: "a gateway error without an envelope is a network error",
      respond: () => new HttpResponse("<html>502 Bad Gateway</html>", { status: 502 }),
      code: "NETWORK_ERROR",
      message: "unexpected response (HTTP 502)",
    },
    {
      name: "a client error without an envelope is an invalid response",
      respond: () => new HttpResponse("not found", { status: 404 }),
      code: "INVALID_RESPONSE",
      message: "unexpected response (HTTP 404)",
    },
    {
      name: "a success without a numeric result is an invalid response",
      respond: () => HttpResponse.json({ result: "5" }),
      code: "INVALID_RESPONSE",
      message: "unexpected response (HTTP 200)",
    },
    {
      name: "an envelope with the wrong shape is an invalid response",
      respond: () => HttpResponse.json({ error: "plain text" }, { status: 400 }),
      code: "INVALID_RESPONSE",
      message: "unexpected response (HTTP 400)",
    },
  ];

  it.each(failures)("$name", async ({ respond, code, message }) => {
    server.use(http.post(CALCULATE_URL, respond));

    const failure = await client.calculate({ operation: "add", operands: [1, 2] }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code, message });
  });

  it("rejects an aborted request with the abort itself, not with an ApiError", async () => {
    server.use(http.post(CALCULATE_URL, () => HttpResponse.json({ result: 1 })));
    const abortController = new AbortController();
    abortController.abort();

    const failure = await client
      .calculate({ operation: "add", operands: [1, 2] }, abortController.signal)
      .catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ name: "AbortError" });
  });
});
