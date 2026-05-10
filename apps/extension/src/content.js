const SETTINGS_STORAGE_KEY = "gmasti_settings";
const AUTH_STORAGE_KEY = "gmasti_auth";
const CACHE_KEY_PREFIX = "gmasti_cache";
const MAX_POSTS_PER_WINDOW = 10;
const EXTRA_POSTS_BELOW = 3;
const MAX_CACHE_ENTRIES = 500;
const DEFAULT_SETTINGS = {
  enabled: true,
  theme: "random",
};
const CONCRETE_THEMES = [
  "medieval_victorian_english",
  "genz_slop",
  "caveman",
  "anime_kitten_uwu",
  "hood_lingo",
];
const MESSAGE_TYPES = {
  REWRITE_POSTS: "REWRITE_POSTS",
};
const DEBUG_PREFIX = "[Gmasti]";
const PLATFORM_SELECTORS = {
  x: {
    container: "article",
    text: '[data-testid="tweetText"]',
    postLink: 'a[href*="/status/"]',
  },
  linkedin: {
    container: '[data-testid="mainFeed"] [role="listitem"]',
    text: 'span[data-testid="expandable-text-box"]',
    postLink: 'a[href*="/feed/update/"], a[href*="/posts/"], a[href*="urn:li:activity:"], a[href*="urn:li:ugcPost:"]',
  },
};

const runtimeState = {
  settings: DEFAULT_SETTINGS,
  scanTimer: null,
  inFlightKeys: new Set(),
  originalTextTargets: new WeakMap(),
  authCooldownUntil: 0,
  rateLimitCooldownUntil: 0,
  customPromptHash: "",
};

init().catch((error) => {
  console.error("Gmasti init failed:", error);
});

async function init() {
  if (!isSupportedHost()) {
    return;
  }

  console.info(`${DEBUG_PREFIX} content script active on`, window.location.hostname, window.location.pathname);
  injectStyles();
  await loadSettings();

  window.addEventListener("scroll", () => scheduleScan(500), { passive: true });
  window.addEventListener("resize", () => scheduleScan(500));

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => !isGmastiMutation(m))) {
      scheduleScan(500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[SETTINGS_STORAGE_KEY]) {
      runtimeState.settings = {
        ...DEFAULT_SETTINGS,
        ...(changes[SETTINGS_STORAGE_KEY].newValue || {}),
      };
      runtimeState.customPromptHash = runtimeState.settings.custom_prompt
        ? simpleHash(runtimeState.settings.custom_prompt)
        : "";

      if (!runtimeState.settings.enabled) {
        restoreOriginalTexts();
      }

      scheduleScan(50);
    }

    if (changes[AUTH_STORAGE_KEY]) {
      runtimeState.authCooldownUntil = 0;
      runtimeState.rateLimitCooldownUntil = 0;
      scheduleScan(50);
    }
  });

  scheduleScan(400);
}

function isGmastiMutation(mutation) {
  if (mutation.type === "attributes") {
    return false;
  }
  const target = mutation.target;
  if (target && target.closest) {
    return !!target.closest(".gmasti-rewritten-text, .gmasti-loader, [data-gmasti-original-text]");
  }
  return false;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  runtimeState.settings = {
    ...DEFAULT_SETTINGS,
    ...(stored[SETTINGS_STORAGE_KEY] || {}),
  };
  runtimeState.customPromptHash = runtimeState.settings.custom_prompt
    ? simpleHash(runtimeState.settings.custom_prompt)
    : "";
}

function scheduleScan(delay = 500) {
  clearTimeout(runtimeState.scanTimer);
  runtimeState.scanTimer = window.setTimeout(() => {
    scanAndRewrite().catch((error) => {
      console.error("Gmasti scan failed:", error);
    });
  }, delay);
}

