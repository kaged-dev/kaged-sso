export const STATE_FRESHNESS_SECONDS = 600;

export interface StatePayload {
	returnUrl: string;
	provider: string;
	nonce: string;
	iat: number;
}

function b64urlEncode(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64url");
}

function b64urlDecode(value: string): Uint8Array {
	return new Uint8Array(Buffer.from(value, "base64url"));
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
	return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

export async function encodeState(secret: string, payload: StatePayload): Promise<string> {
	const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	const sig = b64urlEncode(await hmac(secret, body));
	return `${body}.${sig}`;
}

export type DecodeStateResult =
	| { ok: true; payload: StatePayload }
	| { ok: false; reason: "malformed" | "bad_signature" | "stale" };

export async function decodeState(
	secret: string,
	state: string,
	now: number = Math.floor(Date.now() / 1000),
): Promise<DecodeStateResult> {
	const dot = state.indexOf(".");
	if (dot === -1) {
		return { ok: false, reason: "malformed" };
	}
	const body = state.slice(0, dot);
	const sig = state.slice(dot + 1);

	const expected = await hmac(secret, body);
	let provided: Uint8Array;
	try {
		provided = b64urlDecode(sig);
	} catch {
		return { ok: false, reason: "malformed" };
	}
	if (!timingSafeEqual(expected, provided)) {
		return { ok: false, reason: "bad_signature" };
	}

	let payload: StatePayload;
	try {
		payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as StatePayload;
	} catch {
		return { ok: false, reason: "malformed" };
	}

	if (
		typeof payload.iat !== "number" ||
		typeof payload.returnUrl !== "string" ||
		typeof payload.provider !== "string" ||
		typeof payload.nonce !== "string"
	) {
		return { ok: false, reason: "malformed" };
	}
	if (now - payload.iat > STATE_FRESHNESS_SECONDS || payload.iat - now > STATE_FRESHNESS_SECONDS) {
		return { ok: false, reason: "stale" };
	}
	return { ok: true, payload };
}
