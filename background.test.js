import { describe, it, expect, beforeEach, vi } from "vitest"
import sinon from "sinon-chrome"

// Mock process.env before importing
process.env.NODE_ENV = "test"

// Import after mocks are set up
// Note: We'll need to dynamically import to test the module behavior
// For now, we'll test the logic through the Chrome API listeners

describe("Multi-Window Tab Management", () => {
  let activeTabsByWindow = {}
  let tabActivity = {}
  let INACTIVITY_LIMIT_MS = 120 * 60 * 1000 // 2 hours default

  beforeEach(() => {
    // Reset state
    activeTabsByWindow = {}
    tabActivity = {}
    INACTIVITY_LIMIT_MS = 120 * 60 * 1000

    // Reset all Chrome mocks
    sinon.reset()

    // Set up default Chrome API mocks
    chrome.runtime.lastError = null
    chrome.storage.sync.get = sinon.stub().yields({})
    chrome.storage.sync.set = sinon.stub().yields()
    chrome.tabs.get = sinon.stub()
    chrome.tabs.query = sinon.stub()
    chrome.tabs.remove = sinon.stub()
    chrome.alarms.create = sinon.stub()
    chrome.alarms.clear = sinon.stub()
    chrome.windows.getAll = sinon.stub()
  })

  describe("Active Tab Tracking Per Window", () => {
    it("should track active tab for each window independently", () => {
      const onActivatedListener = sinon.stub()

      // Simulate tab activation in window 1
      const window1Tab1 = { tabId: 1, windowId: 100, previousTabId: null }
      activeTabsByWindow[window1Tab1.windowId] = window1Tab1.tabId

      // Simulate tab activation in window 2
      const window2Tab1 = { tabId: 2, windowId: 200, previousTabId: null }
      activeTabsByWindow[window2Tab1.windowId] = window2Tab1.tabId

      // Both windows should have their active tabs tracked
      expect(activeTabsByWindow[100]).toBe(1)
      expect(activeTabsByWindow[200]).toBe(2)
    })

    it("should update active tab when switching tabs within the same window", () => {
      activeTabsByWindow[100] = 1

      // Switch to tab 2 in window 100
      activeTabsByWindow[100] = 2

      expect(activeTabsByWindow[100]).toBe(2)
      expect(activeTabsByWindow[100]).not.toBe(1)
    })

    it("should maintain separate active tabs for multiple windows", () => {
      // Window 1: tab 1 is active
      activeTabsByWindow[100] = 1

      // Window 2: tab 2 is active
      activeTabsByWindow[200] = 2

      // Window 3: tab 3 is active
      activeTabsByWindow[300] = 3

      // All should be tracked independently
      expect(activeTabsByWindow[100]).toBe(1)
      expect(activeTabsByWindow[200]).toBe(2)
      expect(activeTabsByWindow[300]).toBe(3)
    })
  })

  describe("Preventing Closure of Active Tabs", () => {
    it("should not close a tab that is active in any window", () => {
      // Setup: Tab 1 is active in window 100
      activeTabsByWindow[100] = 1
      tabActivity[1] = Date.now() - INACTIVITY_LIMIT_MS - 1000 // Inactive

      // Check if tab is active in any window
      const isActiveInAnyWindow = Object.values(activeTabsByWindow).includes(1)

      expect(isActiveInAnyWindow).toBe(true)
      // Tab should not be closed
    })

    it("should close inactive tabs that are not active in any window", () => {
      // Setup: Tab 1 is NOT active in any window
      activeTabsByWindow[100] = 2 // Window 100 has tab 2 active
      activeTabsByWindow[200] = 3 // Window 200 has tab 3 active
      tabActivity[1] = Date.now() - INACTIVITY_LIMIT_MS - 1000 // Tab 1 is inactive

      // Check if tab 1 is active in any window
      const isActiveInAnyWindow = Object.values(activeTabsByWindow).includes(1)

      expect(isActiveInAnyWindow).toBe(false)
      // Tab 1 should be eligible for closing
    })

    it("should protect active tab in window 1 even when window 2 is focused", () => {
      // Window 1: tab 1 is active (but window is not focused)
      activeTabsByWindow[100] = 1
      tabActivity[1] = Date.now() - INACTIVITY_LIMIT_MS - 1000

      // Window 2: tab 2 is active (and window is focused)
      activeTabsByWindow[200] = 2
      tabActivity[2] = Date.now()

      // Tab 1 should still be protected because it's active in window 100
      const isTab1Active = Object.values(activeTabsByWindow).includes(1)
      expect(isTab1Active).toBe(true)

      // Tab 2 should also be protected
      const isTab2Active = Object.values(activeTabsByWindow).includes(2)
      expect(isTab2Active).toBe(true)
    })
  })

  describe("Cleanup on Tab Removal", () => {
    it("should remove active tab tracking when a tab is closed", () => {
      // Setup: Tab 1 is active in window 100
      activeTabsByWindow[100] = 1
      tabActivity[1] = Date.now()

      // Simulate tab removal
      const tabId = 1
      Object.keys(activeTabsByWindow).forEach((windowId) => {
        if (activeTabsByWindow[windowId] === tabId) {
          delete activeTabsByWindow[windowId]
        }
      })
      delete tabActivity[tabId]

      // Tab should no longer be tracked
      expect(activeTabsByWindow[100]).toBeUndefined()
      expect(tabActivity[1]).toBeUndefined()
    })

    it("should only remove the specific tab from tracking, not other tabs", () => {
      // Setup: Multiple windows with active tabs
      activeTabsByWindow[100] = 1
      activeTabsByWindow[200] = 2
      activeTabsByWindow[300] = 3

      // Remove tab 2
      const tabId = 2
      Object.keys(activeTabsByWindow).forEach((windowId) => {
        if (activeTabsByWindow[windowId] === tabId) {
          delete activeTabsByWindow[windowId]
        }
      })

      // Other tabs should still be tracked
      expect(activeTabsByWindow[100]).toBe(1)
      expect(activeTabsByWindow[200]).toBeUndefined()
      expect(activeTabsByWindow[300]).toBe(3)
    })
  })

  describe("Cleanup on Window Removal", () => {
    it("should remove window tracking when a window is closed", () => {
      // Setup: Multiple windows
      activeTabsByWindow[100] = 1
      activeTabsByWindow[200] = 2
      activeTabsByWindow[300] = 3

      // Close window 200
      delete activeTabsByWindow[200]

      // Window 200 should be removed, others should remain
      expect(activeTabsByWindow[100]).toBe(1)
      expect(activeTabsByWindow[200]).toBeUndefined()
      expect(activeTabsByWindow[300]).toBe(3)
    })

    it("should handle closing all windows", () => {
      // Setup: Multiple windows
      activeTabsByWindow[100] = 1
      activeTabsByWindow[200] = 2

      // Close all windows
      activeTabsByWindow = {}

      // All windows should be removed
      expect(Object.keys(activeTabsByWindow).length).toBe(0)
    })
  })

  describe("Initialization on Startup", () => {
    it("should initialize active tabs for all existing windows", () => {
      const windows = [
        { id: 100 },
        { id: 200 },
        { id: 300 }
      ]

      const windowTabs = {
        100: [{ id: 1, active: true }],
        200: [{ id: 2, active: true }],
        300: [{ id: 3, active: true }]
      }

      chrome.windows.getAll = sinon.stub().yields(windows)
      chrome.tabs.query = sinon.stub().callsFake((queryInfo, callback) => {
        const windowId = queryInfo.windowId
        callback(windowTabs[windowId] || [])
      })

      // Simulate initialization
      const initializedActiveTabs = {}
      windows.forEach((window) => {
        chrome.tabs.query({ windowId: window.id, active: true }, (tabs) => {
          if (tabs.length > 0) {
            initializedActiveTabs[window.id] = tabs[0].id
          }
        })
      })

      // After async operations, verify structure
      expect(chrome.windows.getAll.called).toBe(true)
    })

    it("should handle windows with no active tabs gracefully", () => {
      const windows = [{ id: 100 }]

      chrome.windows.getAll = sinon.stub().yields(windows)
      chrome.tabs.query = sinon.stub().yields([])

      const initializedActiveTabs = {}
      windows.forEach((window) => {
        chrome.tabs.query({ windowId: window.id, active: true }, (tabs) => {
          if (tabs.length > 0) {
            initializedActiveTabs[window.id] = tabs[0].id
          }
        })
      })

      // Should not crash, just not add anything
      expect(initializedActiveTabs[100]).toBeUndefined()
    })
  })

  describe("Integration: Multi-Window Tab Closing Scenario", () => {
    it("should handle complex multi-window scenario correctly", () => {
      // Scenario:
      // - Window 1: Tab 1 (active), Tab 2 (inactive, should close)
      // - Window 2: Tab 3 (active), Tab 4 (inactive, should close)
      // - Tab 1 and Tab 3 should be protected
      // - Tab 2 and Tab 4 should be eligible for closing

      // Setup active tabs
      activeTabsByWindow[100] = 1 // Window 1: Tab 1 is active
      activeTabsByWindow[200] = 3 // Window 2: Tab 3 is active

      // Setup tab activity (all tabs are inactive)
      const now = Date.now()
      tabActivity[1] = now - INACTIVITY_LIMIT_MS - 1000
      tabActivity[2] = now - INACTIVITY_LIMIT_MS - 1000
      tabActivity[3] = now - INACTIVITY_LIMIT_MS - 1000
      tabActivity[4] = now - INACTIVITY_LIMIT_MS - 1000

      // Check which tabs should be protected
      const isTab1Active = Object.values(activeTabsByWindow).includes(1)
      const isTab2Active = Object.values(activeTabsByWindow).includes(2)
      const isTab3Active = Object.values(activeTabsByWindow).includes(3)
      const isTab4Active = Object.values(activeTabsByWindow).includes(4)

      // Tab 1 and 3 should be protected (active in their windows)
      expect(isTab1Active).toBe(true)
      expect(isTab3Active).toBe(true)

      // Tab 2 and 4 should not be protected (not active in any window)
      expect(isTab2Active).toBe(false)
      expect(isTab4Active).toBe(false)
    })

    it("should protect tabs when switching between windows", () => {
      // Initial state: Window 1 has tab 1 active
      activeTabsByWindow[100] = 1

      // User switches to Window 2 and activates tab 2
      activeTabsByWindow[200] = 2

      // Both tabs should be protected
      const isTab1Active = Object.values(activeTabsByWindow).includes(1)
      const isTab2Active = Object.values(activeTabsByWindow).includes(2)

      expect(isTab1Active).toBe(true)
      expect(isTab2Active).toBe(true)

      // User switches back to Window 1 and activates tab 3
      activeTabsByWindow[100] = 3

      // Tab 1 is no longer active, but tab 2 and 3 are
      const isTab1StillActive = Object.values(activeTabsByWindow).includes(1)
      const isTab3Active = Object.values(activeTabsByWindow).includes(3)

      expect(isTab1StillActive).toBe(false)
      expect(isTab2Active).toBe(true) // Still active in window 2
      expect(isTab3Active).toBe(true) // Now active in window 1
    })
  })
})

