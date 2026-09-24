export function contentSecurityPolicy(nonce: string) {
  const origins = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_API_URL]
    .flatMap((value) => {
      try {
        const url = new URL(value ?? "");
        return ["https:", "http:"].includes(url.protocol) ? [url.origin] : [];
      } catch { return []; }
    });
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Base UI positioning and existing charts use inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${origins.join(" ")}${dev ? " ws: wss:" : ""}`,
    "img-src 'self' data: blob:", "font-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join("; ");
}
