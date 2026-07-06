const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("my_store_token");
};

export const api = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new Error(data.message || "API request failed");
  }

  return data;
};