async function scanAndRewrite() {
  if (!runtimeState.settings.enabled) {
    return;
  }

  if (Date.now() < runtimeState.authCooldownUntil || Date.now() < runtimeState.rateLimitCooldownUntil) {
    return;
  }

  const posts = collectWindowPosts();
  if (posts.length === 0) {
    return;
  }

  const themedPosts = posts.map((post) => {
    const theme = resolveTheme(post.postUrl, runtimeState.settings.theme);
    return {
      ...post,
      theme,
      cacheKey: makeCacheKey(post.platform, post.postUrl, theme),
    };
  });

  const uncachedPosts = themedPosts.filter(
    (post) => !post.textElement.dataset.gmastiGeneratedText
  );

  if (uncachedPosts.length === 0) {
    return;
  }

  const cacheLookup = await chrome.storage.local.get(uncachedPosts.map((post) => post.cacheKey));
  const missingPosts = [];

  for (const post of uncachedPosts) {
    const cachedEntry = cacheLookup[post.cacheKey];
    if (cachedEntry?.generated) {
      applyReplacement(post.textElement, cachedEntry.generated, post.theme, post.platform);
      continue;
    }

    if (!runtimeState.inFlightKeys.has(post.cacheKey)) {
      runtimeState.inFlightKeys.add(post.cacheKey);
      showLoader(post.container);
      missingPosts.push(post);
    }
  }

  if (missingPosts.length === 0) {
    return;
  }

  try {
    const response = await sendMessage(MESSAGE_TYPES.REWRITE_POSTS, {
      posts: missingPosts.map((post) => ({
        platform: post.platform,
        original: post.originalText,
        post_url: post.postUrl,
        theme: post.theme,
      })),
    });

    const cacheWrites = {};
    for (const result of response.results || []) {
      const cacheKey = makeCacheKey(result.platform, result.post_url, result.theme);
      cacheWrites[cacheKey] = {
        generated: result.generated,
        theme: result.theme,
        savedAt: Date.now(),
      };
    }

    if (Object.keys(cacheWrites).length > 0) {
      await chrome.storage.local.set(cacheWrites);
      pruneCache();
    }

    for (const post of missingPosts) {
      const matched = (response.results || []).find(
        (item) => item.post_url === post.postUrl && item.theme === post.theme,
      );

      if (matched) {
        applyReplacement(post.textElement, matched.generated, post.theme, post.platform);
      }
    }
  } catch (error) {
    if (error.status === 401) {
      runtimeState.authCooldownUntil = Date.now() + 30_000;
    } else if (error.status === 429) {
      runtimeState.rateLimitCooldownUntil = Date.now() + 300_000;
    }
    console.warn("Gmasti rewrite skipped:", error.message);
  } finally {
    for (const post of missingPosts) {
      runtimeState.inFlightKeys.delete(post.cacheKey);
      hideLoader(post.container);
    }
  }
}

async function pruneCache() {
  const all = await chrome.storage.local.get(null);
  const cacheEntries = Object.entries(all).filter(([key]) => key.startsWith(CACHE_KEY_PREFIX));

  if (cacheEntries.length <= MAX_CACHE_ENTRIES) {
    return;
  }

  cacheEntries.sort((a, b) => (a[1]?.savedAt || 0) - (b[1]?.savedAt || 0));
  const toRemove = cacheEntries.slice(0, cacheEntries.length - MAX_CACHE_ENTRIES).map(([key]) => key);
  await chrome.storage.local.remove(toRemove);
}

function collectWindowPosts() {
  const platform = getPlatform();
  const discovered = dedupePosts(platform === "x" ? collectXPosts() : collectLinkedInPosts());

  const sorted = discovered
    .filter(Boolean)
    .sort((left, right) => left.rect.top - right.rect.top);

  if (sorted.length === 0) {
    return [];
  }

  const visibleIndexes = sorted
    .map((post, index) => (isVisible(post.rect) ? index : -1))
    .filter((index) => index >= 0);

  if (visibleIndexes.length === 0) {
    return sorted.slice(0, MAX_POSTS_PER_WINDOW).map(stripRect);
  }

  const startIndex = visibleIndexes[0];
  const lastVisibleIndex = visibleIndexes[visibleIndexes.length - 1];
  const endIndex = Math.min(
    sorted.length,
    Math.min(startIndex + MAX_POSTS_PER_WINDOW, lastVisibleIndex + 1 + EXTRA_POSTS_BELOW),
  );

  return sorted.slice(startIndex, endIndex).map(stripRect);
}

