export function isValidReturnUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.hash.length > 0) {
		return false;
	}
	if (url.protocol === "https:") {
		return true;
	}
	if (url.protocol === "http:") {
		return url.hostname === "localhost" || url.hostname === "127.0.0.1";
	}
	return false;
}

export function appendTokenFragment(returnUrl: string, token: string): string {
	const url = new URL(returnUrl);
	url.hash = `kaged_token=${token}`;
	return url.toString();
}
