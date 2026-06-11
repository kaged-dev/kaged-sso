import { describe, expect, test } from "bun:test";
import { importSPKI, jwtVerify } from "jose";
import {
	fixtures,
	invalidToken,
	TOKEN_ALG,
	TOKEN_AUDIENCE,
	TOKEN_ISSUER,
	TOKEN_KID,
	validToken,
} from "../src/index.ts";

async function verifyAgainstContract(token: string): Promise<void> {
	const key = await importSPKI(fixtures.publicKeyPem, TOKEN_ALG);
	const { protectedHeader, payload } = await jwtVerify(token, key, {
		issuer: TOKEN_ISSUER,
		audience: TOKEN_AUDIENCE,
		algorithms: [TOKEN_ALG],
		clockTolerance: 60,
		currentDate: new Date(1_700_000_100 * 1000),
	});
	if (protectedHeader.kid !== TOKEN_KID) {
		throw new Error("missing or wrong kid");
	}
	if (payload.email_verified !== true) {
		throw new Error("email_verified not true");
	}
}

describe("sso-fixtures contract", () => {
	test("fixtures version matches package version", async () => {
		const pkg = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as {
			version: string;
		};
		expect(fixtures.version).toBe(pkg.version);
	});

	test("every valid token passes full §3.4 verification", async () => {
		expect(fixtures.validTokens.length).toBeGreaterThanOrEqual(2);
		for (const fixture of fixtures.validTokens) {
			await verifyAgainstContract(fixture.token);
		}
	});

	test("provider lookup helpers resolve", () => {
		expect(validToken("google").provider).toBe("google");
		expect(validToken("github").provider).toBe("github");
	});

	test("every §3.4 failure step is covered exactly once", () => {
		const steps = fixtures.invalidTokens.map((t) => t.step).sort();
		expect(steps).toEqual(
			[
				"email_not_verified",
				"expired",
				"forged_signature",
				"missing_kid",
				"wrong_alg",
				"wrong_aud",
				"wrong_iss",
			].sort(),
		);
	});

	test("each invalid token fails verification", async () => {
		for (const fixture of fixtures.invalidTokens) {
			let threw = false;
			try {
				await verifyAgainstContract(fixture.token);
			} catch {
				threw = true;
			}
			expect(threw).toBe(true);
		}
	});

	test("invalidToken helper resolves a known step", () => {
		expect(invalidToken("expired").step).toBe("expired");
	});
});
