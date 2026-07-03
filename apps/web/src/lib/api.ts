export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || "/api/v1");

const CSRF_STORAGE_KEY = "abc.csrfToken";
const AUTH_RESET_STORAGE_KEY = "abc.lastAuthReset";

type ApiFetchInit = RequestInit & {
  redirectOnUnauthorized?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;
let resetPromise: Promise<void> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const response = await request(path, init);
  if (response.status === 401 && shouldRetryUnauthorized(path, init)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await request(path, { ...init, retryOnUnauthorized: false });
      if (retryResponse.ok) return parseSuccess<T>(retryResponse);
      if (retryResponse.status === 401 && init?.redirectOnUnauthorized !== false) await redirectToLoginAfterSessionReset();
      await throwApiError(retryResponse, "La requete a echoue");
    }
    if (init?.redirectOnUnauthorized !== false) await redirectToLoginAfterSessionReset();
  }

  if (!response.ok) await throwApiError(response, "La requete a echoue");
  const result = await parseSuccess<T>(response);
  if (path === "/auth/logout") clearStoredCsrfToken();
  return result;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await requestUpload(path, body);
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryResponse = await requestUpload(path, body);
      if (retryResponse.ok) return parseSuccess<T>(retryResponse);
      if (retryResponse.status === 401) await redirectToLoginAfterSessionReset();
      await throwApiError(retryResponse, "Le transfert a echoue");
    }
    await redirectToLoginAfterSessionReset();
  }

  if (!response.ok) await throwApiError(response, "Le transfert a echoue");
  return parseSuccess<T>(response);
}

export async function resetClientSession() {
  if (typeof window === "undefined") return;
  resetPromise ??= performClientSessionReset().finally(() => {
    resetPromise = null;
  });
  return resetPromise;
}

async function request(path: string, init?: ApiFetchInit) {
  const { redirectOnUnauthorized: _redirectOnUnauthorized, retryOnUnauthorized: _retryOnUnauthorized, ...fetchInit } = init ?? {};
  void _redirectOnUnauthorized;
  void _retryOnUnauthorized;
  return fetch(createApiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getCsrfHeader(),
      ...fetchInit.headers,
    },
    ...fetchInit,
  });
}

async function requestUpload(path: string, body: FormData) {
  return fetch(createApiUrl(path), {
    body,
    credentials: "include",
    headers: getCsrfHeader(),
    method: "POST",
  });
}

function normalizeApiUrl(url: string) {
  const normalized = url.trim().replace(/\/+$/, "");
  return normalized || "/api/v1";
}

function createApiUrl(path: string) {
  return `${API_URL}/${path.replace(/^\/+/, "")}`;
}

function getCsrfHeader() {
  const cookieToken =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("csrf_token="))
          ?.split("=")[1];
  const csrfToken = cookieToken ? decodeURIComponent(cookieToken) : getStoredCsrfToken();
  return csrfToken ? { "x-csrf-token": csrfToken } : {};
}

function shouldRetryUnauthorized(path: string, init?: ApiFetchInit) {
  if (init?.retryOnUnauthorized === false) return false;
  return ![
    "/auth/login",
    "/auth/logout",
    "/auth/refresh",
    "/auth/clear-session",
    "/auth/password-reset/request",
    "/auth/password-reset/confirm",
  ].includes(path);
}

async function refreshSession() {
  refreshPromise ??= request("/auth/refresh", {
    method: "POST",
    redirectOnUnauthorized: false,
    retryOnUnauthorized: false,
  })
    .then(async (response) => {
      if (!response.ok) return false;
      await parseSuccess(response);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function redirectToLoginAfterSessionReset() {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  await resetClientSession();
  const loginUrl = new URL("/login", window.location.origin);
  loginUrl.searchParams.set("reason", "session-expired");
  loginUrl.searchParams.set("t", Date.now().toString());
  window.location.replace(loginUrl.toString());
}

async function performClientSessionReset() {
  clearStoredCsrfToken();
  storeAuthResetMarker();
  await clearServerSession();
  await clearRuntimeCachesAndServiceWorkers();
}

async function clearServerSession() {
  await fetch(createApiUrl("/auth/clear-session"), {
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => undefined);
}

async function clearRuntimeCachesAndServiceWorkers() {
  const tasks: Promise<unknown>[] = [];

  if ("caches" in window) {
    tasks.push(
      window.caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(shouldDeleteRuntimeCache)
            .map((cacheName) => window.caches.delete(cacheName)),
        ),
      ),
    );
  }

  if ("serviceWorker" in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ),
    );
  }

  await Promise.allSettled(tasks);
}

function shouldDeleteRuntimeCache(cacheName: string) {
  const normalized = cacheName.toLowerCase();
  return normalized.includes("abc-crm") || normalized.includes("serwist") || normalized.includes("workbox");
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  const payload = (await response.json().catch(() => undefined)) as
    | { message?: string; error?: { message?: string } }
    | undefined;
  throw new ApiError(payload?.error?.message ?? payload?.message ?? fallback, response.status);
}

async function parseSuccess<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json()) as T;
  persistCsrfToken(payload);
  return payload;
}

function persistCsrfToken(payload: unknown) {
  const csrfToken =
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "csrfToken" in payload.data &&
    typeof payload.data.csrfToken === "string"
      ? payload.data.csrfToken
      : null;
  if (!csrfToken || typeof window === "undefined") return;
  window.sessionStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
}

function getStoredCsrfToken() {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(CSRF_STORAGE_KEY) ?? undefined;
}

function clearStoredCsrfToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CSRF_STORAGE_KEY);
}

function storeAuthResetMarker() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_RESET_STORAGE_KEY, Date.now().toString());
}
