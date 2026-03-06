import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type {
  AIGenerateDescriptionResponseDTO,
  AIGenerateShoppingLinkResponseDTO,
  ErrorResponse,
  GenerateDescriptionCommand,
  GenerateShoppingLinkCommand,
} from "@/types";
import { fetchWithTimeout, redirectToDashboardLogin } from "./request.helpers";
import type { AIGenerateButtonProps } from "./types";

const AI_TIMEOUT_MS = 20_000;

function mapAiError(errorData: ErrorResponse, type: AIGenerateButtonProps["type"]): string {
  switch (errorData.error.code) {
    case "UNAUTHORIZED":
      return "Sesja wygasła. Zaloguj się ponownie.";
    case "FORBIDDEN":
      return type === "description"
        ? "Nie udało się wygenerować opisu AI dla tej potrzeby."
        : "Nie udało się wygenerować linku zakupowego AI.";
    case "NOT_FOUND":
      return "Najpierw zapisz potrzebę, aby użyć generowania AI.";
    case "RATE_LIMIT_EXCEEDED":
      return "Zbyt wiele prób generowania AI. Spróbuj ponownie za chwilę.";
    case "VALIDATION_ERROR":
      return "Brakuje danych wymaganych do generowania AI.";
    default:
      return errorData.error.message || "Generowanie AI nie powiodło się.";
  }
}

export default function AIGenerateButton({
  type,
  needId,
  formData,
  onResult,
  onAiUsageIncremented,
  disabled,
  aiUsageCount,
  aiUsageLimit,
}: AIGenerateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const limitReached = aiUsageCount >= aiUsageLimit;
  const missingCommonData = !needId || !formData.title.trim() || !formData.category;
  const missingDescriptionData = type === "description" && (!formData.target_quantity || !formData.unit);
  const isDisabled = disabled || isLoading || limitReached || missingCommonData || missingDescriptionData;

  const handleClick = async () => {
    if (isDisabled || !needId || !formData.category) {
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = type === "description" ? "/api/ai/generate-description" : "/api/ai/generate-shopping-link";

      const body: GenerateDescriptionCommand | GenerateShoppingLinkCommand =
        type === "description"
          ? {
              need_id: needId,
              category: formData.category,
              title: formData.title.trim(),
              target_quantity: formData.target_quantity ?? 0,
              unit: formData.unit as GenerateDescriptionCommand["unit"],
            }
          : {
              need_id: needId,
              title: formData.title.trim(),
              category: formData.category,
            };

      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        AI_TIMEOUT_MS
      );

      if (!response.ok) {
        if (response.status === 401) {
          redirectToDashboardLogin();
          return;
        }

        let message = "Generowanie AI nie powiodło się.";
        try {
          const errorData = (await response.json()) as ErrorResponse;
          message = mapAiError(errorData, type);
        } catch {
          message = "Generowanie AI nie powiodło się.";
        }

        throw new Error(message);
      }

      if (type === "description") {
        const data = (await response.json()) as AIGenerateDescriptionResponseDTO;
        onResult(data.description);
        if (data.ai_usage_incremented) {
          onAiUsageIncremented();
        }
        return;
      }

      const data = (await response.json()) as AIGenerateShoppingLinkResponseDTO;
      onResult(data.shopping_url);
      if (data.ai_usage_incremented) {
        onAiUsageIncremented();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.error("Przekroczono czas oczekiwania na odpowiedź AI.");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Generowanie AI nie powiodło się.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isDisabled}>
      {isLoading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
      {type === "description" ? "Generuj opis AI" : "Znajdź produkt AI"}
    </Button>
  );
}
