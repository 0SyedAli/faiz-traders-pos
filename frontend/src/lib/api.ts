const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("my_store_token");
};

export const clearLocalSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("my_store_token");
  localStorage.removeItem("my_store_admin");
  window.dispatchEvent(new CustomEvent("my-store-auth-changed"));
};

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export const api = async <T = any>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = getToken();
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new ApiRequestError(0, "Server is unreachable. Check backend or internet connection.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.success === false) {
    if (res.status === 401 && path !== "/auth/login") {
      clearLocalSession();
    }
    throw new ApiRequestError(res.status, data.message || "API request failed");
  }

  return data;
};