function collectXPosts() {
  const selectors = PLATFORM_SELECTORS.x;

  return Array.from(document.querySelectorAll(selectors.container))
    .map((article) => {
      const textElement = article.querySelector(selectors.text);
      const linkElement = article.querySelector(selectors.postLink);

      if (!textElement || !linkElement) {
        return null;
      }

      const originalText = getOriginalText(textElement);
      const postUrl = extractXSlug(linkElement.href);

      if (!originalText || !postUrl) {
        return null;
      }

      return {
        platform: "x",
        postUrl,
        originalText,
        container: article,
        textElement,
        rect: article.getBoundingClientRect(),
      };
    })
    .filter(Boolean);
}

function collectLinkedInPosts() {
  const selectors = PLATFORM_SELECTORS.linkedin;
  const containers = Array.from(document.querySelectorAll(selectors.container));

  return containers
    .map((container) => {
      if (!isLinkedInFeedPost(container) || isPromotedLinkedInPost(container)) {
        return null;
      }

      const textElement = findLinkedInTextElement(container);
      const postUrl = findLinkedInPostIdentifier(container);

      if (!textElement || !postUrl) {
        return null;
      }

      const originalText = getOriginalText(textElement);

      if (!originalText || !postUrl) {
        return null;
      }

      return {
        platform: "linkedin",
        postUrl,
        originalText,
        container,
        textElement,
        rect: container.getBoundingClientRect(),
      };
    })
    .filter(Boolean);
}

function findLinkedInTextElement(container) {
  const textElement = container.querySelector(PLATFORM_SELECTORS.linkedin.text);
  return textElement && normalizeText(textElement.innerText) ? textElement : null;
}

function isLinkedInFeedPost(container) {
  const headingText = normalizeText(container.querySelector("h2")?.innerText || "");
  return headingText === "Feed post" && Boolean(findLinkedInTextElement(container));
}

function findLinkedInPostIdentifier(container) {
  const directUrn =
    container.getAttribute("data-urn") ||
    container.getAttribute("data-id") ||
    container.getAttribute("componentkey");

  const urnSlug = extractLinkedInSlug(directUrn || "");
  if (urnSlug) {
    return urnSlug;
  }

  const linkElement = container.querySelector(PLATFORM_SELECTORS.linkedin.postLink);
  const linkSlug = extractLinkedInSlug(linkElement?.href || "");
  if (linkSlug) {
    return linkSlug;
  }

  const textElement = findLinkedInTextElement(container);
  const textSeed = normalizeText(textElement?.innerText || "").slice(0, 200);
  if (!textSeed) {
    return null;
  }

  return `linkedin-fallback:${simpleHash(textSeed)}`;
}

function dedupePosts(posts) {
  const uniquePosts = new Map();

  for (const post of posts) {
    const key = `${post.platform}:${post.postUrl}`;
    if (!uniquePosts.has(key)) {
      uniquePosts.set(key, post);
    }
  }

  return Array.from(uniquePosts.values());
}

function applyReplacement(textElement, generatedText, theme, platform) {
  const displayText = normalizeGeneratedText(generatedText);

  rememberOriginalTextTarget(textElement);

  if (textElement.dataset.gmastiGeneratedText === displayText) {
    textElement.dataset.gmastiTheme = theme;
    return;
  }

  textElement.classList.add("gmasti-swap-out");

  window.setTimeout(() => {
    renderTextWithLineBreaks(textElement, displayText);
    textElement.dataset.gmastiGeneratedText = displayText;
    textElement.classList.remove("gmasti-swap-out");
    textElement.classList.add("gmasti-rewritten-text");
  }, 90);

  textElement.dataset.gmastiTheme = theme;
}

function applyLinkedInReplacement(textElement, generatedText, theme) {
  applyReplacement(textElement, generatedText, theme, "linkedin");
}

function rememberOriginalTextTarget(textElement) {
  if (!textElement.dataset.gmastiOriginalText) {
    textElement.dataset.gmastiOriginalText = preservePostText(textElement.innerText);
    runtimeState.originalTextTargets.set(textElement, {
      html: textElement.innerHTML,
    });
  }
}

function renderTextWithLineBreaks(targetElement, text) {
  const fragment = document.createDocumentFragment();
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (line) {
      fragment.appendChild(document.createTextNode(line));
    }

    if (index < lines.length - 1) {
      fragment.appendChild(document.createElement("br"));
    }
  });

  targetElement.replaceChildren(fragment);
}

