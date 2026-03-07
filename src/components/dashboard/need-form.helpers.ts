import type {
  CreateNeedCommand,
  ErrorDetail,
  ErrorResponse,
  NeedCategory,
  NeedCreateResponseDTO,
  NeedDetailDTO,
  NeedUnit,
  UpdateNeedCommand,
  UrgencyLevel,
} from "@/types";

import type { NeedFormData } from "./types";
import type { NeedFormValidationData, NeedFormValidationErrors } from "@/lib/validation/need-form.schemas";

const SUPPORTED_NEED_FORM_ERROR_FIELDS = [
  "category",
  "title",
  "description",
  "shopping_url",
  "urgency",
  "target_quantity",
  "current_quantity",
  "unit",
] as const satisfies readonly (keyof NeedFormValidationErrors)[];

export const NEED_CATEGORY_OPTIONS: { value: NeedCategory; label: string }[] = [
  { value: "food", label: "Żywność" },
  { value: "textiles", label: "Tekstylia" },
  { value: "cleaning", label: "Środki czystości" },
  { value: "medical", label: "Medyczne" },
  { value: "toys", label: "Zabawki" },
  { value: "other", label: "Inne" },
];

export const NEED_URGENCY_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: "low", label: "Niska" },
  { value: "normal", label: "Normalna" },
  { value: "high", label: "Wysoka" },
  { value: "urgent", label: "Pilna" },
  { value: "critical", label: "Krytyczna" },
];

export const NEED_UNIT_OPTIONS: { value: NeedUnit; label: string }[] = [
  { value: "pcs", label: "szt." },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "l", label: "l" },
  { value: "ml", label: "ml" },
  { value: "pack", label: "opak." },
];

export function createEmptyNeedForm(): NeedFormData {
  return {
    category: "",
    title: "",
    description: "",
    shopping_url: "",
    urgency: "normal",
    target_quantity: "",
    current_quantity: "",
    unit: "",
  };
}

export function mapNeedDetailToForm(detail: NeedDetailDTO): NeedFormData {
  return {
    category: detail.category,
    title: detail.title,
    description: detail.description ?? "",
    shopping_url: detail.shopping_url ?? "",
    urgency: detail.urgency,
    target_quantity: String(detail.target_quantity),
    current_quantity: String(detail.current_quantity),
    unit: detail.unit,
  };
}

export function mapCreateResponseToForm(detail: NeedCreateResponseDTO): NeedFormData {
  return {
    category: detail.category,
    title: detail.title,
    description: detail.description ?? "",
    shopping_url: detail.shopping_url ?? "",
    urgency: detail.urgency,
    target_quantity: String(detail.target_quantity),
    current_quantity: String(detail.current_quantity),
    unit: detail.unit,
  };
}

export function normalizeNeedFormData(data: NeedFormData): NeedFormValidationData {
  return {
    category: data.category,
    title: data.title,
    description: data.description,
    shopping_url: data.shopping_url,
    urgency: data.urgency,
    target_quantity: data.target_quantity,
    current_quantity: data.current_quantity,
    unit: data.unit,
  };
}

export function mapNeedFormApiError(errorData: ErrorResponse): string {
  switch (errorData.error.code) {
    case "UNAUTHORIZED":
      return "Sesja wygasła. Zaloguj się ponownie.";
    case "FORBIDDEN":
      return "Nie masz uprawnień do modyfikowania tej potrzeby.";
    case "ACCOUNT_PENDING":
      return "Twoje konto oczekuje na weryfikację.";
    case "RATE_LIMIT_EXCEEDED":
      return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
    case "NOT_FOUND":
      return "Nie znaleziono potrzeby do edycji.";
    case "VALIDATION_ERROR":
      return "Sprawdź formularz i popraw oznaczone pola.";
    default:
      return errorData.error.message || "Nie udało się zapisać potrzeby.";
  }
}

export function mapNeedFormErrorDetails(details: ErrorDetail[] | undefined): NeedFormValidationErrors {
  if (!details) {
    return {};
  }

  return details.reduce<NeedFormValidationErrors>((accumulator, detail) => {
    const fieldName = detail.field as keyof NeedFormValidationErrors;
    if (!(fieldName in accumulator) && SUPPORTED_NEED_FORM_ERROR_FIELDS.includes(fieldName)) {
      accumulator[fieldName] = detail.message;
    }
    return accumulator;
  }, {});
}

export function buildCreateNeedCommand(formData: NeedFormData): CreateNeedCommand {
  return {
    category: formData.category as NeedCategory,
    title: formData.title.trim(),
    description: formData.description.trim() || null,
    shopping_url: formData.shopping_url.trim() || null,
    urgency: formData.urgency,
    target_quantity: Number(formData.target_quantity.replace(",", ".")),
    unit: formData.unit as NeedUnit,
  };
}

export function buildUpdateNeedCommand(formData: NeedFormData, initialData: NeedFormData): UpdateNeedCommand {
  const command: UpdateNeedCommand = {};

  if (formData.category !== initialData.category) {
    command.category = formData.category as NeedCategory;
  }
  if (formData.title.trim() !== initialData.title.trim()) {
    command.title = formData.title.trim();
  }
  if (formData.description.trim() !== initialData.description.trim()) {
    command.description = formData.description.trim() || null;
  }
  if (formData.shopping_url.trim() !== initialData.shopping_url.trim()) {
    command.shopping_url = formData.shopping_url.trim() || null;
  }
  if (formData.urgency !== initialData.urgency) {
    command.urgency = formData.urgency;
  }
  if (formData.target_quantity.trim() !== initialData.target_quantity.trim()) {
    command.target_quantity = Number(formData.target_quantity.replace(",", "."));
  }
  if (formData.current_quantity.trim() !== initialData.current_quantity.trim()) {
    command.current_quantity = Number(formData.current_quantity.replace(",", "."));
  }
  if (formData.unit !== initialData.unit) {
    command.unit = formData.unit as NeedUnit;
  }

  return command;
}
