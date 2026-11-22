/** Read the JSON contract of an internal API and preserve server error messages. */
export async function readApiResponse<T = unknown>(response: Response, fallback: string): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      && typeof body.error === "string" && body.error ? body.error : fallback;
    throw new Error(message);
  }
  return body as T;
}
