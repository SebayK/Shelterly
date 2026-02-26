/**
 * AI Service
 * Handles AI-powered description generation for shelter needs
 */

import type { SupabaseClient } from "@/db/supabase.client";
import type {
  AIGenerateDescriptionResponseDTO,
  AIGenerateShoppingLinkResponseDTO,
  GenerateDescriptionCommand,
  GenerateShoppingLinkCommand,
} from "@/types";
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

    // Increment the counter BEFORE calling AI to prevent the race condition where two
    // concurrent requests both pass the limit check and both consume a generation slot.
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
      throw new InternalError("Unable to update AI usage counter");
    }

    let description: string;
    try {
      description = await this.callOpenRouter(command);
    } catch (aiError) {
      // Best-effort rollback on AI failure so the slot is not wasted
      await this.supabase.from("profiles").update({ ai_usage_count: profile.ai_usage_count }).eq("id", userId);
      throw aiError;
    }

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

    return {
      description,
      ai_usage_incremented: true,
    };
  }

  /**
   * Generates and persists a shopping link URL for an existing need.
   * Also increments profile AI usage counter as a best-effort step.
   */
  async generateShoppingLink(
    command: GenerateShoppingLinkCommand,
    userId: string
  ): Promise<AIGenerateShoppingLinkResponseDTO> {
    // 1. Verify need exists, is not soft-deleted
    const { data: need, error: needError } = await this.supabase
      .from("needs")
      .select("id, shelter_id")
      .eq("id", command.need_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (needError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateShoppingLink",
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

    // 2. Verify ownership
    if (need.shelter_id !== userId) {
      throw new ForbiddenError("You are not the owner of this need");
    }

    // 3. Fetch profile and check AI usage limit
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("ai_usage_count")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateShoppingLink",
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

    // Increment the counter BEFORE calling AI to prevent race conditions
    const { error: incrementError } = await this.supabase
      .from("profiles")
      .update({ ai_usage_count: profile.ai_usage_count + 1 })
      .eq("id", userId);

    if (incrementError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateShoppingLink",
          user_id: userId,
          shelter_id: need.shelter_id,
          request_body: { need_id: command.need_id },
          constraint: (incrementError as { code?: string }).code,
        },
        incrementError
      );
      throw new InternalError("Unable to update AI usage counter");
    }

    // 4. Call AI to generate shopping URL
    let shoppingUrl: string;
    try {
      shoppingUrl = await this.callOpenRouterForShoppingLink(command);
    } catch (aiError) {
      // Best-effort rollback on AI failure
      await this.supabase.from("profiles").update({ ai_usage_count: profile.ai_usage_count }).eq("id", userId);
      throw aiError;
    }

    // 5. Validate the returned URL
    if (!shoppingUrl.startsWith("https://")) {
      // Rollback the counter since we won't actually produce a usable result
      await this.supabase.from("profiles").update({ ai_usage_count: profile.ai_usage_count }).eq("id", userId);
      throw new InternalError("AI returned an invalid shopping URL");
    }

    // 6. Persist shopping_url on the need
    const { error: updateNeedError } = await this.supabase
      .from("needs")
      .update({ shopping_url: shoppingUrl, updated_at: new Date().toISOString() })
      .eq("id", command.need_id)
      .is("deleted_at", null);

    if (updateNeedError) {
      logErrorWithContext(
        {
          endpoint: "AIService.generateShoppingLink",
          user_id: userId,
          shelter_id: need.shelter_id,
          request_body: { need_id: command.need_id },
          constraint: (updateNeedError as { code?: string }).code,
        },
        updateNeedError
      );
      throw new InternalError("Failed to save generated shopping URL");
    }

    return {
      shopping_url: shoppingUrl,
      ai_usage_incremented: true,
    };
  }

  private async callOpenRouterForShoppingLink(command: GenerateShoppingLinkCommand): Promise<string> {
    const prompt = this.buildShoppingLinkPrompt(command);
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
          model: APP_CONFIG.AI.SHOPPING_LINK_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Jesteś asystentem pomagającym schroniskom dla zwierząt w Polsce znaleźć produkty online. " +
                "Zwróć TYLKO jeden URL (bez żadnego innego tekstu), kierujący do wyników wyszukiwania produktu " +
                "na Ceneo.pl lub Allegro.pl dla podanej potrzeby schroniska. " +
                "Format URL dla Ceneo: https://www.ceneo.pl/search?q=<zakodowane_słowa_kluczowe> " +
                "Zwróć wyłącznie URL — żadnych wyjaśnień, żadnego markdown.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 100,
          temperature: 0.3,
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

      throw new InternalError("Failed to generate shopping link using AI service");
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildShoppingLinkPrompt(command: GenerateShoppingLinkCommand): string {
    // Sanitize user-controlled input to prevent prompt injection via newlines / control chars
    const safeTitle = command.title.replace(/[\r\n\t]/g, " ").trim();
    return ["Kategoria: " + command.category, "Tytuł potrzeby: " + safeTitle].join("\n");
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
    // Sanitize user-controlled input to prevent prompt injection via newlines / control chars
    const safeTitle = command.title.replace(/[\r\n\t]/g, " ").trim();
    return [
      "Napisz krótki, przekonujący opis po polsku (2-3 zdania) dla następującej potrzeby schroniska:",
      `- Kategoria: ${command.category}`,
      `- Tytuł: ${safeTitle}`,
      `- Ilość: ${command.target_quantity} ${command.unit}`,
      "",
      "Opis powinien być empatyczny, zachęcać do pomocy i skupiać się na dobrostanie zwierząt.",
      "Nie używaj tagów HTML ani markdown. Tylko czysty tekst.",
    ].join("\n");
  }
}
