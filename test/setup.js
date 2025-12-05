import sinon from "sinon-chrome"
import { beforeEach, vi } from "vitest"

// Mock Chrome APIs before importing the module under test
global.chrome = sinon

// Store listeners so we can trigger them in tests
global.chromeListeners = {
  onActivated: [],
  onUpdated: [],
  onRemoved: [],
  onAlarm: [],
  onMessage: [],
  onStartup: [],
  onInstalled: [],
  onWindowRemoved: [],
  actionOnClicked: []
}

// Helper function to create a mock that yields a value
function createYieldingMock(value) {
  return vi.fn((queryInfo, callback) => {
    if (callback) {
      callback(value)
    }
    return Promise.resolve(value)
  })
}

// Reset Chrome mocks before each test
beforeEach(() => {
  sinon.reset()
  
  // Clear all listeners
  Object.keys(global.chromeListeners).forEach((key) => {
    global.chromeListeners[key] = []
  })
  
  // Set up default mock implementations
  chrome.runtime.lastError = null

  // chrome.storage.sync is read-only, so we need to modify its properties
  if (chrome.storage && chrome.storage.sync) {
    Object.defineProperty(chrome.storage.sync, 'get', {
      value: createYieldingMock({}),
      writable: true,
      configurable: true
    })
    Object.defineProperty(chrome.storage.sync, 'set', {
      value: createYieldingMock(),
      writable: true,
      configurable: true
    })
  } else {
    // Fallback if storage doesn't exist
    chrome.storage = {
      sync: {
        get: createYieldingMock({}),
        set: createYieldingMock()
      }
    }
  }
  
  chrome.tabs = {
    get: vi.fn(),
    query: vi.fn(),
    remove: vi.fn(),
    onActivated: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onActivated.push(callback)
      })
    },
    onUpdated: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onUpdated.push(callback)
      })
    },
    onRemoved: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onRemoved.push(callback)
      })
    }
  }
  
  chrome.alarms = {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onAlarm.push(callback)
      })
    }
  }
  
  chrome.windows = {
    getAll: vi.fn(),
    onRemoved: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onWindowRemoved.push(callback)
      })
    }
  }
  
  chrome.runtime = {
    lastError: null,
    onMessage: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onMessage.push(callback)
      })
    },
    onStartup: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onStartup.push(callback)
      })
    },
    onInstalled: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.onInstalled.push(callback)
      })
    }
  }
  
  chrome.action = {
    onClicked: {
      addListener: vi.fn((callback) => {
        global.chromeListeners.actionOnClicked.push(callback)
      })
    }
  }
})

