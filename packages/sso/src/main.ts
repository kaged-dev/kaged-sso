import { loadConfigFromEnv } from "./config.ts";
import { createRelayFetch } from "./server.ts";

const config = loadConfigFromEnv();
const handle = createRelayFetch(config);

const server = Bun.serve({
	port: config.port,
	fetch: handle,
});

process.stdout.write(
	`kaged-sso relay listening on :${server.port} (issuer ${config.issuer}, ${config.providers.length} provider(s))\n`,
);
