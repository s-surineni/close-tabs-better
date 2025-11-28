import {
  DEFAULT_TIMEOUT_MINUTES,
  STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES,
  STORAGE_KEY_PROTECTED_DOMAINS
} from "./constants"

export {}

// --- Inactivity Auto-Close Logic ---
let INACTIVITY_LIMIT_MS = DEFAULT_TIMEOUT_MINUTES * 60 * 1000
const tabActivity = {}
// Track active tabs per window (windowId -> tabId)
const activeTabsByWindow = {}
// Enable logging only in development mode
const DEBUG = process.env.NODE_ENV === "development"

function debugLog(...args) {
  // eslint-disable-next-line no-console
  if (DEBUG) console.log("[close-tabs-better]", ...args)
}

// Helper to include tab title in logs when we have a tabId
function debugTabLog(message, tabId, details = {}) {
  try {
    chrome.tabs.get(tabId, (tab) => {
      const tabName = !chrome.runtime.lastError && tab ? tab.title : undefined
      debugLog(message, { tabId, tabName, ...details })
    })
  } catch (e) {
    debugLog(message, { tabId, tabName: undefined, ...details })
  }
}

function formatLocal(ms) {
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short"
    })
  } catch (e) {
    return new Date(ms).toString()
  }
}

// Helper functions
function getStoredProtectedDomains() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY_PROTECTED_DOMAINS], (res) => {
      const domains = res[STORAGE_KEY_PROTECTED_DOMAINS]
      resolve(Array.isArray(domains) ? domains : [])
    })
  })
}

function isUrlProtected(url, protectedDomains) {
  if (
    !url ||
    !Array.isArray(protectedDomains) ||
    protectedDomains.length === 0
  ) {
    return false
  }

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    return protectedDomains.some((domain) => {
      const cleanDomain = domain.toLowerCase().trim()
      if (!cleanDomain) return false

      // Support both exact domain matches and subdomain matches
      return hostname === cleanDomain || hostname.endsWith(`.${cleanDomain}`)
    })
  } catch (e) {
    debugLog("isUrlProtected: invalid URL", { url, error: e.message })
    return false
  }
}

function isInstalledApp(tab) {
  if (!tab || !tab.url) return false

  try {
    const url = new URL(tab.url)

    // Check for installed app patterns
    // Edge installed apps often have chrome-extension:// URLs or special schemes
    if (url.protocol === "chrome-extension:") {
      debugLog("isInstalledApp: detected via chrome-extension protocol", {
        url: tab.url,
        protocol: url.protocol,
        title: tab.title
      })
      return true
    }

    // Check for PWA patterns (apps installed from Edge)
    // These often have specific URL patterns or are in app mode
    if (
      tab.url.includes("chrome-extension://") ||
      tab.url.includes("edge-extension://") ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://")
    ) {
      debugLog("isInstalledApp: detected via browser/extension URL patterns", {
        url: tab.url,
        title: tab.title,
        matchedPatterns: [
          tab.url.includes("chrome-extension://") && "chrome-extension://",
          tab.url.includes("edge-extension://") && "edge-extension://",
          tab.url.startsWith("chrome://") && "chrome://",
          tab.url.startsWith("edge://") && "edge://"
        ].filter(Boolean)
      })
      return true
    }

    // Check if tab is in app mode (common for installed PWAs)
    if (
      tab.url.includes("?mode=app") ||
      tab.url.includes("&mode=app") ||
      tab.url.includes("?app=") ||
      tab.url.includes("&app=")
    ) {
      debugLog("isInstalledApp: detected via URL parameters", {
        url: tab.url,
        title: tab.title,
        matchedParameters: [
          tab.url.includes("?mode=app") && "?mode=app",
          tab.url.includes("&mode=app") && "&mode=app",
          tab.url.includes("?app=") && "?app=",
          tab.url.includes("&app=") && "&app="
        ].filter(Boolean)
      })
      return true
    }

    // Check display mode for PWAs
    // PWAs can run in standalone, fullscreen, or minimal-ui modes when installed
    if (
      tab.displayMode === "standalone" ||
      tab.displayMode === "fullscreen" ||
      tab.displayMode === "minimal-ui"
    ) {
      debugLog("isInstalledApp: detected PWA via display mode", {
        url: tab.url,
        displayMode: tab.displayMode,
        title: tab.title
      })
      return true
    }

    return false
  } catch (e) {
    debugLog("isInstalledApp: error checking URL", {
      url: tab.url,
      error: e.message
    })
    return false
  }
}

chrome.action.onClicked.addListener(function handleActionClick(tab) {
  chrome.tabs.query(
    { currentWindow: true },
    async function handleTabsQuery(tabs) {
      const protectedDomains = await getStoredProtectedDomains()
      const tabsToClose = tabs.filter(
        (t) =>
          !t.pinned &&
          t.groupId === -1 &&
          t.id !== tab.id &&
          !isUrlProtected(t.url, protectedDomains) &&
          !isInstalledApp(t)
      )
      if (tabsToClose.length > 0) {
        chrome.tabs.remove(tabsToClose.map((t) => t.id))
      }
    }
  )
})

