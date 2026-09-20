export function safeReturnPath(value: unknown) {
  return typeof value === "string" && /^\/(?:reports|admin|onboarding)(?:\/|$|\?)/.test(value) && !value.includes("\\")
    ? value
    : "/";
}
