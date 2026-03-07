import type { ErrorResponse } from "@/types";

export type NeedMutationAction = "delete" | "fulfill";

export function mapNeedMutationError(errorData: ErrorResponse, action: NeedMutationAction): string {
  switch (errorData.error.code) {
    case "UNAUTHORIZED":
      return "Sesja wygasła. Zaloguj się ponownie.";
    case "ACCOUNT_PENDING":
      return "Twoje konto oczekuje na weryfikację.";
    case "FORBIDDEN":
      return "Nie masz uprawnień do wykonania tej operacji.";
    case "NOT_FOUND":
      return action === "delete"
        ? "Ta potrzeba nie istnieje lub została już usunięta."
        : "Ta potrzeba nie istnieje lub została już zrealizowana.";
    case "RATE_LIMIT_EXCEEDED":
      return "Zbyt wiele prób. Spróbuj ponownie za chwilę.";
    default:
      return errorData.error.message || "Nie udało się wykonać operacji.";
  }
}

export function getNeedMutationSuccessMessage(action: NeedMutationAction, title: string): string {
  return action === "delete"
    ? `Potrzeba "${title}" została usunięta.`
    : `Potrzeba "${title}" została oznaczona jako zrealizowana.`;
}

export function getNeedMutationTimeoutMessage(action: NeedMutationAction): string {
  return action === "delete"
    ? "Przekroczono czas oczekiwania na usunięcie potrzeby."
    : "Przekroczono czas oczekiwania na aktualizację potrzeby.";
}

export function getNeedMutationFallbackError(action: NeedMutationAction): string {
  return action === "delete" ? "Nie udało się usunąć potrzeby." : "Nie udało się oznaczyć potrzeby jako zrealizowanej.";
}

export function getNeedMutationFailureMessage(error: unknown, action: NeedMutationAction): string {
  if (error instanceof Error && error.name === "AbortError") {
    return getNeedMutationTimeoutMessage(action);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return getNeedMutationFallbackError(action);
}
