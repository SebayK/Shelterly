import { describe, expect, it } from "vitest";

import {
  hasNeedFormErrors,
  validateNeedCurrentQuantity,
  validateNeedForm,
  validateNeedShoppingUrl,
  validateNeedTargetQuantity,
} from "./need-form.schemas";

describe("need-form.schemas", () => {
  it("validates target quantity boundaries and decimal precision", () => {
    expect(validateNeedTargetQuantity("")).toBe("Ilość docelowa jest wymagana.");
    expect(validateNeedTargetQuantity("0")).toBe("Ilość docelowa musi być liczbą większą od 0.");
    expect(validateNeedTargetQuantity("12.345")).toBe("Ilość docelowa może mieć maksymalnie 2 miejsca po przecinku.");
    expect(validateNeedTargetQuantity("100000000")).toBe("Ilość docelowa jest zbyt duża.");
    expect(validateNeedTargetQuantity("12,5")).toBeUndefined();
  });

  it("validates current quantity against target quantity", () => {
    expect(validateNeedCurrentQuantity("", "10")).toBeUndefined();
    expect(validateNeedCurrentQuantity("-1", "10")).toBe("Ilość bieżąca może mieć maksymalnie 2 miejsca po przecinku.");
    expect(validateNeedCurrentQuantity("10.999", "11")).toBe(
      "Ilość bieżąca może mieć maksymalnie 2 miejsca po przecinku."
    );
    expect(validateNeedCurrentQuantity("15", "10")).toBe("Ilość bieżąca nie może przekraczać ilości docelowej.");
    expect(validateNeedCurrentQuantity("10", "10")).toBeUndefined();
    expect(validateNeedCurrentQuantity("5,5", "10")).toBeUndefined();
  });

  it("validates shopping urls", () => {
    expect(validateNeedShoppingUrl("")).toBeUndefined();
    expect(validateNeedShoppingUrl("https://example.com")).toBeUndefined();
    expect(validateNeedShoppingUrl("http://example.com/oferta")).toBeUndefined();
    expect(validateNeedShoppingUrl("ftp://example.com")).toBe("Podaj poprawny adres URL (http lub https).");
    expect(validateNeedShoppingUrl("to-nie-jest-url")).toBe("Podaj prawidłowy adres URL.");
  });

  it("returns no errors for a valid form and detects invalid forms", () => {
    const validResult = validateNeedForm({
      category: "food",
      title: "Karma premium",
      description: "Potrzebujemy karmy dla psow.",
      shopping_url: "https://example.com/karma",
      urgency: "normal",
      target_quantity: "12",
      current_quantity: "3",
      unit: "pcs",
    });

    expect(hasNeedFormErrors(validResult)).toBe(false);
    expect(validResult).toEqual({
      category: undefined,
      title: undefined,
      description: undefined,
      shopping_url: undefined,
      urgency: undefined,
      target_quantity: undefined,
      current_quantity: undefined,
      unit: undefined,
    });

    const invalidResult = validateNeedForm({
      category: "",
      title: "ab",
      description: "x".repeat(2001),
      shopping_url: "zly-url",
      urgency: "normal",
      target_quantity: "0",
      current_quantity: "5",
      unit: "",
    });

    expect(hasNeedFormErrors(invalidResult)).toBe(true);
    expect(invalidResult.category).toBe("Wybierz kategorię.");
    expect(invalidResult.title).toBe("Tytuł musi mieć od 3 do 255 znaków.");
    expect(invalidResult.description).toBe("Opis nie może przekraczać 2000 znaków.");
    expect(invalidResult.shopping_url).toBe("Podaj prawidłowy adres URL.");
    expect(invalidResult.target_quantity).toBe("Ilość docelowa musi być liczbą większą od 0.");
    expect(invalidResult.current_quantity).toBe("Ilość bieżąca nie może przekraczać ilości docelowej.");
    expect(invalidResult.unit).toBe("Wybierz jednostkę.");
  });
});
