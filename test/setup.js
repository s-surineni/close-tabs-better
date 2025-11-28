import sinon from "sinon-chrome"
import { beforeEach } from "vitest"

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

// Reset Chrome mocks before each test
beforeEach(() => {
  sinon.reset()
  
  // Clear all listeners
  Object.keys(global.chromeListeners).forEach((key) => {
    global.chromeListeners[key] = []
  })
  
  // Set up default mock implementations
  chrome.runtime.lastError = null
  chrome.storage.sync = {
    get: sinon.stub().yields({}),
    set: sinon.stub().yields()
  }
  
  chrome.tabs = {
    get: sinon.stub(),
    query: sinon.stub(),
    remove: sinon.stub(),
    onActivated: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onActivated.push(callback)
      })
    },
    onUpdated: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onUpdated.push(callback)
      })
    },
    onRemoved: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onRemoved.push(callback)
      })
    }
  }
  
  chrome.alarms = {
    create: sinon.stub(),
    clear: sinon.stub(),
    onAlarm: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onAlarm.push(callback)
      })
    }
  }
  
  chrome.windows = {
    getAll: sinon.stub(),
    onRemoved: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onWindowRemoved.push(callback)
      })
    }
  }
  
  chrome.runtime = {
    lastError: null,
    onMessage: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onMessage.push(callback)
      })
    },
    onStartup: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onStartup.push(callback)
      })
    },
    onInstalled: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.onInstalled.push(callback)
      })
    }
  }
  
  chrome.action = {
    onClicked: {
      addListener: sinon.stub().callsFake((callback) => {
        global.chromeListeners.actionOnClicked.push(callback)
      })
    }
  }
})

