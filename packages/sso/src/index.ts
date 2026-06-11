export { loadConfigFromEnv, type RelayConfig } from "./config.ts";
export {
	githubProvider,
	googleProvider,
	type ProviderConfig,
	type ProviderListEntry,
	providerListEntry,
} from "./providers.ts";
export { isValidReturnUrl } from "./return-url.ts";
export {
	createRelayFetch,
	liveExchange,
	type ProviderExchange,
} from "./server.ts";
export { decodeState, encodeState, type StatePayload } from "./state.ts";
export {
	EmailNotVerifiedError,
	mintToken,
	type ProviderIdentity,
	type SigningKey,
	TOKEN_ALG,
	TOKEN_AUDIENCE,
	TOKEN_LIFETIME_SECONDS,
} from "./token.ts";