function scheduleTabAlarm(tabId) {
  const now = Date.now()
  const fireAt = now + INACTIVITY_LIMIT_MS
  debugTabLog("scheduleTabAlarm", tabId, {
    now: formatLocal(now),
    fireAt: formatLocal(fireAt),
    delayMinutes: Math.round(INACTIVITY_LIMIT_MS / 60000),
    INACTIVITY_LIMIT_MS
  })
  chrome.alarms.create(`close-tab-${tabId}`, {
    when: fireAt
  })
}

function updateTabActivity(tabId) {
  const now = Date.now()
  const prev = tabActivity[tabId]
  tabActivity[tabId] = now
  debugTabLog("updateTabActivity", tabId, {
    previous: prev ? formatLocal(prev) : null,
    now: formatLocal(now),
    deltaSeconds: prev ? Math.round((now - prev) / 1000) : null
  })
  scheduleTabAlarm(tabId)
}

function clearTabAlarm(tabId) {
  chrome.alarms.clear(`close-tab-${tabId}`)
}

// Async settings bootstrap using await to eliminate startup races
function getStoredTimeoutMinutes() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES], (res) => {
      const raw = res[STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES]
      const normalized = typeof raw === "number" ? raw : Number(raw)
      resolve(normalized)
    })
  })
}

