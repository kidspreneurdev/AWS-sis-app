import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.STUDENT_PORTAL_TOKEN_SECRET
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours

function b64url(input) {
  return Buffer.from(input).toString('base64url')
}

function sign(payloadB64) {
  return createHmac('sha256', SECRET).update(payloadB64).digest('base64url')
}

/**
 * Issues a signed token binding a browser session to a specific student DB row.
 * Format: base64url(json payload) + '.' + base64url(hmac-sha256 signature)
 * Deliberately hand-rolled (not a JWT library) since only {studentDbId, exp} need signing.
 */
export function issueStudentToken(studentDbId, ttlMs = DEFAULT_TTL_MS) {
  if (!SECRET) throw new Error('STUDENT_PORTAL_TOKEN_SECRET is not configured on the server.')
  const payload = { studentDbId, exp: Date.now() + ttlMs }
  const payloadB64 = b64url(JSON.stringify(payload))
  const sig = sign(payloadB64)
  return `${payloadB64}.${sig}`
}

/**
 * Verifies a token's signature and expiry. Returns the verified studentDbId,
 * or throws. Callers must use this returned value as the source of truth for
 * studentDbId — never a client-supplied field in the request body — since the
 * whole point of this token is to make studentDbId unforgeable.
 */
export function verifyStudentToken(token) {
  if (!SECRET) throw new Error('STUDENT_PORTAL_TOKEN_SECRET is not configured on the server.')
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Malformed token.')
  }
  const [payloadB64, sig] = token.split('.')
  const expectedSig = sign(payloadB64)

  const sigBuf = Buffer.from(sig ?? '', 'base64url')
  const expectedBuf = Buffer.from(expectedSig, 'base64url')
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid token signature.')
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Malformed token payload.')
  }

  if (typeof payload.studentDbId !== 'string' || typeof payload.exp !== 'number') {
    throw new Error('Malformed token payload.')
  }
  if (Date.now() > payload.exp) {
    throw new Error('Token expired.')
  }

  return payload.studentDbId
}

/** Extracts and verifies the bearer token from a request; sends 401 and returns null on failure. */
export function requireStudentToken(req, res, json) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    json(res, 401, { error: 'Missing authorization token.' })
    return null
  }
  try {
    return verifyStudentToken(token)
  } catch (err) {
    json(res, 401, { error: err.message || 'Invalid or expired session.' })
    return null
  }
}
