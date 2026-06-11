import type { ProviderIdentity } from "./token.ts";

export interface ProviderConfig {
	id: string;
	label: string;
	icon: string;
	clientId: string;
	clientSecret: string;
	authorizeUrl: string;
	tokenUrl: string;
	userInfoUrl: string;
	scope: string;
	usesPkce: boolean;
}

export interface ProviderListEntry {
	provider: string;
	label: string;
	icon: string;
	path: string;
}

export function providerListEntry(config: ProviderConfig): ProviderListEntry {
	return {
		provider: config.id,
		label: config.label,
		icon: config.icon,
		path: `/${config.id}/login`,
	};
}

export function googleProvider(clientId: string, clientSecret: string): ProviderConfig {
	return {
		id: "google",
		label: "Google",
		icon: "/icons/google.svg",
		clientId,
		clientSecret,
		authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
		tokenUrl: "https://oauth2.googleapis.com/token",
		userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
		scope: "openid email profile",
		usesPkce: true,
	};
}

export function githubProvider(clientId: string, clientSecret: string): ProviderConfig {
	return {
		id: "github",
		label: "GitHub",
		icon: "/icons/github.svg",
		clientId,
		clientSecret,
		authorizeUrl: "https://github.com/login/oauth/authorize",
		tokenUrl: "https://github.com/login/oauth/access_token",
		userInfoUrl: "https://api.github.com/user",
		scope: "read:user user:email",
		usesPkce: false,
	};
}

export function googleIdentity(claims: Record<string, unknown>): ProviderIdentity {
	const sub = String(claims.sub ?? "");
	return {
		sub: `google_${sub}`,
		name: typeof claims.name === "string" ? claims.name : "",
		email: typeof claims.email === "string" ? claims.email : "",
		emailVerified: claims.email_verified === true || claims.email_verified === "true",
		picture: typeof claims.picture === "string" ? claims.picture : undefined,
	};
}

export interface GithubUser {
	id: number;
	login: string;
	name: string | null;
	avatar_url: string | null;
}

export interface GithubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
}

export function githubIdentity(user: GithubUser, emails: GithubEmail[]): ProviderIdentity {
	const primary = emails.find((e) => e.primary) ?? emails[0];
	return {
		sub: `github_${user.id}`,
		name: user.name ?? user.login,
		email: primary?.email ?? "",
		emailVerified: primary?.verified === true,
		picture: user.avatar_url ?? undefined,
	};
}
