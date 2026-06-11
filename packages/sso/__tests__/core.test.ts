import { describe, expect, test } from "bun:test";
import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";
import { githubIdentity, googleIdentity } from "../src/providers.ts";
import { appendTokenFragment, isValidReturnUrl } from "../src/return-url.ts";
import { decodeState, encodeState } from "../src/state.ts";
import { EmailNotVerifiedError, mintToken, TOKEN_AUDIENCE } from "../src/token.ts";

const ISSUER = "https://sso.test.kaged.dev";

async function testKey(): Promise<{ kid: string; privatePem: string; publicPem: string }> {
	const kp = await generateKeyPair("ES256", { extractable: true });
	return {
		kid: "test-1",
		privatePem: await exportPKCS8(kp.privateKey),
		publicPem: await exportSPKI(kp.publicKey),
	};
}

describe("return-url validation", () => {
	test("accepts absolute https", () => {
		expect(isValidReturnUrl("https://my.daemon.example/auth/sso/callback")).toBe(true);
	});
	test("accepts http only for localhost/127.0.0.1", () => {
		expect(isValidReturnUrl("http://localhost:13001/auth/sso/callback")).toBe(true);
		expect(isValidReturnUrl("http://127.0.0.1:13001/x")).toBe(true);
		expect(isValidReturnUrl("http://evil.example/x")).toBe(false);
	});
	test("rejects fragments and relative urls", () => {
		expect(isValidReturnUrl("https://x.example/#frag")).toBe(false);
		expect(isValidReturnUrl("/relative")).toBe(false);
		expect(isValidReturnUrl("not a url")).toBe(false);
	});
	test("appends token in fragment", () => {
		const url = appendTokenFragment("https://x.example/cb", "abc.def.ghi");
		expect(url).toBe("https://x.example/cb#kaged_token=abc.def.ghi");
	});
});

describe("signed state", () => {
	const secret = "state-signing-secret-long-enough";
	test("round-trips a fresh state", async () => {
		const payload = {
			returnUrl: "https://x.example/cb",
			provider: "google",
			nonce: "n",
			iat: 1000,
		};
		const state = await encodeState(secret, payload);
		const decoded = await decodeState(secret, state, 1100);
		expect(decoded.ok).toBe(true);
		if (decoded.ok) expect(decoded.payload.provider).toBe("google");
	});
	test("rejects tampered body", async () => {
		const state = await encodeState(secret, {
			returnUrl: "https://x.example/cb",
			provider: "google",
			nonce: "n",
			iat: 1000,
		});
		const tampered = `${"x"}${state.slice(1)}`;
		const decoded = await decodeState(secret, tampered, 1100);
		expect(decoded.ok).toBe(false);
		if (!decoded.ok) expect(decoded.reason).not.toBe("ok");
	});
	test("rejects stale state (> 10 min)", async () => {
		const state = await encodeState(secret, {
			returnUrl: "https://x.example/cb",
			provider: "google",
			nonce: "n",
			iat: 1000,
		});
		const decoded = await decodeState(secret, state, 1000 + 601);
		expect(decoded.ok).toBe(false);
		if (!decoded.ok) expect(decoded.reason).toBe("stale");
	});
	test("rejects wrong secret", async () => {
		const state = await encodeState(secret, {
			returnUrl: "https://x.example/cb",
			provider: "google",
			nonce: "n",
			iat: 1000,
		});
		const decoded = await decodeState("different-secret-of-some-length", state, 1100);
		expect(decoded.ok).toBe(false);
		if (!decoded.ok) expect(decoded.reason).toBe("bad_signature");
	});
});

describe("token minting", () => {
	test("mints a verifiable ES256 token with the contract claims", async () => {
		const key = await testKey();
		const token = await mintToken(
			ISSUER,
			key,
			{
				sub: "google_123",
				name: "Test",
				email: "t@example.com",
				emailVerified: true,
				picture: "https://cdn/x.png",
			},
			1_700_000_000,
		);
		const pub = await importSPKI(key.publicPem, "ES256");
		const { payload, protectedHeader } = await jwtVerify(token, pub, {
			issuer: ISSUER,
			audience: TOKEN_AUDIENCE,
			algorithms: ["ES256"],
			currentDate: new Date(1_700_000_100 * 1000),
		});
		expect(protectedHeader.kid).toBe("test-1");
		expect(payload.sub).toBe("google_123");
		expect(payload.email_verified).toBe(true);
		expect(payload.exp).toBe(1_700_000_000 + 600);
	});
	test("refuses to mint when email_verified is false", async () => {
		const key = await testKey();
		await expect(
			mintToken(ISSUER, key, {
				sub: "google_1",
				name: "x",
				email: "x@example.com",
				emailVerified: false,
			}),
		).rejects.toBeInstanceOf(EmailNotVerifiedError);
	});
});

describe("provider identity mapping", () => {
	test("google prefixes sub and reads email_verified", () => {
		const id = googleIdentity({
			sub: "999",
			name: "G",
			email: "g@example.com",
			email_verified: true,
			picture: "p",
		});
		expect(id.sub).toBe("google_999");
		expect(id.emailVerified).toBe(true);
	});
	test("github prefixes sub and resolves primary verified email", () => {
		const id = githubIdentity({ id: 42, login: "octocat", name: "The Octocat", avatar_url: "a" }, [
			{ email: "old@example.com", primary: false, verified: true },
			{ email: "main@example.com", primary: true, verified: true },
		]);
		expect(id.sub).toBe("github_42");
		expect(id.email).toBe("main@example.com");
		expect(id.emailVerified).toBe(true);
	});
});