async function init() {
  try {
    const minutes = await getStoredTimeoutMinutes()
    debugLog("init: loaded timeout from storage", {
      minutes,
      type: typeof minutes,
      loadedAt: formatLocal(Date.now())
    })

    if (typeof minutes === "number" && minutes > 0) {
      INACTIVITY_LIMIT_MS = minutes * 60 * 1000
      debugLog("init: applied stored timeout", {
        minutes,
        INACTIVITY_LIMIT_MS,
        hours: Math.round(INACTIVITY_LIMIT_MS / 3600000)
      })
    } else {
      debugLog("init: using default timeout", {
        INACTIVITY_LIMIT_MS,
        hours: Math.round(INACTIVITY_LIMIT_MS / 3600000)
      })
    }
  } catch (error) {
    debugLog("init: error loading timeout, using default", {
      error: error.message
    })
  }

  // Schedule alarms for any activity recorded before settings were ready (likely none now)
  Object.keys(tabActivity).forEach((tabId) => {
    scheduleTabAlarm(Number(tabId))
  })

  // Register listeners after settings are loaded to avoid races
  // Listen for changes from options page
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "UPDATE_TIMEOUT") {
      INACTIVITY_LIMIT_MS = msg.timeout * 60 * 1000
      // Reschedule all alarms
      Object.keys(tabActivity).forEach((tabId) => {
        scheduleTabAlarm(Number(tabId))
      })
    } else if (msg.type === "UPDATE_PROTECTED_DOMAINS") {
      debugLog("protected domains updated", { domains: msg.domains })
      // No need to reschedule alarms as the check happens at close time
    }
  })

  // Listen for tab activation (user switches to tab)
  chrome.tabs.onActivated.addListener(({ tabId, previousTabId, windowId }) => {
    try {
      chrome.tabs.get(tabId, (toTab) => {
        if (previousTabId) {
          chrome.tabs.get(previousTabId, (fromTab) => {
            debugLog("onActivated", {
              windowId,
              from: previousTabId,
              fromTabName:
                !chrome.runtime.lastError && fromTab
                  ? fromTab.title
                  : undefined,
              to: tabId,
              toTabName:
                !chrome.runtime.lastError && toTab ? toTab.title : undefined
            })
          })
        } else {
          debugLog("onActivated", {
            windowId,
            from: previousTabId,
            fromTabName: undefined,
            to: tabId,
            toTabName:
              !chrome.runtime.lastError && toTab ? toTab.title : undefined
          })
        }
      })
    } catch (e) {
      debugLog("onActivated", { windowId, from: previousTabId, to: tabId })
    }
    if (previousTabId) {
      // Update the previous tab's activity time when leaving it
      updateTabActivity(previousTabId)
    }

    // Track active tab per window
    activeTabsByWindow[windowId] = tabId
    updateTabActivity(tabId)
  })

  // Listen for tab updates (navigation, reload, etc.)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "complete") {
      updateTabActivity(tabId)
    }

    // Handle pin state changes
    if (changeInfo.pinned !== undefined) {
      debugTabLog("pinChange", tabId, {
        pinned: changeInfo.pinned,
        groupId: changeInfo.groupId
      })
      if (!changeInfo.pinned && changeInfo.groupId === -1) {
        // Tab was unpinned and is ungrouped - start tracking it
        updateTabActivity(tabId)
      } else if (changeInfo.pinned) {
        // Tab was pinned - stop tracking it
        delete tabActivity[tabId]
        clearTabAlarm(tabId)
      }
    }
  })

  // Listen for tab removal (cleanup)
  chrome.tabs.onRemoved.addListener((tabId) => {
    debugTabLog("onRemoved", tabId)
    delete tabActivity[tabId]
    clearTabAlarm(tabId)
    // Remove from active tabs tracking if it was active
    Object.keys(activeTabsByWindow).forEach((windowId) => {
      if (activeTabsByWindow[windowId] === tabId) {
        delete activeTabsByWindow[windowId]
      }
    })
  })
  
  // Listen for window removal (cleanup)
  chrome.windows.onRemoved.addListener((windowId) => {
    debugLog("onWindowRemoved", { windowId })
    delete activeTabsByWindow[windowId]
  })

  // Listen for alarm to close tab
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith("close-tab-")) {
      const tabId = parseInt(alarm.name.replace("close-tab-", ""), 10)
      const firedAt = formatLocal(Date.now())
      // Fetch tab info to include title in the log and then evaluate
      chrome.tabs.get(tabId, async (tab) => {
        if (chrome.runtime.lastError || !tab) {
          debugLog("onAlarm fired", {
            time: firedAt,
            tabId,
            tabName: undefined,
            alarm: alarm.name,
            note: "tab missing"
          })
          return // Tab already closed
        }
        
        // Check if this tab is active in any window
        const isActiveInAnyWindow = Object.values(activeTabsByWindow).includes(tabId)
        debugLog("onAlarm fired", {
          time: firedAt,
          tabId,
          tabName: tab.title,
          alarm: alarm.name,
          windowId: tab.windowId,
          isActiveInAnyWindow,
          activeTabsByWindow
        })
        
        // Do not close tabs that are currently active in any window
        if (isActiveInAnyWindow) {
          debugLog("skip close: tab is active in a window", {
            tabId,
            tabName: tab.title,
            windowId: tab.windowId
          })
          return
        }
        const lastActive = tabActivity[tabId] || 0
        const inactiveMs = Date.now() - lastActive
        if (inactiveMs >= INACTIVITY_LIMIT_MS) {
          // Do not close tabs that are currently playing audio
          if (tab.audible) {
            debugLog("skip close: tab is audible", {
              tabId,
              tabName: tab.title
            })
            scheduleTabAlarm(tabId)
            return
          }

          // Do not close installed apps (PWAs from Edge)
          if (isInstalledApp(tab)) {
            debugLog("skip close: installed app", {
              tabId,
              tabName: tab.title,
              url: tab.url
            })
            scheduleTabAlarm(tabId)
            return
          }

          // Only close if still unpinned and ungrouped
          if (!tab.pinned && tab.groupId === -1) {
            // Check if URL is protected before closing
            const protectedDomains = await getStoredProtectedDomains()
            if (isUrlProtected(tab.url, protectedDomains)) {
              debugLog("skip close: protected domain", {
                tabId,
                tabName: tab.title,
                url: tab.url,
                protectedDomains
              })
              // Reschedule the alarm since we're not closing this tab
              scheduleTabAlarm(tabId)
              return
            }

            debugLog("closing tab due to inactivity", {
              tabId,
              tabName: tab.title,
              inactiveMs
            })
            chrome.tabs.remove(tabId)
            delete tabActivity[tabId]
          } else {
            // If tab is now pinned or grouped, stop tracking it
            debugLog("stop tracking (pinned/grouped)", {
              tabId,
              tabName: tab.title,
              pinned: tab.pinned,
              groupId: tab.groupId
            })
            delete tabActivity[tabId]
          }
        } else {
          // User became active again, reschedule
          debugLog("reschedule: recently active", {
            tabId,
            tabName: tab.title,
            inactiveMs
          })
          scheduleTabAlarm(tabId)
        }
      })
    }
  })

  // On extension startup, initialize activity for all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.pinned && tab.groupId === -1) {
        updateTabActivity(tab.id)
      }
    })
  })
  
  // Initialize active tabs tracking for all windows
  chrome.windows.getAll({ populate: false }, (windows) => {
    windows.forEach((window) => {
      chrome.tabs.query({ windowId: window.id, active: true }, (tabs) => {
        if (tabs.length > 0) {
          activeTabsByWindow[window.id] = tabs[0].id
        }
      })
    })
  })
}

// Plasmo bundles background as an ES module, but some tooling may not allow top-level await.
// Call init without awaiting to avoid parse errors while still racing early listeners less.
init()

// Handle service worker restarts (e.g., after screen lock/unlock)
chrome.runtime.onStartup.addListener(() => {
  debugLog("onStartup: service worker restarted, reinitializing")
  init()
})

chrome.runtime.onInstalled.addListener(() => {
  debugLog("onInstalled: extension installed/updated, initializing")
  init()
})
