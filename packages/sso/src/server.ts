import type { RelayConfig } from "./config.ts";
import {
	type GithubEmail,
	type GithubUser,
	githubIdentity,
	googleIdentity,
	type ProviderConfig,
	providerListEntry,
} from "./providers.ts";
import { appendTokenFragment, isValidReturnUrl } from "./return-url.ts";
import { decodeState, encodeState } from "./state.ts";
import { jwkForKey, mintToken, type ProviderIdentity } from "./token.ts";

const PUBLIC_CORS = { "Access-Control-Allow-Origin": "*" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

function findProvider(config: RelayConfig, id: string): ProviderConfig | undefined {
	return config.providers.find((p) => p.id === id);
}

function randomNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Buffer.from(bytes).toString("base64url");
}

async function buildJwks(config: RelayConfig): Promise<Response> {
	const current = await jwkForKey(config.signingKey);
	const keys = config.previousPublicJwk ? [current, config.previousPublicJwk] : [current];
	return json({ keys }, 200, PUBLIC_CORS);
}

async function handleLogin(
	config: RelayConfig,
	provider: ProviderConfig,
	url: URL,
): Promise<Response> {
	const returnUrl = url.searchParams.get("return");
	if (!returnUrl || !isValidReturnUrl(returnUrl)) {
		return json({ error: "invalid_return_url" }, 400);
	}
	const nonce = randomNonce();
	const iat = Math.floor(Date.now() / 1000);
	const state = await encodeState(config.stateSecret, {
		returnUrl,
		provider: provider.id,
		nonce,
		iat,
	});
	const authorize = new URL(provider.authorizeUrl);
	authorize.searchParams.set("client_id", provider.clientId);
	authorize.searchParams.set("redirect_uri", `${config.issuer}/${provider.id}/callback`);
	authorize.searchParams.set("response_type", "code");
	authorize.searchParams.set("scope", provider.scope);
	authorize.searchParams.set("state", state);
	return Response.redirect(authorize.toString(), 302);
}

export interface ProviderExchange {
	exchangeCode(
		provider: ProviderConfig,
		code: string,
		redirectUri: string,
	): Promise<ProviderIdentity>;
}

export async function liveExchange(
	provider: ProviderConfig,
	code: string,
	redirectUri: string,
): Promise<ProviderIdentity> {
	const tokenRes = await fetch(provider.tokenUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
		body: new URLSearchParams({
			client_id: provider.clientId,
			client_secret: provider.clientSecret,
			code,
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}),
	});
	const tokenBody = (await tokenRes.json()) as { access_token?: string; id_token?: string };

	if (provider.id === "google") {
		const userRes = await fetch(provider.userInfoUrl, {
			headers: { Authorization: `Bearer ${tokenBody.access_token ?? ""}` },
		});
		return googleIdentity((await userRes.json()) as Record<string, unknown>);
	}

	const userRes = await fetch(provider.userInfoUrl, {
		headers: {
			Authorization: `Bearer ${tokenBody.access_token ?? ""}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "kaged-sso",
		},
	});
	const user = (await userRes.json()) as GithubUser;
	const emailsRes = await fetch("https://api.github.com/user/emails", {
		headers: {
			Authorization: `Bearer ${tokenBody.access_token ?? ""}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "kaged-sso",
		},
	});
	const emails = (await emailsRes.json()) as GithubEmail[];
	return githubIdentity(user, emails);
}

async function handleCallback(
	config: RelayConfig,
	provider: ProviderConfig,
	url: URL,
	exchange: ProviderExchange,
): Promise<Response> {
	const code = url.searchParams.get("code");
	const stateParam = url.searchParams.get("state");
	if (!code || !stateParam) {
		return json({ error: "invalid_callback" }, 400);
	}
	const state = await decodeState(config.stateSecret, stateParam);
	if (!state.ok) {
		return json({ error: "invalid_state" }, 400);
	}
	if (state.payload.provider !== provider.id) {
		return json({ error: "provider_mismatch" }, 400);
	}

	let identity: ProviderIdentity;
	try {
		identity = await exchange.exchangeCode(
			provider,
			code,
			`${config.issuer}/${provider.id}/callback`,
		);
	} catch {
		return json({ error: "exchange_failed" }, 502);
	}

	let token: string;
	try {
		token = await mintToken(config.issuer, config.signingKey, identity);
	} catch {
		return json({ error: "email_not_verified" }, 403);
	}

	return Response.redirect(appendTokenFragment(state.payload.returnUrl, token), 302);
}

export function createRelayFetch(
	config: RelayConfig,
	exchange: ProviderExchange = { exchangeCode: liveExchange },
): (req: Request) => Promise<Response> {
	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url);
		const path = url.pathname;

		if (req.method === "GET" && path === "/providers") {
			return json(config.providers.map(providerListEntry), 200, PUBLIC_CORS);
		}
		if (req.method === "GET" && (path === "/healthz" || path === "/")) {
			return json({ status: "ok", issuer: config.issuer }, 200);
		}
		if (req.method === "GET" && path === "/.well-known/jwks.json") {
			return buildJwks(config);
		}

		const loginMatch = path.match(/^\/([a-z0-9-]+)\/login$/);
		if (req.method === "GET" && loginMatch) {
			const provider = findProvider(config, loginMatch[1] ?? "");
			if (!provider) return json({ error: "unknown_provider" }, 404);
			return handleLogin(config, provider, url);
		}

		const callbackMatch = path.match(/^\/([a-z0-9-]+)\/callback$/);
		if (req.method === "GET" && callbackMatch) {
			const provider = findProvider(config, callbackMatch[1] ?? "");
			if (!provider) return json({ error: "unknown_provider" }, 404);
			return handleCallback(config, provider, url, exchange);
		}

		return json({ error: "not_found" }, 404);
	};
}
