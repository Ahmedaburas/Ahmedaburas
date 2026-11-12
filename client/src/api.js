import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError("The HSE service is not running.", 0);
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 200) };
    }
  }
  if (!response.ok) throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  return data;
}

export const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: "POST", body: JSON.stringify(body) }),
};

export function useFetch(url) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const reload = useCallback(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: "" }));
    api
      .get(url)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (!cancelled) setState((current) => ({ loading: false, error: error.message, data: current.data }));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}
