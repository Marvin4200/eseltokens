import { timingSafeEqual } from 'crypto';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export const ACTIVE_ROLES = ['member', 'moderator', 'admin'];

export function methodAllowed(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods);
  res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  return false;
}

export async function requireSession(req, res, roles = ACTIVE_ROLES) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (roles && !roles.includes(session.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return session;
}

export function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

export function parseTokenAmount(value, name = 'amount', max = 100000) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > max) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return amount;
}

export function parseNonNegativeInt(value, name, max = 1000000000) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max) {
    const err = new Error(`Invalid ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return number;
}

// Gemeinsamer Guard fuer alle server-zu-server Integrations-Endpunkte (kein Discord-Login,
// sondern ein geteiltes Bearer-Secret aus einer Env-Variable). Zeitkonstanter Vergleich statt
// simplem "!==", sonst kann ein Angreifer das Secret Byte fuer Byte per Timing-Unterschied
// erraten (siehe Changelog 2026-09-05, dieselbe Haertung wurde dort schon fuer andere Stellen
// gemacht -- diese hier hatten sie noch nicht bekommen).
export function requireIntegrationSecret(req, res, envVarNames, errorMessage) {
  const names = Array.isArray(envVarNames) ? envVarNames : [envVarNames];
  let expected = '';
  for (const name of names) {
    expected = (process.env[name] || '').trim();
    if (expected) break;
  }
  if (!expected) {
    res.status(503).json({ error: errorMessage || `${names.join(' / ')} ist nicht konfiguriert` });
    return false;
  }
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  const valid = tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf);
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function sendApiError(res, error, fallback = 'Internal server error') {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  res.status(status).json({ error: error?.message || fallback });
}
