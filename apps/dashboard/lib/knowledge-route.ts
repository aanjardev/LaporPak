export const knowledgeSettingsPath = "/reports/settings/knowledge";

export function knowledgeDetailPath(id: string) {
  return `${knowledgeSettingsPath}/${encodeURIComponent(id)}`;
}

export function legacyKnowledgeRedirect(
  id: string | null,
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  for (const key of ["saved", "deleted", "reviewed", "error"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const path = id ? knowledgeDetailPath(id) : knowledgeSettingsPath;
  return query.size ? `${path}?${query}` : path;
}
