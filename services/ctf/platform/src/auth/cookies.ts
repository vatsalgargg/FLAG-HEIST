/**
 * HTTP Cookie Helpers & Security Policies
 *
 * Configures hardened session cookies for team and administrator authentication.
 *
 * COOKIE SECURITY ATTRIBUTES EXPLAINED:
 * 1. `httpOnly: true`
 *    Prevents client-side scripts (`document.cookie`) from accessing the session token.
 *    Blocks token-theft attacks even if an XSS vulnerability exists elsewhere on the page.
 *
 * 2. `secure: true` (Conditional for development)
 *    Ensures cookies are transmitted exclusively over encrypted TLS (HTTPS) connections,
 *    preventing eavesdropping on public Wi-Fi networks.
 *    Conditionally relaxed ONLY when `NODE_ENV === 'development'` so local developers can test
 *    over `http://localhost`.
 *
 * 3. `sameSite: "lax"` (Tradeoff vs "strict")
 *    - `strict`: Cookie is NEVER sent in third-party contexts, even when a user clicks a
 *      link from Discord, Slack, or email to visit the CTF site. This breaks login state on incoming links.
 *    - `lax`: Cookie is sent on top-level safe GET navigations (e.g. clicking a link), but
 *      BLOCKED on cross-site subrequests (images, iframes, cross-origin POST requests).
 *      This provides robust CSRF protection without breaking participant UX.
 *
 * 4. `maxAge`: 72 hours (in milliseconds)
 *    Matches the 72-hour competition window.
 */

import { Response, CookieOptions } from 'express';
import { config } from '../config';

export const TEAM_COOKIE_NAME = 'veyra_team_session';
export const ADMIN_COOKIE_NAME = 'veyra_admin_session';

const COOKIE_MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72 hours

function getBaseCookieOptions(): CookieOptions {
  const isProduction = config.nodeEnv === 'production';

  return {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

/**
 * Sets the participant team session cookie on the response.
 */
export function setTeamCookie(res: Response, token: string): void {
  res.cookie(TEAM_COOKIE_NAME, token, {
    ...getBaseCookieOptions(),
    path: '/',
  });
}

/**
 * Clears the participant team session cookie upon logout.
 */
export function clearTeamCookie(res: Response): void {
  const isProduction = config.nodeEnv === 'production';
  res.clearCookie(TEAM_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Sets the administrator session cookie on the response.
 * Kept strictly isolated with a distinct cookie name and path.
 */
export function setAdminCookie(res: Response, token: string): void {
  res.cookie(ADMIN_COOKIE_NAME, token, {
    ...getBaseCookieOptions(),
    path: '/',
  });
}

/**
 * Clears the administrator session cookie upon logout.
 */
export function clearAdminCookie(res: Response): void {
  const isProduction = config.nodeEnv === 'production';
  res.clearCookie(ADMIN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
