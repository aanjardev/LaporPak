export function internalNavigationTarget(currentHref: string, targetHref: string) {
  const current = new URL(currentHref);
  const target = new URL(targetHref, current);
  if (target.origin !== current.origin) return null;
  const next = `${target.pathname}${target.search}${target.hash}`;
  return next === `${current.pathname}${current.search}${current.hash}` ? null : next;
}
