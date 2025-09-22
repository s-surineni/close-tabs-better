import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import "./options.css"

const STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES = "inactivityTimeoutMinutes"
const STORAGE_KEY_PROTECTED_DOMAINS = "protectedDomains"

function Options() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [status, setStatus] = useState("Saved!")
  const [savedDuration, setSavedDuration] = useState(null)
  const [protectedDomains, setProtectedDomains] = useState("")
  const [savedDomains, setSavedDomains] = useState([])
  const storage = new Storage({ area: "sync" })

  useEffect(() => {
    storage.get(STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES).then((total) => {
      if (typeof total === "number" && total >= 0) {
        setHours(Math.floor(total / 60))
        setMinutes(total % 60)
        setSavedDuration({
          hours: Math.floor(total / 60),
          minutes: total % 60
        })
      } else {
        setSavedDuration(null)
      }
    })

    storage.get(STORAGE_KEY_PROTECTED_DOMAINS).then((domains) => {
      if (Array.isArray(domains)) {
        setSavedDomains(domains)
        setProtectedDomains(domains.join('\n'))
      }
    })
  }, [])

  const handleSave = () => {
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      setStatus("Invalid input")
      return
    }
    const totalMinutes = hours * 60 + minutes

    // Parse protected domains
    const domainsArray = protectedDomains
      .split('\n')
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0)

    // Validate domains (basic validation)
    const invalidDomains = domainsArray.filter(domain => {
      try {
        // Basic domain validation - should not contain protocol or path
        if (domain.includes('://') || domain.includes('/')) {
          return true
        }
        // Should have at least one dot for a valid domain
        if (!domain.includes('.')) {
          return true
        }
        return false
      } catch {
        return true
      }
    })

    if (invalidDomains.length > 0) {
      setStatus(`Invalid domains: ${invalidDomains.join(', ')}`)
      return
    }

    Promise.all([
      storage.set(STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES, totalMinutes),
      storage.set(STORAGE_KEY_PROTECTED_DOMAINS, domainsArray)
    ]).then(() => {
      setStatus("Saved!")
      setSavedDuration({
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
      })
      setSavedDomains(domainsArray)
      setTimeout(() => setStatus(""), 1500)
      chrome.runtime.sendMessage({
        type: "UPDATE_TIMEOUT",
        timeout: totalMinutes
      })
      chrome.runtime.sendMessage({
        type: "UPDATE_PROTECTED_DOMAINS",
        domains: domainsArray
      })
    })
  }

  return (
    <div className="options-root">
      <div className="options-card">
        <h2 className="options-title">Close Tabs Better Settings</h2>

        <div className="options-section">
          <h3 className="options-section-title">Inactivity Timeout</h3>
          {savedDuration ? (
            <div className="options-current">
              Current timeout: <b>{savedDuration.hours}</b> hour{savedDuration.hours !== 1 ? "s" : ""}{" "}
              <b>{savedDuration.minutes}</b> minute{savedDuration.minutes !== 1 ? "s" : ""}
            </div>
          ) : (
            <div className="options-current">
              Current timeout: <b>Not set</b>
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="options-form">
          <div className="options-field">
            <label htmlFor="hours-input" className="options-label">
              Hours
            </label>
            <input
              id="hours-input"
              type="number"
              placeholder="0-24"
              min={0}
              step={1}
              max={24}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="options-input"
            />
          </div>
          <div className="options-field">
            <label htmlFor="minutes-input" className="options-label">
              Minutes
            </label>
            <input
              id="minutes-input"
              type="number"
              placeholder="0-59"
              min={0}
              step={1}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="options-input"
            />
          </div>
        </form>

        <div className="options-section">
          <h3 className="options-section-title">Protected Domains</h3>
          {savedDomains.length > 0 ? (
            <div className="options-current">
              Protected domains: <b>{savedDomains.length}</b> domain{savedDomains.length !== 1 ? "s" : ""}
            </div>
          ) : (
            <div className="options-current">
              Protected domains: <b>None</b>
            </div>
          )}
          <div className="options-field">
            <label htmlFor="domains-input" className="options-label">
              Domains (one per line)
            </label>
            <textarea
              id="domains-input"
              placeholder="example.com&#10;github.com&#10;stackoverflow.com"
              value={protectedDomains}
              onChange={(e) => setProtectedDomains(e.target.value)}
              className="options-textarea"
              rows={4}
            />
            <div className="options-help">
              Enter domain names (without http:// or https://). Subdomains will also be protected.
            </div>
          </div>
        </div>

        <button
          type="submit"
          onClick={handleSave}
          className="options-save-btn"
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#1565c0"
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "#1565c0"
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#1976d2"
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "#1976d2"
          }}
        >
          Save All Settings
        </button>
        {status && (
          <div
            className={`options-toast${status === "Saved!" ? "" : " error"}`}
          >
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default Options
