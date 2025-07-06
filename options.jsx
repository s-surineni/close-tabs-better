import React, { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"

function Options() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [status, setStatus] = useState("")
  const [savedDuration, setSavedDuration] = useState(null)
  const storage = new Storage({ area: "sync" })

  useEffect(() => {
    storage.get("inactivityTimeoutMinutes").then((total) => {
      console.log("ironman total", total)
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
    // Basic validation
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontFamily: "sans-serif"
      }}>
      {savedDuration ? (
        <div style={{ fontSize: 18, marginBottom: 16, color: "#555" }}>
          Current timeout: {savedDuration.hours} hour
          {savedDuration.hours !== 1 ? "s" : ""} {savedDuration.minutes} minute
          {savedDuration.minutes !== 1 ? "s" : ""}
        </div>
      ) : (
        <div style={{ fontSize: 18, marginBottom: 16, color: "#555" }}>
          Current timeout: Not set
        </div>
      )}
      <label
        htmlFor="hours-input"
        style={{
          fontSize: 18,
          marginBottom: 4,
          alignSelf: "flex-start",
          marginLeft: 8
        }}
      >
        Hours
      </label>
      <input
        id="hours-input"
        type="number"
        placeholder="Enter hours (0-24)"
        min={0}
        step={1}
        max={24}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        style={{ fontSize: 24, padding: 8, width: 200, marginBottom: 16 }}
      />
      <label
        htmlFor="minutes-input"
        style={{
          fontSize: 18,
          marginBottom: 4,
          alignSelf: "flex-start",
          marginLeft: 8
        }}
      >
        Minutes
      </label>
      <input
        id="minutes-input"
        type="number"
        placeholder="Enter minutes (0-59)"
        min={0}
        step={1}
        max={59}
        value={minutes}
        onChange={(e) => setMinutes(Number(e.target.value))}
        style={{ fontSize: 24, padding: 8, width: 200, marginBottom: 16 }}
      />
      <button
        type="button"
        onClick={handleSave}
        style={{
          fontSize: 20,
          padding: "8px 32px",
          borderRadius: 4,
          border: "none",
          background: "#1976d2",
          color: "#fff",
          cursor: "pointer"
        }}>
        Save
      </button>
      {status && (
        <div
          style={{
            color: status === "Saved!" ? "green" : "red",
            marginTop: 18,
            fontWeight: 500,
            fontSize: 18
          }}>
          {status}
        </div>
      )}
    </div>
  )
}

export default Options
