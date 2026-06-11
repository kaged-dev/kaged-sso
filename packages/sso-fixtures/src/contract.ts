export const TOKEN_ISSUER = "https://sso.test.kaged.dev";
export const TOKEN_AUDIENCE = "kaged";
export const TOKEN_ALG = "ES256";
export const TOKEN_KID = "kaged-sso-test-key-1";
export const TOKEN_MAX_LIFETIME_SECONDS = 600;

export type FailureStep =
	| "forged_signature"
	| "expired"
	| "wrong_alg"
	| "wrong_iss"
	| "wrong_aud"
	| "email_not_verified"
	| "missing_kid";

export interface TokenClaims {
	iss: string;
	aud: string;
	sub: string;
	iat: number;
	exp: number;
	name: string;
	email: string;
	email_verified: boolean;
	picture?: string;
}

export interface ValidTokenFixture {
	provider: string;
	token: string;
	claims: TokenClaims;
}

export interface InvalidTokenFixture {
	step: FailureStep;
	token: string;
	reason: string;
}

export interface PublicKeyJwk {
	kty: string;
	crv?: string;
	x?: string;
	y?: string;
	kid?: string;
	alg?: string;
	use?: string;
}

export interface SsoFixtures {
	version: string;
	issuer: string;
	audience: string;
	kid: string;
	publicKeyJwk: PublicKeyJwk;
	publicKeyPem: string;
	validTokens: ValidTokenFixture[];
	invalidTokens: InvalidTokenFixture[];
}
