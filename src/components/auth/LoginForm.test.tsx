// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginForm from "./LoginForm";

const mocks = vi.hoisted(() => ({
  getPostLoginDestination: vi.fn(),
}));

vi.mock("@/lib/auth-access", () => ({
  getPostLoginDestination: (...args: unknown[]) => mocks.getPostLoginDestination(...args),
}));

function renderForm(overrideProps: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  const props: React.ComponentProps<typeof LoginForm> = {
    returnUrl: "/dashboard?tab=needs",
    ...overrideProps,
  };

  return {
    ...render(<LoginForm {...props} />),
    props,
  };
}

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((resolved) => {
    resolve = resolved;
  });

  return { promise, resolve };
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getPostLoginDestination.mockReset();
    mocks.getPostLoginDestination.mockReturnValue("/dashboard/profile");
  });

  it("shows client-side validation errors and skips the request when required fields are missing", async () => {
    const user = userEvent.setup();

    renderForm();

    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Adres e-mail jest wymagany.")).toBeTruthy();
    expect(screen.getByText("Hasło jest wymagane.")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Adres e-mail").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Hasło").getAttribute("aria-invalid")).toBe("true");
  });

  it("revalidates fields live after the first submit attempt", async () => {
    const user = userEvent.setup();

    renderForm();

    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Adres e-mail jest wymagany.")).toBeTruthy();
    expect(screen.getByText("Hasło jest wymagane.")).toBeTruthy();

    await user.type(screen.getByLabelText("Adres e-mail"), "shelter@example.com");
    await user.type(screen.getByLabelText("Hasło"), "super-secret");

    await waitFor(() => {
      expect(screen.queryByText("Adres e-mail jest wymagany.")).toBeNull();
      expect(screen.queryByText("Podaj poprawny adres e-mail.")).toBeNull();
      expect(screen.queryByText("Hasło jest wymagane.")).toBeNull();
    });
  });

  it("toggles password visibility without losing the current value", async () => {
    const user = userEvent.setup();

    renderForm();

    const passwordInput = screen.getByLabelText("Hasło") as HTMLInputElement;

    await user.type(passwordInput, "secret-123");
    expect(passwordInput.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(passwordInput.type).toBe("text");
    expect(passwordInput.value).toBe("secret-123");

    await user.click(screen.getByRole("button", { name: "Ukryj hasło" }));
    expect(passwordInput.type).toBe("password");
  });

  it("submits credentials, disables the form while pending and delegates post-login navigation", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredResponse();

    vi.stubGlobal("fetch", vi.fn().mockReturnValue(deferred.promise));
    mocks.getPostLoginDestination.mockReturnValue("/dashboard/verified");

    renderForm({ returnUrl: "/dashboard/profile" });

    const emailInput = screen.getByLabelText("Adres e-mail") as HTMLInputElement;
    const passwordInput = screen.getByLabelText("Hasło") as HTMLInputElement;

    await user.type(emailInput, "shelter@example.com");
    await user.type(passwordInput, "super-secret");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "shelter@example.com",
          password: "super-secret",
        }),
      })
    );
    expect(emailInput.disabled).toBe(true);
    expect(passwordInput.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Logowanie..." }).getAttribute("aria-busy")).toBe("true");

    deferred.resolve(
      new Response(
        JSON.stringify({
          user: { id: "user-1", email: "shelter@example.com" },
          profile: {
            id: "profile-1",
            role: "shelter",
            status: "verified",
            rejection_reason: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await waitFor(() => {
      expect(mocks.getPostLoginDestination).toHaveBeenCalledWith("shelter", "verified", "/dashboard/profile");
    });

    expect(screen.getByRole("button", { name: "Zaloguj się" }).disabled).toBe(false);
  });

  it("shows a mapped API error when the server rejects the credentials", async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid login credentials",
            },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    renderForm();

    await user.type(screen.getByLabelText("Adres e-mail"), "shelter@example.com");
    await user.type(screen.getByLabelText("Hasło"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(await screen.findByText("Nieprawidłowy adres e-mail lub hasło.")).toBeTruthy();
    expect(mocks.getPostLoginDestination).not.toHaveBeenCalled();
  });

  it("shows a network error when the request fails before a response is returned", async () => {
    const user = userEvent.setup();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    renderForm();

    await user.type(screen.getByLabelText("Adres e-mail"), "shelter@example.com");
    await user.type(screen.getByLabelText("Hasło"), "super-secret");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    expect(
      await screen.findByText("Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.")
    ).toBeTruthy();
  });
});
