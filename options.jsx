import React, { useState } from "react"

function Options() {
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [status, setStatus] = useState("")

  const handleSave = () => {
    // Basic validation
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
      setStatus("Invalid input")
      return
    }
    const totalMinutes = hours * 60 + minutes
    chrome.storage.sync.set({ inactivityTimeoutMinutes: totalMinutes }, () => {
      setStatus("Saved!")
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
