import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import "./options.css"

import {
  DEFAULT_TIMEOUT_MINUTES,
  STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES,
  STORAGE_KEY_PROTECTED_DOMAINS
} from "./constants"

function Options() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [status, setStatus] = useState("")
  const [savedDuration, setSavedDuration] = useState(null)
  const [isUsingDefault, setIsUsingDefault] = useState(false)
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
        setIsUsingDefault(false)
      } else {
        // Show default timeout when not set
        const defaultHours = Math.floor(DEFAULT_TIMEOUT_MINUTES / 60)
        const defaultMinutes = DEFAULT_TIMEOUT_MINUTES % 60
        setHours(defaultHours)
        setMinutes(defaultMinutes)
        setSavedDuration({
          hours: defaultHours,
          minutes: defaultMinutes
        })
        setIsUsingDefault(true)
      }
    })

    storage.get(STORAGE_KEY_PROTECTED_DOMAINS).then((domains) => {
      if (Array.isArray(domains)) {
        setSavedDomains(domains)
        setProtectedDomains(domains.join("\n"))
      }
    })
  }, [])

  const handleSaveTimeout = () => {
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      setStatus("Invalid timeout input")
      return
    }
    const totalMinutes = hours * 60 + minutes

    storage
      .set(STORAGE_KEY_INACTIVITY_TIMEOUT_MINUTES, totalMinutes)
      .then(() => {
        setStatus("Timeout saved!")
        setSavedDuration({
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60
        })
        setIsUsingDefault(false)
        setTimeout(() => setStatus(""), 1500)
        chrome.runtime.sendMessage({
          type: "UPDATE_TIMEOUT",
          timeout: totalMinutes
        })
      })
  }

  const handleSaveDomains = () => {
    // Parse protected domains
    const domainsArray = protectedDomains
      .split("\n")
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0)

    // Validate domains (basic validation)
    const invalidDomains = domainsArray.filter((domain) => {
      try {
        // Basic domain validation - should not contain protocol or path
        if (domain.includes("://") || domain.includes("/")) {
          return true
        }
        // Should have at least one dot for a valid domain
        if (!domain.includes('.')) {
          return true
        }
        return false
      } catch (error) {
        return true
      }
    })

    if (invalidDomains.length > 0) {
      setStatus(`Invalid domains: ${invalidDomains.join(", ")}`)
      return
    }

    storage.set(STORAGE_KEY_PROTECTED_DOMAINS, domainsArray).then(() => {
      setStatus("Domains saved!")
      setSavedDomains(domainsArray)
      setTimeout(() => setStatus(""), 1500)
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
          {savedDuration && (
            <div className="options-current">
              Current timeout: <b>{savedDuration.hours}</b> hour
              {savedDuration.hours !== 1 ? "s" : ""}{" "}
              <b>{savedDuration.minutes}</b> minute
              {savedDuration.minutes !== 1 ? "s" : ""}
              {isUsingDefault && <span> (default)</span>}
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSaveTimeout()
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
          <button
            type="submit"
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
            }}>
            Save Timeout
          </button>
        </form>

        <div className="options-section">
          <h3 className="options-section-title">Protected Domains</h3>
          {savedDomains.length > 0 ? (
            <div className="options-current">
              Protected domains: <b>{savedDomains.length}</b> domain
              {savedDomains.length !== 1 ? "s" : ""}
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
              Enter domain names (without http:// or https://). Subdomains will
              also be protected.
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveDomains}
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
            }}>
            Save Domains
          </button>
        </div>
        {status && (
          <div
            className={`options-toast${status.includes("saved!") || status === "Saved!" ? "" : " error"}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default Options
