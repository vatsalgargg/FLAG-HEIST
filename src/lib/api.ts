export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    cache: [
      "/leaderboard",
      "/leaderboard/status",
      "/announcements",
      "/stats/solves",
    ].includes(path)
      ? "default"
      : "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.message ||
        "The competition service is unavailable. Please try again.",
      response.status,
    );
  return data as T;
}
