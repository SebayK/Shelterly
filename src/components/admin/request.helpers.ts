const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export const ADMIN_LOGIN_REDIRECT = "/auth/login?return=/admin";
export const ADMIN_FORBIDDEN_REDIRECT = "/dashboard";

export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = options.signal;

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  const timerId = window.setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    window.clearTimeout(timerId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  });
}

export function redirectToAdminLogin() {
  window.location.href = ADMIN_LOGIN_REDIRECT;
}

export function redirectToAdminDashboard() {
  window.location.href = ADMIN_FORBIDDEN_REDIRECT;
}
