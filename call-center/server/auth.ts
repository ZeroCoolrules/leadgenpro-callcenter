// Password protection for the dashboard.
//
// Set ADMIN_PASSWORD and the browser asks for it before showing the dashboard
// or any /api route (username: "admin", or ADMIN_USER). Twilio webhooks and the
// health check stay open; webhooks are protected by Twilio's signature instead.
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const USER = process.env.ADMIN_USER || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || '';

export function adminPasswordSet() {
  return !!PASSWORD;
}

function same(a: string, b: string) {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

const OPEN_PATHS = [/^\/api\/webhooks\//, /^\/api\/health$/];

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  if (!PASSWORD || OPEN_PATHS.some(r => r.test(req.path))) return next();
  const header = req.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    const [user, ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
    if (same(user, USER) && same(rest.join(':'), PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Call AI Center", charset="UTF-8"');
  res.status(401).send('Password required');
}
