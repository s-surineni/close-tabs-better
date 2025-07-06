chrome.action.onClicked.addListener(function handleActionClick(tab) {
  chrome.tabs.query({ currentWindow: true }, function handleTabsQuery(tabs) {
    const tabsToClose = tabs.filter(
      (t) => !t.pinned && t.groupId === -1 && t.id !== tab.id
    )
    if (tabsToClose.length > 0) {
      chrome.tabs.remove(tabsToClose.map((t) => t.id))
    }
  })
})

// --- Inactivity Auto-Close Logic ---
let INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000 // 2 hours default
const tabActivity = {}

function scheduleTabAlarm(tabId) {
  chrome.alarms.create(`close-tab-${tabId}`, {
    when: Date.now() + INACTIVITY_LIMIT_MS
  })
}

function updateTabActivity(tabId) {
  tabActivity[tabId] = Date.now()
  scheduleTabAlarm(tabId)
}

function clearTabAlarm(tabId) {
  chrome.alarms.clear(`close-tab-${tabId}`)
}

// Load timeout from storage
chrome.storage.sync.get(["inactivityTimeoutMinutes"], (result) => {
  if (result.inactivityTimeoutMinutes) {
    INACTIVITY_LIMIT_MS = result.inactivityTimeoutMinutes * 60 * 1000
  }
})

// Listen for changes from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "UPDATE_TIMEOUT") {
    INACTIVITY_LIMIT_MS = msg.timeout * 60 * 1000
    // Reschedule all alarms
    Object.keys(tabActivity).forEach((tabId) => {
      scheduleTabAlarm(Number(tabId))
    })
  }
})

// Listen for tab activation (user switches to tab)
chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateTabActivity(tabId)
})

// Listen for tab updates (navigation, reload, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    updateTabActivity(tabId)
  }
})

// Listen for tab removal (cleanup)
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabActivity[tabId]
  clearTabAlarm(tabId)
})

// Listen for alarm to close tab
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("close-tab-")) {
    const tabId = parseInt(alarm.name.replace("close-tab-", ""), 10)
    // Check if tab is still inactive
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return // Tab already closed
      const lastActive = tabActivity[tabId] || 0
      if (Date.now() - lastActive >= INACTIVITY_LIMIT_MS) {
        chrome.tabs.remove(tabId)
        delete tabActivity[tabId]
      } else {
        // User became active again, reschedule
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
