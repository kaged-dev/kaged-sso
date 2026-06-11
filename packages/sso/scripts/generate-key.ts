import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

const kid = process.argv[2] ?? `kaged-sso-${Date.now()}`;
const kp = await generateKeyPair("ES256", { extractable: true });

const privatePem = await exportPKCS8(kp.privateKey);
const publicPem = await exportSPKI(kp.publicKey);

process.stdout.write(`# kid: ${kid}\n`);
process.stdout.write("# Set KAGED_SSO_KEY_KID and KAGED_SSO_PRIVATE_KEY on the relay.\n");
process.stdout.write(
	"# Give the public key below to daemon operators to PIN (zero-contact mode).\n\n",
);
process.stdout.write(`KAGED_SSO_KEY_KID=${kid}\n\n`);
process.stdout.write("# --- private (relay only, keep secret) ---\n");
process.stdout.write(privatePem);
process.stdout.write("\n# --- public (publish / pin) ---\n");
process.stdout.write(publicPem);
