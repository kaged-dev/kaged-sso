import { exportJWK, importPKCS8, SignJWT } from "jose";

export const TOKEN_ALG = "ES256";
export const TOKEN_AUDIENCE = "kaged";
export const TOKEN_LIFETIME_SECONDS = 600;

export interface ProviderIdentity {
	sub: string;
	name: string;
	email: string;
	emailVerified: boolean;
	picture?: string;
}

export interface SigningKey {
	kid: string;
	privatePem: string;
}

export class EmailNotVerifiedError extends Error {
	constructor() {
		super("provider did not assert email_verified");
		this.name = "EmailNotVerifiedError";
	}
}

export async function mintToken(
	issuer: string,
	key: SigningKey,
	identity: ProviderIdentity,
	now: number = Math.floor(Date.now() / 1000),
): Promise<string> {
	if (identity.emailVerified !== true) {
		throw new EmailNotVerifiedError();
	}
	const claims: Record<string, unknown> = {
		sub: identity.sub,
		name: identity.name,
		email: identity.email,
		email_verified: true,
	};
	if (identity.picture) {
		claims.picture = identity.picture;
	}
	const privateKey = await importPKCS8(key.privatePem, TOKEN_ALG);
	return new SignJWT(claims)
		.setProtectedHeader({ alg: TOKEN_ALG, kid: key.kid })
		.setIssuer(issuer)
		.setAudience(TOKEN_AUDIENCE)
		.setIssuedAt(now)
		.setExpirationTime(now + TOKEN_LIFETIME_SECONDS)
		.sign(privateKey);
}

export async function jwkForKey(key: SigningKey): Promise<Record<string, unknown>> {
	const privateKey = await importPKCS8(key.privatePem, TOKEN_ALG, { extractable: true });
	const jwk = await exportJWK(privateKey);
	return {
		kty: jwk.kty,
		crv: jwk.crv,
		x: jwk.x,
		y: jwk.y,
		kid: key.kid,
		alg: TOKEN_ALG,
		use: "sig",
	};
}
