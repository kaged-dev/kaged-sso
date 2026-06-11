import { describe, expect, test } from "bun:test";
import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";
import type { RelayConfig } from "../src/config.ts";
import { googleProvider } from "../src/providers.ts";
import { createRelayFetch, type ProviderExchange } from "../src/server.ts";
import type { ProviderIdentity } from "../src/token.ts";

const ISSUER = "https://sso.test.kaged.dev";

async function makeConfig(): Promise<{ config: RelayConfig; publicPem: string }> {
	const kp = await generateKeyPair("ES256", { extractable: true });
	const config: RelayConfig = {
		issuer: ISSUER,
		port: 0,
		stateSecret: "test-state-secret-long-enough-xx",
		signingKey: { kid: "test-1", privatePem: await exportPKCS8(kp.privateKey) },
		previousPublicJwk: null,
		providers: [googleProvider("client-id", "client-secret")],
	};
	return { config, publicPem: await exportSPKI(kp.publicKey) };
}

const verifiedExchange: ProviderExchange = {
	async exchangeCode(): Promise<ProviderIdentity> {
		return {
			sub: "google_42",
			name: "Test User",
			email: "test@example.com",
			emailVerified: true,
			picture: "https://cdn/x.png",
		};
	},
};

const unverifiedExchange: ProviderExchange = {
	async exchangeCode(): Promise<ProviderIdentity> {
		return { sub: "google_43", name: "X", email: "x@example.com", emailVerified: false };
	},
};

describe("relay server", () => {
	test("GET /providers returns provider list with CORS *", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const res = await handle(new Request("https://relay/providers"));
		expect(res.status).toBe(200);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		const list = (await res.json()) as Array<{ provider: string; path: string }>;
		expect(list[0]?.provider).toBe("google");
		expect(list[0]?.path).toBe("/google/login");
	});

	test("JWKS endpoint serves a public key with kid, no private material", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const res = await handle(new Request("https://relay/.well-known/jwks.json"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as { keys: Array<Record<string, unknown>> };
		expect(body.keys).toHaveLength(1);
		expect(body.keys[0]?.kid).toBe("test-1");
		expect(body.keys[0]?.d).toBeUndefined();
		expect(body.keys[0]?.crv).toBe("P-256");
	});

	test("login redirects to provider authorize with signed state", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const res = await handle(
			new Request(`https://relay/google/login?return=${encodeURIComponent("https://daemon/cb")}`, {
				redirect: "manual",
			}),
		);
		expect(res.status).toBe(302);
		const loc = new URL(res.headers.get("Location") ?? "");
		expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
		expect(loc.searchParams.get("state")).toBeTruthy();
		expect(loc.searchParams.get("redirect_uri")).toBe(`${ISSUER}/google/callback`);
	});

	test("login rejects an invalid return url", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const res = await handle(
			new Request(`https://relay/google/login?return=${encodeURIComponent("http://evil/cb")}`),
		);
		expect(res.status).toBe(400);
	});

	test("callback mints a token delivered in the fragment, verifiable by relay's public key", async () => {
		const { config, publicPem } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const login = await handle(
			new Request(`https://relay/google/login?return=${encodeURIComponent("https://daemon/cb")}`),
		);
		const state = new URL(login.headers.get("Location") ?? "").searchParams.get("state") ?? "";
		const res = await handle(
			new Request(`https://relay/google/callback?code=abc&state=${encodeURIComponent(state)}`, {
				redirect: "manual",
			}),
		);
		expect(res.status).toBe(302);
		const location = res.headers.get("Location") ?? "";
		expect(location.startsWith("https://daemon/cb#kaged_token=")).toBe(true);
		const token = location.split("#kaged_token=")[1] ?? "";
		const pub = await importSPKI(publicPem, "ES256");
		const { payload } = await jwtVerify(token, pub, {
			issuer: ISSUER,
			audience: "kaged",
			algorithms: ["ES256"],
		});
		expect(payload.sub).toBe("google_42");
	});

	test("callback refuses when email is not verified", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, unverifiedExchange);
		const login = await handle(
			new Request(`https://relay/google/login?return=${encodeURIComponent("https://daemon/cb")}`),
		);
		const state = new URL(login.headers.get("Location") ?? "").searchParams.get("state") ?? "";
		const res = await handle(
			new Request(`https://relay/google/callback?code=abc&state=${encodeURIComponent(state)}`),
		);
		expect(res.status).toBe(403);
	});

	test("callback rejects a tampered state", async () => {
		const { config } = await makeConfig();
		const handle = createRelayFetch(config, verifiedExchange);
		const res = await handle(
			new Request("https://relay/google/callback?code=abc&state=tampered.sig"),
		);
		expect(res.status).toBe(400);
	});
});
