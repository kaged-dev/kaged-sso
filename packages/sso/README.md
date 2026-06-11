<div align="center">

<img src="https://kaged.dev/hero.svg" alt="kaged" width="100%" />

# 影 @kaged/sso

**shadow ops for your `[identity]`**

A stateless shared SSO relay that performs the OAuth dance with upstream providers (Google, GitHub) and mints short-lived **ES256** identity tokens any [kaged](https://kaged.dev) daemon can verify locally — self-hostable, no database, one container.

[![npm](https://img.shields.io/npm/v/@kaged/sso?color=FFB000&label=npm&labelColor=0A0A0B)](https://www.npmjs.com/package/@kaged/sso)
[![license](https://img.shields.io/badge/license-AGPL--3.0-FF2E63?labelColor=0A0A0B)](#license)
[![image](https://img.shields.io/badge/image-ghcr.io%2Fkaged--dev%2Fkaged--sso-00E0FF?labelColor=0A0A0B)](https://github.com/kaged-dev/kaged-sso/pkgs/container/kaged-sso)

</div>

---

## what it is

`@kaged/sso` is the **stateless shared SSO relay** for [kaged](https://kaged.dev). It performs the OAuth dance with upstream identity providers and converts the result into a short-lived ES256 identity token that any kaged daemon configured to trust the issuer can verify locally. No database. One container.

It is published from [`github.com/kaged-dev/kaged-sso`](https://github.com/kaged-dev/kaged-sso) alongside [`@kaged/sso-fixtures`](https://www.npmjs.com/package/@kaged/sso-fixtures), which pins the token contract the daemon verifies against — both published in lockstep (same version, one release).

```
> 影 @kaged/sso
> /providers ........ provider list (CORS *)
> /.well-known/jwks .. signing keys (current + previous)
> /{p}/login ........ begin the OAuth flow
> /{p}/callback ..... mint token, redirect with #kaged_token=
> system nominal.
```

---

## the trust statement

> Whoever holds the relay's private signing key can mint a valid identity assertion for any email/subject, for every daemon configured to trust that key, until that daemon's operator removes the trust. Publishing the relay's source code does not prove what runs at any given URL. If that trust is unacceptable, run your own relay (one container, no database) or pin a key you control — or don't enable sharedsso at all. It is disabled by default.

## log retention policy (default public instance)

> Access logs retained ≤ 7 days, no analytics, no third-party log shipping.

The relay is stateless but **not logless**: the default public instance observes login events (subject, timestamp, return host), and JWKS fetches reveal daemon IPs. Operators who pin the relay's public key in their daemon config (zero-contact mode) eliminate all daemon→issuer traffic; the browser still visits the issuer to log in.

---

## run it

```sh
# mint an ES256 keypair (prints the env + the public key to pin)
bun run scripts/generate-key.ts my-kid

# set the env below, then:
bun run src/main.ts
```

Or the published container:

```sh
docker run -p 8787:8787 \
  -e KAGED_SSO_ISSUER=https://sso.example.com \
  -e KAGED_SSO_STATE_SECRET=... \
  -e KAGED_SSO_KEY_KID=... \
  -e KAGED_SSO_PRIVATE_KEY="$(cat key.pem)" \
  ghcr.io/kaged-dev/kaged-sso:latest
```

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

---

## pin the public key in a daemon (zero-contact)

Give the public PEM (from `generate-key.ts`) to daemon operators. In the daemon's `local.toml`:

```toml
[auth.sharedsso]
enabled    = true
issuer     = "https://sso.example.com"
public_key = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

With `public_key` set, the daemon never contacts the issuer.

---

## token contract (§3.4)

ES256 (P-256), `kid` required. Claims: `iss`, `aud` (`"kaged"`), `sub` (provider-prefixed, e.g. `google_…`), `iat`, `exp` (`iat + 600` max), `name`, `email`, `email_verified` (must be `true`), optional `picture`. The full contract and the daemon's exact verification order live in the kaged monorepo at `docs/specs/sso-relay.md`, and are pinned by golden fixtures in [`@kaged/sso-fixtures`](https://www.npmjs.com/package/@kaged/sso-fixtures).

---

## license

AGPL-3.0 © the kaged project

<div align="center">

`[kaged]` · [kaged.dev](https://kaged.dev) · *sanctioned edge, sacred code*

</div>
