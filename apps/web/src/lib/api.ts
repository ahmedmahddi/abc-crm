export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("csrf_token="))
          ?.split("=")[1];

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { message?: string; error?: { message?: string } }
      | undefined;
    throw new ApiError(payload?.error?.message ?? payload?.message ?? "La requête a échoué", response.status);
  }

  return response.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const csrfToken =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split("; ")
          .find((cookie) => cookie.startsWith("csrf_token="))
          ?.split("=")[1];
  const response = await fetch(`${API_URL}${path}`, {
    body,
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {},
    method: "POST",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as { message?: string } | undefined;
    throw new ApiError(payload?.message ?? "Le transfert a échoué", response.status);
  }
  return response.json() as Promise<T>;
}
