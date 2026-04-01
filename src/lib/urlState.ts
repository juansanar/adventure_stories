/**
 * Shareable app state in the URL hash (#s=…) so names are not plain query params.
 * v2 uses short JSON keys + optional raw DEFLATE (smaller than plain base64 for longer text).
 * v1 base64url(JSON) still decodes. Legacy ?friends=… still works. Not encryption.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

const HASH_PREFIX = "#s=";

/** Legacy on-wire shape (still accepted in hash). */
export type SharePayloadV1 = {
  v: 1;
  friends: string;
  family: string;
  plush: string;
  plushExtra: string;
  place: string;
  setting: string;
  mode: string;
  source: string;
};

const TAG_DEFLATE = 2;
const TAG_JSON = 3;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function isDefaultRecord(r: Record<string, string>): boolean {
  return (
    !(r.friends ?? "").trim() &&
    !(r.family ?? "").trim() &&
    !(r.plush ?? "").trim() &&
    !(r.plushExtra ?? "").trim() &&
    !(r.place ?? "").trim() &&
    !(r.setting ?? "").trim() &&
    (r.mode !== "improv") &&
    (r.source ?? "") !== "ai"
  );
}

function parseV1(o: Record<string, unknown>): Record<string, string> | null {
  if (o.v !== 1) return null;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return {
    friends: str("friends"),
    family: str("family"),
    plush: str("plush"),
    plushExtra: str("plushExtra"),
    place: str("place"),
    setting: str("setting"),
    mode: str("mode") || "story",
    source: str("source"),
  };
}

/** v=2 compact keys: f friends, a family, l plush, x plushExtra, p place, t setting, m "i" improv, d 1 ai */
function parseV2(o: Record<string, unknown>): Record<string, string> | null {
  if (o.v !== 2) return null;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "");
  return {
    friends: str("f"),
    family: str("a"),
    plush: str("l"),
    plushExtra: str("x"),
    place: str("p"),
    setting: str("t"),
    mode: o.m === "i" ? "improv" : "story",
    source: o.d === 1 ? "ai" : "",
  };
}

function parseJsonPayload(json: string): Record<string, string> | null {
  const data = JSON.parse(json) as unknown;
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return parseV2(o) ?? parseV1(o);
}

function recordToCompactV2(next: Record<string, string>): Record<string, unknown> {
  const c: Record<string, unknown> = { v: 2 };
  if ((next.friends ?? "").length) c.f = next.friends ?? "";
  if ((next.family ?? "").length) c.a = next.family ?? "";
  if ((next.plush ?? "").length) c.l = next.plush ?? "";
  if ((next.plushExtra ?? "").length) c.x = next.plushExtra ?? "";
  if ((next.place ?? "").length) c.p = next.place ?? "";
  if ((next.setting ?? "").length) c.t = next.setting ?? "";
  if (next.mode === "improv") c.m = "i";
  if ((next.source ?? "") === "ai") c.d = 1;
  return c;
}

function tryDecodeHash(): Record<string, string> | null {
  const { hash } = window.location;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const b64 = hash.slice(HASH_PREFIX.length);
  if (!b64) return null;
  try {
    const bytes = base64UrlToBytes(b64);
    if (bytes.length === 0) return null;

    let json: string;
    if (bytes[0] === TAG_DEFLATE) {
      json = strFromU8(inflateSync(bytes.subarray(1)));
    } else if (bytes[0] === TAG_JSON) {
      json = new TextDecoder().decode(bytes.subarray(1));
    } else {
      json = new TextDecoder().decode(bytes);
    }
    return parseJsonPayload(json);
  } catch {
    return null;
  }
}

export function readQueryParams(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const o: Record<string, string> = {};
  p.forEach((v, k) => {
    o[k] = v;
  });
  return o;
}

/** Prefer hash payload; fall back to legacy query string. */
export function readUrlState(): Record<string, string> {
  const fromHash = tryDecodeHash();
  if (fromHash) return fromHash;
  return readQueryParams();
}

export function writeUrlState(next: Record<string, string>): void {
  const record: Record<string, string> = {
    friends: next.friends ?? "",
    family: next.family ?? "",
    plush: next.plush ?? "",
    plushExtra: next.plushExtra ?? "",
    place: next.place ?? "",
    setting: next.setting ?? "",
    mode: next.mode === "improv" ? "improv" : "story",
    source: next.source ?? "",
  };

  if (isDefaultRecord(record)) {
    window.history.replaceState(null, "", window.location.pathname);
    return;
  }

  const compact = recordToCompactV2(record);
  const json = JSON.stringify(compact);
  const utf8 = strToU8(json);
  const deflated = deflateSync(utf8, { level: 9 });

  let payload: Uint8Array;
  if (deflated.length < utf8.length) {
    payload = new Uint8Array(1 + deflated.length);
    payload[0] = TAG_DEFLATE;
    payload.set(deflated, 1);
  } else {
    payload = new Uint8Array(1 + utf8.length);
    payload[0] = TAG_JSON;
    payload.set(utf8, 1);
  }

  const b64 = bytesToBase64Url(payload);
  window.history.replaceState(null, "", `${window.location.pathname}${HASH_PREFIX}${b64}`);
}
