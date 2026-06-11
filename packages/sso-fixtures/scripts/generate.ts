import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, SignJWT } from "jose";
import {
	type FailureStep,
	type InvalidTokenFixture,
	type SsoFixtures,
	TOKEN_ALG,
	TOKEN_AUDIENCE,
	TOKEN_ISSUER,
	TOKEN_KID,
	TOKEN_MAX_LIFETIME_SECONDS,
	type TokenClaims,
	type ValidTokenFixture,
} from "../src/contract.ts";

const PROVIDERS = ["google", "github"] as const;
const FIXED_IAT = 1_700_000_000;

function validClaims(provider: string): TokenClaims {
	return {
		iss: TOKEN_ISSUER,
		aud: TOKEN_AUDIENCE,
		sub: `${provider}_113942000000000000001`,
		iat: FIXED_IAT,
		exp: FIXED_IAT + TOKEN_MAX_LIFETIME_SECONDS,
		name: `Test ${provider}`,
		email: `test-${provider}@example.com`,
		email_verified: true,
		picture: `https://cdn.example.com/${provider}/avatar.png`,
	};
}

async function signed(
	privatePem: string,
	claims: Record<string, unknown>,
	header: { alg: string; kid?: string },
): Promise<string> {
	const key = await importPKCS8(privatePem, header.alg);
	const jwt = new SignJWT(claims).setProtectedHeader(
		header.kid ? { alg: header.alg, kid: header.kid } : { alg: header.alg },
	);
	return jwt.sign(key);
}

async function buildInvalid(
	primaryPem: string,
	wrongKeyPem: string,
): Promise<InvalidTokenFixture[]> {
	const base = validClaims("google");
	const out: { step: FailureStep; token: string; reason: string }[] = [];

	out.push({
		step: "forged_signature",
		token: await signed(wrongKeyPem, { ...base }, { alg: TOKEN_ALG, kid: TOKEN_KID }),
		reason: "signed by a key the daemon does not trust",
	});
	out.push({
		step: "expired",
		token: await signed(
			primaryPem,
			{ ...base, iat: FIXED_IAT - 4000, exp: FIXED_IAT - 3400 },
			{ alg: TOKEN_ALG, kid: TOKEN_KID },
		),
		reason: "exp is in the distant past",
	});
	out.push({
		step: "wrong_iss",
		token: await signed(
			primaryPem,
			{ ...base, iss: "https://evil.example.com" },
			{ alg: TOKEN_ALG, kid: TOKEN_KID },
		),
		reason: "iss does not match the configured issuer",
	});
	out.push({
		step: "wrong_aud",
		token: await signed(
			primaryPem,
			{ ...base, aud: "not-kaged" },
			{ alg: TOKEN_ALG, kid: TOKEN_KID },
		),
		reason: "aud is not the fixed string kaged",
	});
	out.push({
		step: "email_not_verified",
		token: await signed(
			primaryPem,
			{ ...base, email_verified: false },
			{ alg: TOKEN_ALG, kid: TOKEN_KID },
		),
		reason: "email_verified is not literal true",
	});
	out.push({
		step: "missing_kid",
		token: await signed(primaryPem, { ...base }, { alg: TOKEN_ALG }),
		reason: "protected header has no kid",
	});

	const hsKey = new TextEncoder().encode("a-shared-secret-that-is-long-enough-x");
	const wrongAlgJwt = await new SignJWT({ ...base })
		.setProtectedHeader({ alg: "HS256", kid: TOKEN_KID })
		.sign(hsKey);
	out.push({
		step: "wrong_alg",
		token: wrongAlgJwt,
		reason: "alg is not ES256 (HS256 here)",
	});

	return out;
}

async function main(): Promise<void> {
	const version = (
		(await Bun.file(join(import.meta.dir, "..", "package.json")).json()) as { version: string }
	).version;

	const primary = await generateKeyPair(TOKEN_ALG, { extractable: true });
	const wrong = await generateKeyPair(TOKEN_ALG, { extractable: true });

	const privatePem = await exportPKCS8(primary.privateKey);
	const wrongPrivatePem = await exportPKCS8(wrong.privateKey);
	const publicKeyPem = await exportSPKI(primary.publicKey);
	const exported = await exportJWK(primary.publicKey);
	const publicKeyJwk = {
		kty: exported.kty,
		crv: exported.crv,
		x: exported.x,
		y: exported.y,
		kid: TOKEN_KID,
		alg: TOKEN_ALG,
		use: "sig",
	};

	const validTokens: ValidTokenFixture[] = [];
	for (const provider of PROVIDERS) {
		const claims = validClaims(provider);
		validTokens.push({
			provider,
			claims,
			token: await signed(privatePem, { ...claims }, { alg: TOKEN_ALG, kid: TOKEN_KID }),
		});
	}

	const invalidTokens = await buildInvalid(privatePem, wrongPrivatePem);

	const fixtures: SsoFixtures = {
		version,
		issuer: TOKEN_ISSUER,
		audience: TOKEN_AUDIENCE,
		kid: TOKEN_KID,
		publicKeyJwk,
		publicKeyPem,
		validTokens,
		invalidTokens,
	};

	const fixturesPath = join(import.meta.dir, "..", "fixtures", "fixtures.json");
	const keyPath = join(import.meta.dir, "..", "fixtures", "test-private-key.pem");
	await mkdir(dirname(fixturesPath), { recursive: true });
	await writeFile(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`);
	await writeFile(keyPath, privatePem);

	process.stdout.write(
		`Generated fixtures v${version}: ${validTokens.length} valid, ${invalidTokens.length} invalid.\n`,
	);
}

await main();
