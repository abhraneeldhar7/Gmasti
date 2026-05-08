const AUTH_STORAGE_KEY = "gmasti_web_auth";

export type StoredUser = {
  user_id: string;
  email: string;
  name: string;
  joined: string;
};

export type StoredAuth = {
  accessToken: string;
  expiresAt: string;
  user: StoredUser;
};

type AuthExchangeResponse = {
  access_token: string;
  expires_at: string;
  user: StoredUser;
};

const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL;
const googleClientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;

function assertEnv() {
  if (!apiBaseUrl) {
    throw new Error("Missing PUBLIC_API_BASE_URL.");
  }

  if (!googleClientId) {
    throw new Error("Missing PUBLIC_GOOGLE_CLIENT_ID.");
  }
}

export function getRedirectUri() {
  return new URL("/auth/callback", window.location.origin).toString();
}

export function getGoogleLoginUrl(interactive = true) {
  assertEnv();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", interactive ? "select_account consent" : "none");
  return url.toString();
}

export function startGoogleLogin() {
  window.location.assign(getGoogleLoginUrl(true));
}

export function getAuthRecord(): StoredAuth | null {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const record = JSON.parse(raw) as StoredAuth;
    if (!isTokenValid(record)) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return record;
  } catch (_error) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function isTokenValid(auth: StoredAuth): boolean {
  if (!auth?.accessToken || !auth?.expiresAt) {
    return false;
  }
  return new Date(auth.expiresAt).getTime() > Date.now();
}

export function setAuthRecord(data: AuthExchangeResponse) {
  const record: StoredAuth = {
    accessToken: data.access_token,
    expiresAt: data.expires_at,
    user: data.user,
  };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearAuthRecord() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function exchangeGoogleCode(code: string) {
  assertEnv();

  const response = await fetch(`${apiBaseUrl}/auth/google/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  const data = (await response.json()) as AuthExchangeResponse & { detail?: string };
  if (!response.ok) {
    throw new Error(data.detail || "Google exchange failed.");
  }

  return setAuthRecord(data);
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  assertEnv();

  const auth = getAuthRecord();
  if (!auth?.accessToken) {
    const error = new Error("Sign in first.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${auth.accessToken}`,
    },
  });

  if (response.status === 401) {
    clearAuthRecord();
  }

  return response;
}

export async function fetchCurrentUser() {
  const response = await authenticatedFetch("/auth/me");
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Unable to load session.");
  }

  const auth = getAuthRecord();
  if (auth) {
    const nextAuth = {
      ...auth,
      user: data,
    };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
  }

  return data as StoredAuth["user"];
}

export function logout() {
  clearAuthRecord();
  window.location.assign("/");
}
