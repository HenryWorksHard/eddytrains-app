#!/usr/bin/env node
// App Store Connect API client.
//
// WHY THIS EXISTS. Apple's API authenticates with a short-lived ES256 JWT
// signed by a .p8 private key, not a bearer token you can curl directly. That
// is about fifteen lines of crypto that would otherwise be retyped at every
// call site, so it lives here once and everything else is a plain request.
//
// No dependencies on purpose. Node's crypto can do ES256, and adding a JWT
// library to a public repo's dependency tree for one function is not worth the
// supply-chain surface.
//
// CREDENTIALS come from the environment, never from this file. The repo is
// public. Set them in .env.local (gitignored) or export them:
//   ASC_ISSUER_ID   the UUID from App Store Connect > Users and Access
//   ASC_KEY_ID      the 10-character key id
//   ASC_KEY_PATH    path to AuthKey_<KEY_ID>.p8  (default: ~/.appstoreconnect/private_keys)
//
// USAGE
//   node scripts/asc.mjs GET  /v1/apps
//   node scripts/asc.mjs GET  "/v1/bundleIds?filter[identifier]=com.eddytrains.app"
//   node scripts/asc.mjs POST /v1/bundleIds '{"data":{...}}'
//   node scripts/asc.mjs whoami            # cheap auth check, lists apps
//
// Apple caps token lifetime at 20 minutes; this mints a fresh 10-minute one
// per run, so there is nothing to cache or expire.

import { createSign } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = 'https://api.appstoreconnect.apple.com';

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function resolveKeyPath(keyId) {
  const explicit = process.env.ASC_KEY_PATH?.trim();
  if (explicit) {
    // Shells do not expand ~ inside a quoted .env value, so do it here.
    const expanded = explicit.startsWith('~')
      ? join(homedir(), explicit.slice(1).replace(/^\//, ''))
      : explicit;
    if (existsSync(expanded)) return expanded;
    throw new Error(`ASC_KEY_PATH is set but no file at ${expanded}`);
  }
  // Apple's own default location, the one altool and notarytool search.
  const fallback = join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
  if (existsSync(fallback)) return fallback;
  throw new Error(
    `No private key found.\n` +
      `Put AuthKey_${keyId}.p8 at ${fallback}, or set ASC_KEY_PATH.\n` +
      `App Store Connect only lets you download it once, at creation.`
  );
}

function mintToken() {
  const issuerId = process.env.ASC_ISSUER_ID?.trim();
  const keyId = process.env.ASC_KEY_ID?.trim();
  if (!issuerId || !keyId) {
    throw new Error('ASC_ISSUER_ID and ASC_KEY_ID must be set in the environment.');
  }

  const privateKey = readFileSync(resolveKeyPath(keyId), 'utf8');
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 600, // 10 min. Apple rejects anything over 20.
    aud: 'appstoreconnect-v1',
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();

  // Apple wants the raw r||s pair (JOSE), not the DER wrapper OpenSSL emits.
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${b64url(signature)}`;
}

export async function asc(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${mintToken()}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  return { ok: res.ok, status: res.status, body: parsed };
}

// --- CLI -------------------------------------------------------------------

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const [, , rawMethod, rawPath, rawBody] = process.argv;

  try {
    let method = rawMethod;
    let path = rawPath;

    if (rawMethod === 'whoami') {
      method = 'GET';
      path = '/v1/apps?limit=10';
    }

    if (!method || !path) {
      console.error('usage: node scripts/asc.mjs <GET|POST|PATCH|DELETE> <path> [jsonBody]');
      console.error('       node scripts/asc.mjs whoami');
      process.exit(2);
    }

    const { ok, status, body } = await asc(method.toUpperCase(), path, rawBody);
    console.log(JSON.stringify(body, null, 2));

    if (!ok) {
      // Apple's errors are genuinely informative; surface the status too.
      console.error(`\nHTTP ${status}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
