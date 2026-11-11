export function isAllowedPlatformOrigin(
  origin: string,
  configuredOrigin: string,
  production: boolean,
  forwardedHost?: string,
): boolean {
  if (origin === configuredOrigin) return true;
  if (production) return false;

  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) return false;
    // Development previews can use another local port or the app's reverse proxy host.
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.host === forwardedHost;
  } catch {
    return false;
  }
}
