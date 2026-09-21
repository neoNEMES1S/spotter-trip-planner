export class ApiError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Cannot reach the planner. Check your connection and try again.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.error ||
        `Request failed (${response.status}). Refresh and try again.`,
      data?.fields,
    );
  if (!data) throw new ApiError("The server returned an unexpected response.");
  return data as T;
}
