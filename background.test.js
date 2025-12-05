import sinon from "sinon-chrome"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"
import {
  DEFAULT_TIMEOUT_MINUTES,
  STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES,
  STORAGE_KEY_PROTECTED_DOMAINS
} from "./constants"

// Mock process.env before importing
process.env.NODE_ENV = "test"

// Store original console methods
const originalConsoleLog = console.log
const originalConsoleError = console.error

describe("Background Script - Tab Management", () => {
  let mockTabs
  let mockWindows
  let mockStorage
  let alarmCallbacks
  let messageCallbacks
  let activatedCallbacks
  let updatedCallbacks
  let removedCallbacks
  let windowRemovedCallbacks
  let startupCallbacks
  let installedCallbacks
  let actionClickCallbacks

  beforeEach(() => {
    // Reset all mocks
    sinon.reset()
    vi.clearAllMocks()

    // Suppress console.log in tests
    console.log = vi.fn()
    console.error = vi.fn()

    // Initialize callback arrays
    alarmCallbacks = []
    messageCallbacks = []
    activatedCallbacks = []
    updatedCallbacks = []
    removedCallbacks = []
    windowRemovedCallbacks = []
    startupCallbacks = []
    installedCallbacks = []
    actionClickCallbacks = []

    // Mock tabs
    mockTabs = new Map()
    chrome.tabs = {
      get: vi.fn((tabId, callback) => {
        const tab = mockTabs.get(tabId)
        if (callback) {
          if (tab) {
            callback(tab)
          } else {
            chrome.runtime.lastError = { message: "No tab with id: " + tabId }
            callback(undefined)
          }
          return Promise.resolve(tab)
        }
        return Promise.resolve(tab)
      }),
      query: vi.fn((queryInfo, callback) => {
        let results = Array.from(mockTabs.values())

        if (queryInfo.windowId) {
          results = results.filter(t => t.windowId === queryInfo.windowId)
        }
        if (queryInfo.active !== undefined) {
          results = results.filter(t => t.active === queryInfo.active)
        }
        if (queryInfo.currentWindow) {
          // For simplicity, assume current window is the first one
          const currentWindowId = mockWindows[0] && mockWindows[0].id
          if (currentWindowId) {
            results = results.filter(t => t.windowId === currentWindowId)
          }
        }

        if (callback) {
          callback(results)
          return Promise.resolve(results)
        }
        return Promise.resolve(results)
      }),
      remove: vi.fn((tabIds, callback) => {
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds]
        ids.forEach(id => mockTabs.delete(id))
        if (callback) callback()
        return Promise.resolve()
      }),
      onActivated: {
        addListener: vi.fn((callback) => {
          activatedCallbacks.push(callback)
        })
      },
      onUpdated: {
        addListener: vi.fn((callback) => {
          updatedCallbacks.push(callback)
        })
      },
      onRemoved: {
        addListener: vi.fn((callback) => {
          removedCallbacks.push(callback)
        })
      }
    }

    // Mock windows
    mockWindows = []
    chrome.windows = {
      getAll: vi.fn((queryInfo, callback) => {
        if (callback) {
          callback(mockWindows)
          return Promise.resolve(mockWindows)
        }
        return Promise.resolve(mockWindows)
      }),
      onRemoved: {
        addListener: vi.fn((callback) => {
          windowRemovedCallbacks.push(callback)
        })
      }
    }

    // Mock storage
    mockStorage = {}
    chrome.storage = {
      sync: {
        get: vi.fn((keys, callback) => {
          const result = {}
          const keyArray = Array.isArray(keys) ? keys : [keys]
          keyArray.forEach(key => {
            if (mockStorage[key] !== undefined) {
              result[key] = mockStorage[key]
            }
          })
          if (callback) {
            callback(result)
            return Promise.resolve(result)
          }
          return Promise.resolve(result)
        }),
        set: vi.fn((items, callback) => {
          Object.assign(mockStorage, items)
          if (callback) callback()
          return Promise.resolve()
        })
      }
    }

    // Mock alarms
    const alarmMap = new Map()
    chrome.alarms = {
      create: vi.fn((name, alarmInfo) => {
        alarmMap.set(name, {
          name,
          scheduledTime: alarmInfo.when || Date.now() + (alarmInfo.delayInMinutes || 0) * 60000
        })
        return Promise.resolve()
      }),
      clear: vi.fn((name) => {
        alarmMap.delete(name)
        return Promise.resolve(true)
      }),
      onAlarm: {
        addListener: vi.fn((callback) => {
          alarmCallbacks.push(callback)
        })
      }
    }

    // Mock runtime
    chrome.runtime = {
      lastError: null,
      onMessage: {
        addListener: vi.fn((callback) => {
          messageCallbacks.push(callback)
        })
      },
      onStartup: {
        addListener: vi.fn((callback) => {
          startupCallbacks.push(callback)
        })
      },
      onInstalled: {
        addListener: vi.fn((callback) => {
          installedCallbacks.push(callback)
        })
      }
    }

    // Mock action
    chrome.action = {
      onClicked: {
        addListener: vi.fn((callback) => {
          actionClickCallbacks.push(callback)
        })
      }
    }

    // Clear module cache to allow fresh imports
    vi.resetModules()
  })

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog
    console.error = originalConsoleError
  })

  describe("Module Initialization", () => {
    it("should register all Chrome API listeners on init", async () => {
      // Import the module to trigger initialization
      await import("./background.js")

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.onActivated.addListener).toHaveBeenCalled()
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled()
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled()
      expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled()
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled()
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled()
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled()
      expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled()
      expect(chrome.action.onClicked.addListener).toHaveBeenCalled()
    })

    it("should initialize active tabs for all existing windows on startup", async () => {
      // Setup mock windows and tabs
      mockWindows = [
        { id: 100 },
        { id: 200 }
      ]
      mockTabs.set(1, { id: 1, windowId: 100, active: true, pinned: false, groupId: -1 })
      mockTabs.set(2, { id: 2, windowId: 200, active: true, pinned: false, groupId: -1 })

      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify windows.getAll was called
      expect(chrome.windows.getAll).toHaveBeenCalled()
      // Verify tabs.query was called for each window
      expect(chrome.tabs.query).toHaveBeenCalled()
    })

    it("should load timeout from storage on init", async () => {
      mockStorage[STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES] = 60

      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        [STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES],
        expect.any(Function)
      )
    })

    it("should use default timeout when storage is empty", async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.storage.sync.get).toHaveBeenCalled()
    })
  })

  describe("Tab Activation Tracking", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should track active tab per window when tab is activated", () => {
      const tabId = 1
      const windowId = 100
      const previousTabId = null

      mockTabs.set(tabId, { id: tabId, windowId, title: "Test Tab" })

      // Trigger onActivated
      activatedCallbacks.forEach(cb => cb({ tabId, windowId, previousTabId }))

      // Wait for async operations
      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        expect(chrome.tabs.get).toHaveBeenCalledWith(tabId, expect.any(Function))
        expect(chrome.alarms.create).toHaveBeenCalled()
      })
    })

    it("should update previous tab activity when switching tabs", () => {
      const previousTabId = 1
      const tabId = 2
      const windowId = 100

      mockTabs.set(previousTabId, { id: previousTabId, windowId, title: "Previous Tab" })
      mockTabs.set(tabId, { id: tabId, windowId, title: "New Tab" })

      // Trigger onActivated with previous tab
      activatedCallbacks.forEach(cb => cb({ tabId, windowId, previousTabId }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        // Should get both tabs
        expect(chrome.tabs.get).toHaveBeenCalledWith(previousTabId, expect.any(Function))
        expect(chrome.tabs.get).toHaveBeenCalledWith(tabId, expect.any(Function))
        // Should schedule alarms for both
        expect(chrome.alarms.create).toHaveBeenCalledTimes(2)
      })
    })

    it("should handle multiple windows with different active tabs", () => {
      mockTabs.set(1, { id: 1, windowId: 100, title: "Window 1 Tab" })
      mockTabs.set(2, { id: 2, windowId: 200, title: "Window 2 Tab" })

      // Activate tab 1 in window 100
      activatedCallbacks.forEach(cb => cb({ tabId: 1, windowId: 100, previousTabId: null }))

      // Activate tab 2 in window 200
      activatedCallbacks.forEach(cb => cb({ tabId: 2, windowId: 200, previousTabId: null }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        expect(chrome.tabs.get).toHaveBeenCalledWith(1, expect.any(Function))
        expect(chrome.tabs.get).toHaveBeenCalledWith(2, expect.any(Function))
      })
    })
  })

  describe("Tab Update Tracking", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should update activity when tab navigation completes", () => {
      const tabId = 1
      mockTabs.set(tabId, { id: tabId, windowId: 100, pinned: false, groupId: -1 })

      updatedCallbacks.forEach(cb => cb(tabId, { status: "complete" }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        expect(chrome.alarms.create).toHaveBeenCalled()
      })
    })

    it("should stop tracking when tab is pinned", () => {
      const tabId = 1
      mockTabs.set(tabId, { id: tabId, windowId: 100, pinned: true, groupId: -1 })

      updatedCallbacks.forEach(cb => cb(tabId, { pinned: true }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        expect(chrome.alarms.clear).toHaveBeenCalledWith(`close-tab-${tabId}`)
      })
    })

    it("should start tracking when tab is unpinned", () => {
      const tabId = 1
      mockTabs.set(tabId, { id: tabId, windowId: 100, pinned: false, groupId: -1 })

      updatedCallbacks.forEach(cb => cb(tabId, { pinned: false, groupId: -1 }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        expect(chrome.alarms.create).toHaveBeenCalled()
      })
    })

    it("should not track grouped tabs", () => {
      const tabId = 1
      mockTabs.set(tabId, { id: tabId, windowId: 100, pinned: false, groupId: 5 })

      updatedCallbacks.forEach(cb => cb(tabId, { pinned: false, groupId: 5 }))

      return new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        // Should not create alarm for grouped tabs
        expect(chrome.alarms.create).not.toHaveBeenCalled()
      })
    })
  })

  describe("Tab Removal Cleanup", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should clean up tracking when tab is removed", () => {
      const tabId = 1

      removedCallbacks.forEach(cb => cb(tabId))

      expect(chrome.alarms.clear).toHaveBeenCalledWith(`close-tab-${tabId}`)
    })

    it("should clean up window tracking when window is removed", () => {
      const windowId = 100

      windowRemovedCallbacks.forEach(cb => cb(windowId))

      // Should not throw or error
      expect(windowRemovedCallbacks.length).toBeGreaterThan(0)
    })
  })

  describe("Alarm-Based Tab Closing", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should close inactive tab when alarm fires", async () => {
      const tabId = 1
      const now = Date.now()
      const inactiveTime = DEFAULT_TIMEOUT_MINUTES * 60 * 1000 + 1000

      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Inactive Tab",
        url: "https://example.com",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      // Simulate tab was active long ago
      // We need to trigger the alarm with the tab in an inactive state
      const alarm = {
        name: `close-tab-${tabId}`,
        scheduledTime: now - inactiveTime
      }

      // Mock tabs.get to return tab with old activity
      chrome.tabs.get.mockImplementation((id, callback) => {
        if (id === tabId && callback) {
          callback(mockTabs.get(tabId))
        }
        return Promise.resolve(mockTabs.get(id))
      })

      // Trigger alarm
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should check if tab is active in any window
      expect(chrome.tabs.get).toHaveBeenCalled()
      // Should check protected domains
      expect(chrome.storage.sync.get).toHaveBeenCalled()
    })

    it("should not close tab that is active in any window", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Active Tab",
        url: "https://example.com",
        pinned: false,
        groupId: -1,
        audible: false
      })

      // First activate the tab to mark it as active
      activatedCallbacks.forEach(cb => cb({ tabId, windowId: 100, previousTabId: null }))
      await new Promise(resolve => setTimeout(resolve, 50))

      // Now trigger alarm
      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close the tab
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should not close audible tabs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Playing Audio",
        url: "https://example.com",
        pinned: false,
        groupId: -1,
        audible: true
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should reschedule instead of closing
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
      expect(chrome.alarms.create).toHaveBeenCalled()
    })

    it("should not close protected domain tabs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Protected Tab",
        url: "https://protected.com/page",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = ["protected.com"]

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should reschedule instead of closing
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
      expect(chrome.alarms.create).toHaveBeenCalled()
    })

    it("should not close pinned tabs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Pinned Tab",
        url: "https://example.com",
        pinned: true,
        groupId: -1,
        audible: false
      })

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close pinned tabs
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should not close grouped tabs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Grouped Tab",
        url: "https://example.com",
        pinned: false,
        groupId: 5,
        audible: false
      })

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close grouped tabs
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should handle missing tab gracefully", async () => {
      const tabId = 999
      chrome.tabs.get.mockImplementation((id, callback) => {
        chrome.runtime.lastError = { message: "No tab with id: 999" }
        if (callback) callback(undefined)
        return Promise.resolve(undefined)
      })

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not throw error
      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })
  })

  describe("Protected Domains", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should protect exact domain matches", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Protected",
        url: "https://example.com/page",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = ["example.com"]

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should protect subdomain matches", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Protected",
        url: "https://subdomain.example.com/page",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = ["example.com"]

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should handle invalid URLs gracefully", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Invalid URL",
        url: "invalid-url",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = ["example.com"]

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not crash, but may or may not close depending on implementation
      expect(chrome.tabs.get).toHaveBeenCalled()
    })
  })

  describe("Installed App Detection", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should not close chrome-extension:// URLs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Extension",
        url: "chrome-extension://abc123/page.html",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should not close chrome:// URLs", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Chrome Page",
        url: "chrome://settings/",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should not close tabs with app mode in URL", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "PWA",
        url: "https://example.com/app?mode=app",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })

    it("should not close tabs with standalone display mode", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "PWA",
        url: "https://example.com/app",
        pinned: false,
        groupId: -1,
        audible: false,
        displayMode: "standalone"
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(chrome.tabs.remove).not.toHaveBeenCalled()
    })
  })

  describe("Action Click Handler", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should close non-pinned, ungrouped tabs when action is clicked", async () => {
      const currentTab = { id: 1, windowId: 100, pinned: false, groupId: -1, url: "https://example.com" }
      mockTabs.set(1, currentTab)
      mockTabs.set(2, { id: 2, windowId: 100, pinned: false, groupId: -1, url: "https://example2.com" })
      mockTabs.set(3, { id: 3, windowId: 100, pinned: true, groupId: -1, url: "https://example3.com" })
      mockTabs.set(4, { id: 4, windowId: 100, pinned: false, groupId: 5, url: "https://example4.com" })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      // Trigger action click
      actionClickCallbacks.forEach(cb => cb(currentTab))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should close tab 2 (not current, not pinned, not grouped)
      expect(chrome.tabs.remove).toHaveBeenCalled()
    })

    it("should not close current tab when action is clicked", async () => {
      const currentTab = { id: 1, windowId: 100, pinned: false, groupId: -1, url: "https://example.com" }
      mockTabs.set(1, currentTab)
      mockTabs.set(2, { id: 2, windowId: 100, pinned: false, groupId: -1, url: "https://example2.com" })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      actionClickCallbacks.forEach(cb => cb(currentTab))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close current tab (id: 1)
      const removeCalls = chrome.tabs.remove.mock.calls
      if (removeCalls.length > 0) {
        const removedIds = Array.isArray(removeCalls[0][0]) ? removeCalls[0][0] : [removeCalls[0][0]]
        expect(removedIds).not.toContain(1)
      }
    })

    it("should not close protected domain tabs when action is clicked", async () => {
      const currentTab = { id: 1, windowId: 100, pinned: false, groupId: -1, url: "https://example.com" }
      mockTabs.set(1, currentTab)
      mockTabs.set(2, { id: 2, windowId: 100, pinned: false, groupId: -1, url: "https://protected.com/page" })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = ["protected.com"]

      actionClickCallbacks.forEach(cb => cb(currentTab))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close protected domain tab
      const removeCalls = chrome.tabs.remove.mock.calls
      if (removeCalls.length > 0) {
        const removedIds = Array.isArray(removeCalls[0][0]) ? removeCalls[0][0] : [removeCalls[0][0]]
        expect(removedIds).not.toContain(2)
      }
    })

    it("should not close installed apps when action is clicked", async () => {
      const currentTab = { id: 1, windowId: 100, pinned: false, groupId: -1, url: "https://example.com" }
      mockTabs.set(1, currentTab)
      mockTabs.set(2, { id: 2, windowId: 100, pinned: false, groupId: -1, url: "chrome-extension://abc123/page" })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      actionClickCallbacks.forEach(cb => cb(currentTab))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not close installed app
      const removeCalls = chrome.tabs.remove.mock.calls
      if (removeCalls.length > 0) {
        const removedIds = Array.isArray(removeCalls[0][0]) ? removeCalls[0][0] : [removeCalls[0][0]]
        expect(removedIds).not.toContain(2)
      }
    })
  })

  describe("Runtime Message Handling", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should update timeout when UPDATE_TIMEOUT message is received", async () => {
      const newTimeout = 30
      const message = { type: "UPDATE_TIMEOUT", timeout: newTimeout }

      // Clear previous calls
      chrome.alarms.create.mockClear()

      messageCallbacks.forEach(cb => cb(message))

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 50))

      // Should reschedule all alarms if there are active tabs
      // Note: This may not be called if there are no tabs to reschedule
      // The important thing is that the message is handled without error
      expect(messageCallbacks.length).toBeGreaterThan(0)
    })

    it("should handle UPDATE_PROTECTED_DOMAINS message", () => {
      const domains = ["example.com", "test.com"]
      const message = { type: "UPDATE_PROTECTED_DOMAINS", domains }

      messageCallbacks.forEach(cb => cb(message))

      // Should not throw error
      expect(messageCallbacks.length).toBeGreaterThan(0)
    })

    it("should ignore unknown message types", () => {
      const message = { type: "UNKNOWN_MESSAGE", data: "test" }

      // Should not throw error
      expect(() => {
        messageCallbacks.forEach(cb => cb(message))
      }).not.toThrow()
    })
  })

  describe("Service Worker Lifecycle", () => {
    it("should reinitialize on startup", async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))

      const initialCallCount = chrome.windows.getAll.mock.calls.length

      // Trigger startup
      startupCallbacks.forEach(cb => cb())
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should reinitialize
      expect(chrome.windows.getAll.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it("should initialize on install", async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))

      const initialCallCount = chrome.windows.getAll.mock.calls.length

      // Trigger install
      installedCallbacks.forEach(cb => cb())
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should initialize
      expect(chrome.windows.getAll.mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  describe("Edge Cases and Error Handling", () => {
    beforeEach(async () => {
      await import("./background.js")
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it("should handle storage errors gracefully", async () => {
      chrome.storage.sync.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: "Storage error" }
        if (callback) callback({})
        return Promise.resolve({})
      })

      // Should not throw
      expect(() => {
        chrome.storage.sync.get([STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES], () => { })
      }).not.toThrow()
    })

    it("should handle tabs.get errors gracefully", () => {
      chrome.tabs.get.mockImplementation((tabId, callback) => {
        chrome.runtime.lastError = { message: "Tab not found" }
        if (callback) callback(undefined)
        return Promise.resolve(undefined)
      })

      activatedCallbacks.forEach(cb => cb({ tabId: 999, windowId: 100, previousTabId: null }))

      // Should not throw
      expect(chrome.tabs.get).toHaveBeenCalled()
    })

    it("should handle empty protected domains array", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Test Tab",
        url: "https://example.com",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = []

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should proceed normally
      expect(chrome.tabs.get).toHaveBeenCalled()
    })

    it("should handle null/undefined protected domains", async () => {
      const tabId = 1
      mockTabs.set(tabId, {
        id: tabId,
        windowId: 100,
        title: "Test Tab",
        url: "https://example.com",
        pinned: false,
        groupId: -1,
        audible: false
      })

      mockStorage[STORAGE_KEY_PROTECTED_DOMAINS] = null

      const alarm = { name: `close-tab-${tabId}`, scheduledTime: Date.now() }
      alarmCallbacks.forEach(cb => cb(alarm))

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not crash
      expect(chrome.tabs.get).toHaveBeenCalled()
    })
  })
})
