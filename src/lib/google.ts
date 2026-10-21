// Google access from the browser, using Google Identity Services. The token lasts about an hour;
// after that Homie asks Google for a new one, which is silent when you are still signed in to Google
// and a quick tap-through when you are not. No secret is stored anywhere: only the public client ID.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const googleConfigured = Boolean(CLIENT_ID);

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

const STORE = "homie.google.token";
type Cached = { token: string; exp: number };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return c.exp > Date.now() ? c : null;
  } catch {
    return null;
  }
}

function writeCache(c: Cached | null) {
  try {
    if (c) localStorage.setItem(STORE, JSON.stringify(c));
    else localStorage.removeItem(STORE);
  } catch {
    /* storage blocked: the token simply is not remembered across reloads */
  }
}

let loading: Promise<void> | null = null;

/** Load Google's sign-in library ahead of time, so a later tap can open its window immediately. */
export function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load Google sign-in. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function hasGoogleToken(): boolean {
  return readCache() !== null;
}

export function forgetGoogleToken() {
  writeCache(null);
}

/**
 * Get a Google access token. Call this straight from a tap handler, before any `await`,
 * because browsers only allow Google's window to open in direct response to a tap.
 */
export function requestGoogleToken(loginHint?: string): Promise<string> {
  const cached = readCache();
  if (cached) return Promise.resolve(cached.token);
  if (!CLIENT_ID) return Promise.reject(new Error("Google is not set up for this build."));
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    void loadGoogle().catch(() => undefined);
    return Promise.reject(new Error("Google sign-in is still loading. Try again in a moment."));
  }
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: GOOGLE_SCOPES,
      login_hint: loginHint,
      callback: (resp: any) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || "Google did not give access."));
          return;
        }
        writeCache({ token: resp.access_token, exp: Date.now() + (Number(resp.expires_in) - 90) * 1000 });
        resolve(resp.access_token as string);
      },
      error_callback: (err: any) =>
        reject(
          new Error(
            err?.type === "popup_closed"
              ? "The Google window was closed before access was given."
              : err?.type === "popup_failed_to_open"
                ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
                : (err?.message ?? "Google sign-in failed."),
          ),
        ),
    });
    client.requestAccessToken();
  });
}

export async function googleFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) {
    forgetGoogleToken();
    throw new Error("Google access expired. Tap again to reconnect.");
  }
  return res;
}
