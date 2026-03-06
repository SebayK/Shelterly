import type { NeedCategory, NeedUnit, UrgencyLevel } from "@/types";

export interface NeedFormValidationData {
  category: NeedCategory | "";
  title: string;
  description: string;
  shopping_url: string;
  urgency: UrgencyLevel;
  target_quantity: string;
  current_quantity: string;
  unit: NeedUnit | "";
}

export interface NeedFormValidationErrors {
  category?: string;
  title?: string;
  description?: string;
  shopping_url?: string;
  urgency?: string;
  target_quantity?: string;
  current_quantity?: string;
  unit?: string;
}

export type NeedFormFieldName = keyof NeedFormValidationErrors;
export type NeedFormMode = "create" | "edit";

const MAX_QUANTITY = 99_999_999.99;
const TWO_DECIMALS_REGEX = /^\d+(\.\d{1,2})?$/;

function parseQuantity(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function validateNeedCategory(value: NeedCategory | ""): string | undefined {
  if (!value) {
    return "Wybierz kategorię.";
  }

  return undefined;
}

export function validateNeedTitle(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return "Tytuł jest wymagany.";
  }
  if (normalized.length < 3 || normalized.length > 255) {
    return "Tytuł musi mieć od 3 do 255 znaków.";
  }

  return undefined;
}

export function validateNeedDescription(value: string): string | undefined {
  if (value.trim().length > 2000) {
    return "Opis nie może przekraczać 2000 znaków.";
  }

  return undefined;
}

export function validateNeedShoppingUrl(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Podaj poprawny adres URL (http lub https).";
    }

    return undefined;
  } catch {
    return "Podaj prawidłowy adres URL.";
  }
}

export function validateNeedUrgency(value: UrgencyLevel): string | undefined {
  if (!value) {
    return "Wybierz poziom pilności.";
  }

  return undefined;
}

export function validateNeedTargetQuantity(value: string): string | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return "Ilość docelowa jest wymagana.";
  }
  if (!TWO_DECIMALS_REGEX.test(normalized)) {
    return "Ilość docelowa może mieć maksymalnie 2 miejsca po przecinku.";
  }

  const parsed = parseQuantity(normalized);
  if (parsed === null || parsed <= 0) {
    return "Ilość docelowa musi być liczbą większą od 0.";
  }
  if (parsed > MAX_QUANTITY) {
    return "Ilość docelowa jest zbyt duża.";
  }

  return undefined;
}

export function validateNeedCurrentQuantity(value: string, targetQuantityValue: string): string | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return undefined;
  }
  if (!TWO_DECIMALS_REGEX.test(normalized)) {
    return "Ilość bieżąca może mieć maksymalnie 2 miejsca po przecinku.";
  }

  const currentQuantity = parseQuantity(normalized);
  if (currentQuantity === null || currentQuantity < 0) {
    return "Ilość bieżąca nie może być ujemna.";
  }
  if (currentQuantity > MAX_QUANTITY) {
    return "Ilość bieżąca jest zbyt duża.";
  }

  const targetQuantity = parseQuantity(targetQuantityValue.replace(",", "."));
  if (targetQuantity !== null && currentQuantity > targetQuantity) {
    return "Ilość bieżąca nie może przekraczać ilości docelowej.";
  }

  return undefined;
}

export function validateNeedUnit(value: NeedUnit | ""): string | undefined {
  if (!value) {
    return "Wybierz jednostkę.";
  }

  return undefined;
}

export function validateNeedField(field: NeedFormFieldName, data: NeedFormValidationData): string | undefined {
  switch (field) {
    case "category":
      return validateNeedCategory(data.category);
    case "title":
      return validateNeedTitle(data.title);
    case "description":
      return validateNeedDescription(data.description);
    case "shopping_url":
      return validateNeedShoppingUrl(data.shopping_url);
    case "urgency":
      return validateNeedUrgency(data.urgency);
    case "target_quantity":
      return validateNeedTargetQuantity(data.target_quantity);
    case "current_quantity":
      return validateNeedCurrentQuantity(data.current_quantity, data.target_quantity);
    case "unit":
      return validateNeedUnit(data.unit);
    default:
      return undefined;
  }
}

export function validateNeedForm(data: NeedFormValidationData): NeedFormValidationErrors {
  return {
    category: validateNeedField("category", data),
    title: validateNeedField("title", data),
    description: validateNeedField("description", data),
    shopping_url: validateNeedField("shopping_url", data),
    urgency: validateNeedField("urgency", data),
    target_quantity: validateNeedField("target_quantity", data),
    current_quantity: validateNeedField("current_quantity", data),
    unit: validateNeedField("unit", data),
  };
}

export function hasNeedFormErrors(errors: NeedFormValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}
