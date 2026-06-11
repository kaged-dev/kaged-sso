import fixturesJson from "../fixtures/fixtures.json" with { type: "json" };
import type {
	FailureStep,
	InvalidTokenFixture,
	SsoFixtures,
	ValidTokenFixture,
} from "./contract.ts";

export type {
	FailureStep,
	InvalidTokenFixture,
	SsoFixtures,
	TokenClaims,
	ValidTokenFixture,
} from "./contract.ts";
export {
	TOKEN_ALG,
	TOKEN_AUDIENCE,
	TOKEN_ISSUER,
	TOKEN_KID,
	TOKEN_MAX_LIFETIME_SECONDS,
} from "./contract.ts";

export const fixtures: SsoFixtures = fixturesJson as SsoFixtures;

export function validToken(provider: string): ValidTokenFixture {
	const found = fixtures.validTokens.find((t) => t.provider === provider);
	if (!found) {
		throw new Error(`no valid token fixture for provider: ${provider}`);
	}
	return found;
}

export function invalidToken(step: FailureStep): InvalidTokenFixture {
	const found = fixtures.invalidTokens.find((t) => t.step === step);
	if (!found) {
		throw new Error(`no invalid token fixture for step: ${step}`);
	}
	return found;
}
