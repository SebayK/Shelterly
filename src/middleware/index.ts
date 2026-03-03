import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../db/database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const onRequest = defineMiddleware(async (context, next) => {
  // Generate a correlation id for this request for easier tracing in logs
  const correlationId =
    (globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  context.locals.correlation_id = correlationId;

  // Expose correlation id to downstream handlers via response header when possible
  context.request.headers.set?.("x-correlation-id", correlationId as string);

  // Create Supabase SSR client with automatic cookie management
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(key) {
        return context.cookies.get(key)?.value;
      },
      set(key, value, options) {
        context.cookies.set(key, value, options);
      },
      remove(key, options) {
        context.cookies.delete(key, options);
      },
    },
  });

  // Attach the client to locals for use in routes and API endpoints
  context.locals.supabase = supabase;

  // Process the response to ensure cookies are set properly
  const response = await next();
  return response;
});
