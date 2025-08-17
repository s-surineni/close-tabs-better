import React, { useEffect, useState } from "react"

import { Storage } from "@plasmohq/storage"

import "./options.css"

function Options() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [status, setStatus] = useState("Saved!")
  const [savedDuration, setSavedDuration] = useState(null)
  const storage = new Storage({ area: "sync" })

  useEffect(() => {
    storage.get("inactivityTimeoutMinutes").then((total) => {
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
  }, [])

  const handleSave = () => {
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      setStatus("Invalid input")
      return
    }
    const totalMinutes = hours * 60 + minutes
    storage.set("inactivityTimeoutMinutes", totalMinutes).then(() => {
      setStatus("Saved!")
      setSavedDuration({
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
      })
      setTimeout(() => setStatus(""), 1500)
      chrome.runtime.sendMessage({
        type: "UPDATE_TIMEOUT",
        timeout: totalMinutes
      })
    })
  }

  return (
    <div className="options-root">
      <div className="options-card">
        <h2 className="options-title">Inactivity Timeout</h2>
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
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
          className="options-form"
        >
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
            }}
          >
            Save
          </button>
        </form>
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
