const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export const DASHBOARD_LOGIN_REDIRECT = "/auth/login?return=/dashboard";

export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    window.clearTimeout(timerId);
  });
}

export function redirectToDashboardLogin() {
  window.location.href = DASHBOARD_LOGIN_REDIRECT;
}
