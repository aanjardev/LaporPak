export function safeReturnPath(value: unknown) {
  return typeof value === "string" && /^\/reports(?:\/|$|\?)/.test(value) && !value.includes("\\")
    ? value
    : "/reports";
}
