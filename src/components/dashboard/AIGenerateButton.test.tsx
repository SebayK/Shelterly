// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AIGenerateButton from "./AIGenerateButton";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

function renderButton(overrideProps: Partial<React.ComponentProps<typeof AIGenerateButton>> = {}) {
  const props: React.ComponentProps<typeof AIGenerateButton> = {
    type: "description",
    needId: "need-1",
    formData: {
      title: "Karma premium",
      category: "food",
      target_quantity: 5,
      unit: "pcs",
    },
    onResult: vi.fn(),
    onAiUsageIncremented: vi.fn(),
    disabled: false,
    aiUsageCount: 0,
    aiUsageLimit: 5,
    ...overrideProps,
  };

  return {
    ...render(<AIGenerateButton {...props} />),
    props,
  };
}

describe("AIGenerateButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.toastError.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("disables the button when AI usage limit has been reached", () => {
    renderButton({ aiUsageCount: 5, aiUsageLimit: 5 });

    expect(screen.getByRole("button", { name: "Generuj opis AI" })).toHaveProperty("disabled", true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("disables description generation when required data is missing", () => {
    renderButton({ formData: { title: "", category: "food", target_quantity: undefined, unit: "" } });

    expect(screen.getByRole("button", { name: "Generuj opis AI" })).toHaveProperty("disabled", true);
  });

  it("calls description endpoint and returns generated content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ description: "Nowy opis", ai_usage_incremented: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { props } = renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Generuj opis AI" }));

    await waitFor(() => {
      expect(props.onResult).toHaveBeenCalledWith("Nowy opis");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/generate-description",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      })
    );
    expect(props.onAiUsageIncremented).toHaveBeenCalled();
  });

  it("shows mapped API error when AI request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED", message: "Za dużo prób" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    renderButton({ type: "shopping_url", formData: { title: "Karma premium", category: "food" } });

    fireEvent.click(screen.getByRole("button", { name: "Znajdź produkt AI" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Zbyt wiele prób generowania AI. Spróbuj ponownie za chwilę.");
    });
  });

  it("shows timeout message when AI request aborts", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Generuj opis AI" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Przekroczono czas oczekiwania na odpowiedź AI.");
    });
  });
});
