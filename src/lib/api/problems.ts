/** Extracts a human-readable message from a Glyph API problem document or SDK error. */
export function apiErrorMessage(error: unknown, status?: number): string {
  if (error && typeof error === "object") {
    const problem = error as { detail?: unknown; title?: unknown; message?: unknown };
    if (typeof problem.detail === "string" && problem.detail) return problem.detail;
    if (typeof problem.title === "string" && problem.title) return problem.title;
    if (typeof problem.message === "string" && problem.message) return problem.message;
  }
  if (typeof error === "string" && error) return error;
  return status ? `Glyph API request failed (${status})` : "Glyph API request failed";
}
