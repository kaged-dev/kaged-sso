<div align="center">

<img src="https://kaged.dev/hero.svg" alt="kaged" width="100%" />

# 影 @kaged/sso

**shadow ops for your `[identity]`**

A stateless shared SSO relay that performs the OAuth dance with upstream providers and mints short-lived ES256 identity tokens any kaged daemon can verify locally — self-hostable, no database, one container.

[![npm](https://img.shields.io/npm/v/@kaged/sso?color=FFB000&label=npm&labelColor=0A0A0B)](https://www.npmjs.com/package/@kaged/sso)
[![license](https://img.shields.io/badge/license-AGPL--3.0-FF2E63?labelColor=0A0A0B)](#license)
[![image](https://img.shields.io/badge/image-ghcr.io%2Fkaged--dev%2Fkaged--sso-00E0FF?labelColor=0A0A0B)](https://github.com/kaged-dev/kaged-sso/pkgs/container/kaged-sso)

</div>

---

## what it is

The **stateless shared SSO relay** for [kaged](https://kaged.dev). It performs the OAuth dance with upstream identity providers (Google, GitHub) and converts the result into a short-lived **ES256** identity token that any kaged daemon configured to trust the issuer can verify locally. No database. One container.

This repo publishes two npm packages, **in lockstep** (same version, one release):

- **`@kaged/sso`** — the relay service.
- **`@kaged/sso-fixtures`** — the golden token fixtures + test keypair that pin the §3.4 token contract. The kaged daemon consumes this as a pinned devDependency so a signing/claim change here cannot reach the daemon without a visible test failure.

Naming convention (per the kaged ADR-0036 amendment): repo `kaged-<thing>` ⇔ npm `@kaged/<thing>` ⇔ image `ghcr.io/kaged-dev/kaged-<thing>`.

## The trust statement

> Whoever holds the relay's private signing key can mint a valid identity assertion for any email/subject, for every daemon configured to trust that key, until that daemon's operator removes the trust. Publishing the relay's source code does not prove what runs at any given URL. If that trust is unacceptable, run your own relay (one container, no database) or pin a key you control — or don't enable sharedsso at all. It is disabled by default.

## Log retention policy (default public instance)

> Access logs retained ≤ 7 days, no analytics, no third-party log shipping.

The relay is stateless but **not logless**: the default public instance observes login events (subject, timestamp, return host), and JWKS fetches reveal daemon IPs. Operators who pin the relay's public key in their daemon config (zero-contact mode) eliminate all daemon→issuer traffic; the browser still visits the issuer to log in.

## Run it

```bash
bun run packages/sso/scripts/generate-key.ts my-kid   # mint an ES256 keypair
# set the env below, then:
bun run packages/sso/src/main.ts
```

Environment:

| Var | Required | Meaning |
|---|---|---|
| `KAGED_SSO_ISSUER` | yes | Canonical base URL, e.g. `https://sso.example.com`. Becomes the token `iss`. |
| `KAGED_SSO_PORT` | no (8787) | Listen port. |
| `KAGED_SSO_STATE_SECRET` | yes | HMAC secret for the signed `state` param. |
| `KAGED_SSO_KEY_KID` | yes | Key id, surfaced in the JWT header and JWKS. |
| `KAGED_SSO_PRIVATE_KEY` | yes | P-256 PKCS8 PEM signing key. |
| `KAGED_SSO_PREVIOUS_PUBLIC_JWK` | no | Previous public key JWK (JSON) for rotation overlap. |
| `KAGED_SSO_GOOGLE_CLIENT_ID` / `_SECRET` | no | Enable Google. |
| `KAGED_SSO_GITHUB_CLIENT_ID` / `_SECRET` | no | Enable GitHub. |

Container: `ghcr.io/kaged-dev/kaged-sso:latest`.

## Pin the public key in a daemon (zero-contact)

Give the public PEM (from `generate-key.ts`) to daemon operators. In the daemon's `local.toml`:

```toml
[auth.sharedsso]
enabled    = true
issuer     = "https://sso.example.com"
public_key = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

With `public_key` set, the daemon never contacts the issuer.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/providers` | Provider list (CORS `*`, no credentials). |
| GET | `/.well-known/jwks.json` | JWKS (current + previous key). |
| GET | `/{provider}/login?return={url}` | Begin the OAuth flow. |
| GET | `/{provider}/callback` | Complete the flow; mint the token; redirect with `#kaged_token=`. |

## Development

```bash
bun install
bun run packages/sso-fixtures/scripts/generate.ts   # (re)generate golden fixtures
bun test
bun --filter '*' typecheck
```

Local cross-repo loop with the daemon: `cd packages/sso-fixtures && bun link`, then in the daemon repo `bun link @kaged/sso-fixtures`.

## Spec

The authoritative contract lives in the kaged monorepo: `docs/specs/sso-relay.md` and `docs/adr/0036-unified-user-identity-shared-sso.md`.

---

## license

AGPL-3.0 © the kaged project

<div align="center">

`[kaged]` · [kaged.dev](https://kaged.dev) · *sanctioned edge, sacred code*

</div>
