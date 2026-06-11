import { githubProvider, googleProvider, type ProviderConfig } from "./providers.ts";
import type { SigningKey } from "./token.ts";

export interface RelayConfig {
	issuer: string;
	port: number;
	stateSecret: string;
	signingKey: SigningKey;
	previousPublicJwk: Record<string, unknown> | null;
	providers: ProviderConfig[];
}

function required(name: string): string {
	const value = process.env[name];
	if (!value || value.length === 0) {
		throw new Error(`missing required env var: ${name}`);
	}
	return value;
}

export function loadConfigFromEnv(
	env: Record<string, string | undefined> = process.env,
): RelayConfig {
	const issuer = env.KAGED_SSO_ISSUER ?? required("KAGED_SSO_ISSUER");
	const port = Number.parseInt(env.KAGED_SSO_PORT ?? "8787", 10);
	const stateSecret = env.KAGED_SSO_STATE_SECRET ?? required("KAGED_SSO_STATE_SECRET");
	const signingKey: SigningKey = {
		kid: env.KAGED_SSO_KEY_KID ?? required("KAGED_SSO_KEY_KID"),
		privatePem: env.KAGED_SSO_PRIVATE_KEY ?? required("KAGED_SSO_PRIVATE_KEY"),
	};

	const providers: ProviderConfig[] = [];
	if (env.KAGED_SSO_GOOGLE_CLIENT_ID && env.KAGED_SSO_GOOGLE_CLIENT_SECRET) {
		providers.push(
			googleProvider(env.KAGED_SSO_GOOGLE_CLIENT_ID, env.KAGED_SSO_GOOGLE_CLIENT_SECRET),
		);
	}
	if (env.KAGED_SSO_GITHUB_CLIENT_ID && env.KAGED_SSO_GITHUB_CLIENT_SECRET) {
		providers.push(
			githubProvider(env.KAGED_SSO_GITHUB_CLIENT_ID, env.KAGED_SSO_GITHUB_CLIENT_SECRET),
		);
	}

	let previousPublicJwk: Record<string, unknown> | null = null;
	if (env.KAGED_SSO_PREVIOUS_PUBLIC_JWK) {
		previousPublicJwk = JSON.parse(env.KAGED_SSO_PREVIOUS_PUBLIC_JWK) as Record<string, unknown>;
	}

	return { issuer, port, stateSecret, signingKey, previousPublicJwk, providers };
}
