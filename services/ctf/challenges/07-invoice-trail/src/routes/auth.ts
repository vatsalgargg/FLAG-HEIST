/**
 * Challenge 07 & 08 — Auth Routes
 */

import { Router, Request, Response } from 'express';
import {
  getPriyaUsername,
  getPriyaPassword,
  SESSION_COOKIE_NAME,
  signSession,
  requirePortalAuth,
  PortalUserSession,
} from '../auth';
import { PRIYA_CUSTOMER_ID } from '../db';

const router = Router();

// Handle both /api/auth/login and direct /login
router.post(['/login', '/api/auth/login'], (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ error: 'Bad Request', message: 'Username and password are required' });
    return;
  }

  const expectedUsername = getPriyaUsername();
  const expectedPassword = getPriyaPassword();

  // Exactly ONE seeded participant account exists per spec: priya.nair / Veyra#Audit26
  if (username !== expectedUsername || password !== expectedPassword) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    return;
  }

  const sessionPayload: PortalUserSession = {
    username: expectedUsername,
    name: 'Priya Nair',
    role: 'auditor', // Low-privilege role per spec
    customerId: PRIYA_CUSTOMER_ID,
    issuedAt: Date.now(),
  };

  const sessionCookie = signSession(sessionPayload);

  res.cookie(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    // COOKIE_SECURE=false lets the portal run over plain HTTP (e.g. a TryHackMe machine IP)
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 72 * 60 * 60 * 1000, // 72 hours
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Login successful. Welcome to Veyra Internal Portal.',
    user: {
      username: sessionPayload.username,
      name: sessionPayload.name,
      role: sessionPayload.role,
      customerId: sessionPayload.customerId,
    },
  });
});

// Logout
router.post(['/logout', '/api/auth/logout'], (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Session check
router.get(['/me', '/api/auth/me'], requirePortalAuth, (req: Request, res: Response) => {
  res.status(200).json({
    authenticated: true,
    user: req.portalUser,
  });
});

export default router;
