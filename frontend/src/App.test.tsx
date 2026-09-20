import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import App from "./App";
import { createHttpClient } from "./api/client";
import { CALCULATE_URL, TEST_BASE_URL, server } from "./test/server";

// Integration: the real App, hook, reducer, and HTTP client. Only the network
// is replaced, by Mock Service Worker.

function renderApp() {
  render(<App client={createHttpClient(TEST_BASE_URL)} />);
  const user = userEvent.setup();
  const keypad = within(screen.getByRole("group", { name: "Keypad" }));

  return {
    user,
    key: (name: string) => keypad.getByRole("button", { name }),
    press: async (...names: string[]) => {
      for (const name of names) await user.click(keypad.getByRole("button", { name }));
    },
    /** The result is an <output>, whose implicit role is "status". */
    display: () => screen.getByRole("status"),
  };
}

describe("App", () => {
  it("2 + 3 = shows 5", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CALCULATE_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ result: 5 });
      }),
    );
    const { press, display } = renderApp();

    await press("2", "Add", "3", "Equals");

    expect(await screen.findByText("5", { selector: "output" })).toBeInTheDocument();
    expect(display()).toHaveTextContent("5");
    expect(bodies).toEqual([{ operation: "add", operands: [2, 3] }]);
  });

  it("10 ÷ 0 shows the error and keeps the calculator usable", async () => {
    server.use(
      http.post(CALCULATE_URL, () =>
        HttpResponse.json(
          { error: { code: "DIVISION_BY_ZERO", message: "cannot divide by zero" } },
          { status: 422 },
        ),
      ),
    );
    const { press, display, key } = renderApp();

    await press("1", "0", "Divide", "0", "Equals");

    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot divide by zero");
    expect(display()).toHaveTextContent("0");
    expect(key("7")).toBeEnabled();

    await press("7");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(display()).toHaveTextContent("7");
  });

  it("disables the keys while loading, except Clear", async () => {
    let respond: (response: Response) => void = () => {};
    server.use(
      http.post(
        CALCULATE_URL,
        () =>
          new Promise<Response>((resolve) => {
            respond = resolve;
          }),
      ),
    );
    const { press, key, display } = renderApp();

    await press("2", "Add", "3", "Equals");

    expect(await screen.findByText("Calculating…")).toBeInTheDocument();
    expect(key("7")).toBeDisabled();
    expect(key("Add")).toBeDisabled();
    expect(key("Equals")).toBeDisabled();
    expect(key("Clear")).toBeEnabled();

    respond(HttpResponse.json({ result: 5 }));

    expect(await screen.findByText("5", { selector: "output" })).toBeInTheDocument();
    expect(screen.queryByText("Calculating…")).not.toBeInTheDocument();
    expect(key("7")).toBeEnabled();
    expect(display()).toHaveTextContent("5");
  });

  it("a stopped backend shows a visible error", async () => {
    server.use(http.post(CALCULATE_URL, () => HttpResponse.error()));
    const { press } = renderApp();

    await press("2", "Add", "3", "Equals");

    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server");
  });

  it("marks the pending operation and shows it on the expression line", async () => {
    const { press, key } = renderApp();

    await press("1", "2", "Multiply");

    expect(key("Multiply")).toHaveAttribute("aria-pressed", "true");
    expect(key("Add")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("12 ×")).toBeInTheDocument();
  });

  it("accepts the physical keyboard", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(CALCULATE_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ result: 36 });
      }),
    );
    const { user, display } = renderApp();

    await user.keyboard("12*3{Enter}");

    expect(await screen.findByText("36", { selector: "output" })).toBeInTheDocument();
    expect(bodies).toEqual([{ operation: "multiply", operands: [12, 3] }]);

    await user.keyboard("{Escape}");
    expect(display()).toHaveTextContent("0");
  });

  it("leaves browser shortcuts alone", async () => {
    const { user, display } = renderApp();

    await user.keyboard("{Control>}5{/Control}");

    expect(display()).toHaveTextContent("0");
  });
});
