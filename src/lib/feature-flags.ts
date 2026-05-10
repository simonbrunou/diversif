const BENTO_ALLOW_LIST = new Set<string>(['simon.brunou@proton.me']);

export function bentoEnabled(
  userEmail: string | undefined,
  cookies: Map<string, string> | { get(name: string): string | undefined }
): boolean {
  const cookieGet = (name: string): string | undefined =>
    cookies instanceof Map ? cookies.get(name) : cookies.get(name);

  if (cookieGet('bento') === '1') return true;
  if (!userEmail) return false;
  return BENTO_ALLOW_LIST.has(userEmail.toLowerCase());
}
