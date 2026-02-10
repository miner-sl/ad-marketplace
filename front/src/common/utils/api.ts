import {getToken} from "./token";
import {API_BASE_URL} from "../../services/url";

export const requestAPI = async (
  path = "/",
  params: { [key: string]: string | Blob | undefined } = {},
  method: "GET" | "POST" = "POST",
  timeoutMs = 30_000,
): Promise<any> => {
  try {
    const headers: { [key: string]: string } = {};

    const FD = new FormData();
    for (const [key, item] of Object.entries(params)) {
      if (item) {
        FD.append(key, item);
      }
    }
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    headers.locale = "en";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const request = await fetch(API_BASE_URL + path, {
      method: method,
      body: method === "POST" ? FD : undefined,
      headers: headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const result = await request.json();

    if (result.status === "success") {
      return result;
    }
    return false;
  } catch (_) {
    return null;
  }
};