function restoreOriginalTexts() {
  const rewrittenElements = document.querySelectorAll("[data-gmasti-original-text]");
  for (const element of rewrittenElements) {
    const originalTarget = runtimeState.originalTextTargets.get(element);

    if (originalTarget?.html) {
      element.innerHTML = originalTarget.html;
    } else if (element.dataset.gmastiOriginalText) {
      element.textContent = element.dataset.gmastiOriginalText;
    }

    runtimeState.originalTextTargets.delete(element);

    element.classList.remove("gmasti-rewritten-text", "gmasti-swap-out");
    delete element.dataset.gmastiOriginalText;
    delete element.dataset.gmastiGeneratedText;
    delete element.dataset.gmastiPendingText;
    delete element.dataset.gmastiTheme;
  }
}

function showLoader(container) {
  if (container.querySelector(".gmasti-loader")) {
    return;
  }

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const loader = document.createElement("div");
  loader.className = "gmasti-loader";
  loader.textContent = "Rewriting";
  container.appendChild(loader);
}

function hideLoader(container) {
  container.querySelector(".gmasti-loader")?.remove();
}

function injectStyles() {
  if (document.getElementById("gmasti-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "gmasti-styles";
  style.textContent = `
    .gmasti-loader {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      pointer-events: none;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      padding: 4px 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
    }

    .gmasti-rewritten-text {
      transition: opacity 160ms ease;
      white-space: pre-wrap;
    }

    .gmasti-swap-out {
      opacity: 0.35;
      transition: opacity 90ms ease;
    }
  `;
  document.head.appendChild(style);
}

async function sendMessage(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) {
    const error = new Error(response?.error || "Unknown runtime error");
    error.status = response?.status || null;
    throw error;
  }
  return response.data;
}

function makeCacheKey(platform, postUrl, theme) {
  return `${CACHE_KEY_PREFIX}:${platform}:${postUrl}:${theme}`;
}

function resolveTheme(postUrl, selectedTheme) {
  if (selectedTheme === "custom") {
    return runtimeState.customPromptHash || "custom";
  }

  if (selectedTheme !== "random") {
    return selectedTheme;
  }

  const hash = Array.from(postUrl).reduce((total, character) => total + character.charCodeAt(0), 0);
  return CONCRETE_THEMES[hash % CONCRETE_THEMES.length];
}

function normalizeText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function getOriginalText(textElement) {
  return textElement.dataset.gmastiOriginalText || preservePostText(textElement.innerText);
}

function preservePostText(value) {
  return (value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeGeneratedText(value) {
  return preservePostText((value || "").replace(/\\n/g, "\n"));
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function extractXSlug(rawUrl) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const statusIndex = parts.indexOf("status");
    return statusIndex >= 0 ? parts[statusIndex + 1] || null : null;
  } catch (_error) {
    return null;
  }
}

function extractLinkedInSlug(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    if (rawUrl.startsWith("urn:li:")) {
      return rawUrl;
    }

    const url = new URL(rawUrl, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    const updateIndex = parts.indexOf("update");
    if (updateIndex >= 0) {
      return parts[updateIndex + 1] || null;
    }

    const postsIndex = parts.indexOf("posts");
    if (postsIndex >= 0) {
      return parts[postsIndex + 1] || parts.at(-1) || null;
    }

    const urnMatch = rawUrl.match(/urn:li:(activity|ugcPost):[A-Za-z0-9_-]+/);
    if (urnMatch) {
      return urnMatch[0];
    }

    return parts.at(-1) || null;
  } catch (_error) {
    const urnMatch = rawUrl.match(/urn:li:(activity|ugcPost):[A-Za-z0-9_-]+/);
    return urnMatch ? urnMatch[0] : null;
  }
}

function isVisible(rect) {
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function stripRect(post) {
  const { rect, ...rest } = post;
  return rest;
}

function isSupportedHost() {
  return getPlatform() !== null;
}

function getPlatform() {
  if (window.location.hostname === "x.com") {
    return "x";
  }
  if (window.location.hostname.endsWith("linkedin.com")) {
    return "linkedin";
  }
  return null;
}

function isPromotedLinkedInPost(container) {
  return Array.from(container.querySelectorAll("span"))
    .some((node) => normalizeText(node.innerText) === "Promoted");
}
