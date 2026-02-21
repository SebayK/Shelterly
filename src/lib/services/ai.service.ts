/**
 * AI Service
 * Handles AI-powered description generation for shelter needs
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type { AIGenerateDescriptionResponseDTO, GenerateDescriptionCommand } from "@/types";
import { APP_CONFIG } from "@/lib/config";
import { ForbiddenError, InternalError, NotFoundError, logErrorWithContext } from "@/lib/errors";

interface OpenRouterChatCompletionResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

export class AIService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Generates and persists an AI description for an existing need.
   * Also increments profile AI usage counter as a best-effort step.
   */
  async generateNeedDescription(
    command: GenerateDescriptionCommand,
    userId: string
  ): Promise<AIGenerateDescriptionResponseDTO> {
    const { data: need, error: needError } = await this.supabase
      .from("needs")
      .select("id, shelter_id")
      .eq("id", command.need_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (needError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateNeedDescription",
          user_id: userId,
          request_body: { need_id: command.need_id },
          constraint: (needError as { code?: string }).code,
        },
        needError
      );
      throw new InternalError("Unable to retrieve need");
    }

    if (!need) {
      throw new NotFoundError("Need not found or deleted");
    }

    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("ai_usage_count")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateNeedDescription",
          user_id: userId,
          request_body: { need_id: command.need_id },
          constraint: (profileError as { code?: string }).code,
        },
        profileError
      );
      throw new InternalError("Unable to retrieve profile");
    }

    if (!profile) {
      throw new NotFoundError("Profile not found");
    }

    if (profile.ai_usage_count >= APP_CONFIG.AI.USAGE_LIMIT) {
      throw new ForbiddenError("AI usage limit exceeded");
    }

    const description = await this.callOpenRouter(command);

    const { error: updateNeedError } = await this.supabase
      .from("needs")
      .update({ description, updated_at: new Date().toISOString() })
      .eq("id", command.need_id)
      .is("deleted_at", null);

    if (updateNeedError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateNeedDescription",
          user_id: userId,
          shelter_id: need.shelter_id,
          request_body: { need_id: command.need_id },
          constraint: (updateNeedError as { code?: string }).code,
        },
        updateNeedError
      );
      throw new InternalError("Failed to save generated description");
    }

    const { error: incrementError } = await this.supabase
      .from("profiles")
      .update({ ai_usage_count: profile.ai_usage_count + 1 })
      .eq("id", userId);

    if (incrementError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateNeedDescription",
          user_id: userId,
          shelter_id: need.shelter_id,
          request_body: { need_id: command.need_id },
          constraint: (incrementError as { code?: string }).code,
        },
        incrementError
      );
    }

    return {
      description,
      ai_usage_incremented: !incrementError,
    };
  }

  private async callOpenRouter(command: GenerateDescriptionCommand): Promise<string> {
    const prompt = this.buildPrompt(command);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.AI.TIMEOUT_MS);

    const baseUrl = import.meta.env.OPENROUTER_BASE_URL ?? APP_CONFIG.AI.OPENROUTER_BASE_URL;

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://shelterly.pl",
          "X-Title": "Shelterly",
        },
        body: JSON.stringify({
          model: APP_CONFIG.AI.DESCRIPTION_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Jesteś asystentem pomagającym schroniskom dla zwierząt w Polsce pisać opisy potrzeb. " +
                "Pisz krótko i empatycznie po polsku. Tylko czysty tekst, bez markdown i bez HTML.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new InternalError(`OpenRouter returned status ${response.status}`);
      }

      const data = (await response.json()) as OpenRouterChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new InternalError("Empty response from AI service");
      }

      return content;
    } catch (error) {
      if (error instanceof InternalError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new InternalError("AI service request timed out");
      }

      throw new InternalError("Failed to generate description using AI service");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildPrompt(command: GenerateDescriptionCommand): string {
    return [
      "Napisz krótki, przekonujący opis po polsku (2-3 zdania) dla następującej potrzeby schroniska:",
      `- Kategoria: ${command.category}`,
      `- Tytuł: ${command.title}`,
      `- Ilość: ${command.target_quantity} ${command.unit}`,
      "",
      "Opis powinien być empatyczny, zachęcać do pomocy i skupiać się na dobrostanie zwierząt.",
      "Nie używaj tagów HTML ani markdown. Tylko czysty tekst.",
    ].join("\n");
  }
}
