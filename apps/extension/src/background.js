const SETTINGS_STORAGE_KEY = "gmasti_settings";
const AUTH_STORAGE_KEY = "gmasti_auth";
const USAGE_SESSION_KEY = "gmasti_usage_snapshot";
const DAILY_LIMIT = 100;
const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "random",
};
const MESSAGE_TYPES = {
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_SESSION: "GET_SESSION",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  REWRITE_POSTS: "REWRITE_POSTS",
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is required but not set in apps/extension/.env");
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  if (!stored[SETTINGS_STORAGE_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error.message || "Unknown error",
        status: error.status || null,
      }),
    );
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case MESSAGE_TYPES.GET_SETTINGS:
      return getSettings();
    case MESSAGE_TYPES.SAVE_SETTINGS:
      return saveSettings(message.payload ?? {});
    case MESSAGE_TYPES.GET_SESSION:
      return getSessionState();
    case MESSAGE_TYPES.LOGIN:
      return loginWithGoogle(true);
    case MESSAGE_TYPES.LOGOUT:
      return logout();
    case MESSAGE_TYPES.REWRITE_POSTS:
      return rewritePosts(message.payload?.posts ?? []);
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_STORAGE_KEY] || {}),
  };
}

async function saveSettings(partialSettings) {
  const nextSettings = {
    ...(await getSettings()),
    ...partialSettings,
  };
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: nextSettings });
  return nextSettings;
}

async function getAuthRecord() {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return stored[AUTH_STORAGE_KEY] || null;
}

async function setAuthRecord(authRecord) {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: authRecord });
}

async function clearAuthRecord() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

function getDefaultUsage() {
  return {
    usedToday: 0,
    remainingToday: DAILY_LIMIT,
    limit: DAILY_LIMIT,
    isSynced: false,
  };
}

async function getUsageSnapshot(forceRefresh = false) {
  const auth = await getAuthRecord();
  if (!auth?.accessToken) {
    return getDefaultUsage();
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.session.get(USAGE_SESSION_KEY);
  const snapshot = stored[USAGE_SESSION_KEY];

  if (!forceRefresh && snapshot && snapshot.dayKey === dayKey) {
    const total = snapshot.syncedUsedToday + snapshot.runtimeUsedCount;
    return {
      usedToday: total,
      remainingToday: Math.max(0, snapshot.limit - total),
      limit: snapshot.limit,
      isSynced: true,
    };
  }

  try {
    const response = await authenticatedFetch("/usage/today");
    const usage = await response.json();

    await chrome.storage.session.set({
      [USAGE_SESSION_KEY]: {
        dayKey,
        syncedUsedToday: usage.used_today,
        runtimeUsedCount: 0,
        limit: usage.limit,
      },
    });

    return {
      usedToday: usage.used_today,
      remainingToday: usage.remaining_today,
      limit: usage.limit,
      isSynced: true,
    };
  } catch {
    if (snapshot && snapshot.dayKey === dayKey) {
      const total = snapshot.syncedUsedToday + snapshot.runtimeUsedCount;
      return {
        usedToday: total,
        remainingToday: Math.max(0, snapshot.limit - total),
        limit: snapshot.limit,
        isSynced: false,
      };
    }
    return getDefaultUsage();
  }
}

async function incrementRuntimeUsage(count) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const stored = await chrome.storage.session.get(USAGE_SESSION_KEY);
  const snapshot = stored[USAGE_SESSION_KEY];

  if (!snapshot || snapshot.dayKey !== dayKey) {
    await getUsageSnapshot(true);
    return incrementRuntimeUsage(count);
  }

  const nextSnapshot = {
    ...snapshot,
    runtimeUsedCount: snapshot.runtimeUsedCount + count,
  };
  await chrome.storage.session.set({ [USAGE_SESSION_KEY]: nextSnapshot });
}

async function getSessionState() {
  const auth = await getAuthRecord();
  const settings = await getSettings();
  const usage = await getUsageSnapshot(true);

  return {
    isAuthenticated: Boolean(auth?.accessToken),
    user: auth?.user || null,
    settings,
    usage,
  };
}

async function loginWithGoogle(interactive) {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", interactive ? "select_account consent" : "none");

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive,
  });

  if (!callbackUrl) {
    throw new Error("Google sign-in did not return a redirect URL.");
  }

  const code = new URL(callbackUrl).searchParams.get("code");
  if (!code) {
    throw new Error("Google sign-in did not return an auth code.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/google/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.detail || "Google exchange failed.");
    error.status = response.status;
    throw error;
  }

  await setAuthRecord({
    accessToken: data.access_token,
    expiresAt: data.expires_at,
    user: data.user,
  });
  await getUsageSnapshot(true);

  return {
    user: data.user,
    usage: await getUsageSnapshot(false),
  };
}

async function logout() {
  await clearAuthRecord();
  await chrome.storage.session.remove(USAGE_SESSION_KEY);
  return { success: true };
}

async function rewritePosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return {
      results: [],
      processed_count: 0,
    };
  }

  const settings = await getSettings();
  const body = { posts };

  if (settings.theme === "custom" && settings.custom_prompt) {
    body.custom_prompt = settings.custom_prompt;
  }

  const response = await authenticatedFetch("/rewrite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  incrementRuntimeUsage(data.processed_count || 0);
  return data;
}

async function authenticatedFetch(path, init = {}, allowRefresh = true) {
  const auth = await getAuthRecord();
  if (!auth?.accessToken) {
    const error = new Error("Sign in first.");
    error.status = 401;
    throw error;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${auth.accessToken}`,
    },
  });

  if (response.status === 401 && allowRefresh) {
    try {
      await loginWithGoogle(false);
      return authenticatedFetch(path, init, false);
    } catch (_error) {
      await logout();
      const error = new Error("Session expired. Sign in again.");
      error.status = 401;
      throw error;
    }
  }

  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_error) {
      // Keep the fallback message if JSON parsing fails.
    }

    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return response;
}
