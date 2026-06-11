<div align="center">

<img src="https://kaged.dev/hero.svg" alt="kaged" width="100%" />

# 影 @kaged/sso-fixtures

**shadow ops for your `[contract]`**

Golden token fixtures and a test keypair that pin the [kaged](https://kaged.dev) SSO §3.4 token contract — published in lockstep with [`@kaged/sso`](https://www.npmjs.com/package/@kaged/sso) so the relay and the daemon can never drift apart silently.

[![npm](https://img.shields.io/npm/v/@kaged/sso-fixtures?color=FFB000&label=npm&labelColor=0A0A0B)](https://www.npmjs.com/package/@kaged/sso-fixtures)
[![license](https://img.shields.io/badge/license-AGPL--3.0-FF2E63?labelColor=0A0A0B)](#license)

</div>

---

## what it is

A daemon that verifies SSO tokens and the relay that mints them live in **separate repositories**. This package is how they agree on the wire format without trusting each other's prose.

It ships:

- **Golden token fixtures** — one valid token per provider, plus one token per §3.4 verification-failure step (`forged_signature`, `expired`, `wrong_alg`, `wrong_iss`, `wrong_aud`, `email_not_verified`, `missing_kid`).
- **The test keypair** (public JWK + SPKI PEM) that signed them.

The producing repo (`@kaged/sso`) publishes this package at the **same version, from the same release**. A consumer (the kaged daemon) pins it as an **exact-version devDependency** and runs its verifier suite against it. A signing or claim change in the relay therefore cannot reach the daemon without a fixtures bump that fails the daemon's suite visibly. Silent cross-repo drift is structurally unmergeable.

---

## use it

```ts
import { fixtures, validToken, invalidToken, TOKEN_ISSUER } from "@kaged/sso-fixtures";

// the relay's public key + issuer/audience to configure your verifier
fixtures.publicKeyPem;
fixtures.issuer;     // also TOKEN_ISSUER
fixtures.audience;   // "kaged"

// a known-good token per provider
validToken("google").token;
validToken("github").token;

// a token that must fail a specific verification step
invalidToken("expired").token;
invalidToken("wrong_aud").token;
```

A conformance test then asserts every `validToken` passes your verifier and every `invalidToken` step is rejected. Use a fixed clock inside the fixtures' validity window — tokens use `iat = 1700000000`, `exp = iat + 600`, so verify at e.g. `1700000100`.

---

## exports

| Export | What |
|---|---|
| `fixtures` | The full `SsoFixtures` object (version, issuer, audience, kid, public key JWK + PEM, valid + invalid tokens). |
| `validToken(provider)` | The valid `ValidTokenFixture` for a provider (`"google"` \| `"github"`). |
| `invalidToken(step)` | The `InvalidTokenFixture` for a §3.4 `FailureStep`. |
| `TOKEN_ISSUER`, `TOKEN_AUDIENCE`, `TOKEN_ALG`, `TOKEN_KID`, `TOKEN_MAX_LIFETIME_SECONDS` | Contract constants. |

Types `SsoFixtures`, `ValidTokenFixture`, `InvalidTokenFixture`, `TokenClaims`, `FailureStep` are exported too.

---

## license

AGPL-3.0 © the kaged project

<div align="center">

`[kaged]` · [kaged.dev](https://kaged.dev) · *sanctioned edge, sacred code*

</div>
