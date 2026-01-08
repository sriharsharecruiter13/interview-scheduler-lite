"use client";

import { useMemo, useState } from "react";

function formatDateShort(dateStr: string) {
  // dateStr from <input type="date"> is "YYYY-MM-DD"
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dt); // "Jan 16"
}

function formatTime12(timeStr: string) {
  // timeStr from <input type="time"> is "HH:MM"
  if (!timeStr) return "";
  const [hhStr, mmStr] = timeStr.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  const mm2 = String(mm).padStart(2, "0");
  return `${hour12}:${mm2}${ampm}`; // "10:00AM"
}

export default function RespondPage() {
  // NOTE: This is focused on UX. You can wire windowId + preview/submit logic back in after.
  const [execName, setExecName] = useState("");
  const [manualText, setManualText] = useState("");

  // Quick add fields
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  const quickLinePreview = useMemo(() => {
    const d = formatDateShort(date);
    const s = formatTime12(startTime);
    const e = formatTime12(endTime);
    if (!d || !s || !e) return "";
    return `${d} ${s}-${e}`;
  }, [date, startTime, endTime]);

  const addBlock = () => {
    setMessage(null);

    if (!date || !startTime || !endTime) {
      setMessage("Please select date, start time, and end time.");
      return;
    }
    if (endTime <= startTime) {
      setMessage("End time must be after start time.");
      return;
    }

    const line = quickLinePreview;
    if (!line) return;

    setManualText((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n${line}` : line;
    });

    setStartTime("");
    setEndTime("");
    setMessage("Added block to manual entry.");
  };

  const clearAll = () => {
    setManualText("");
    setMessage(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-2xl font-semibold">EA Respond — Exec availability</div>

      <div className="text-gray-600">
        Enter exec availability the same way you enter candidate availability:
        add time blocks quickly, or type manually and submit.
      </div>

      <div className="rounded-2xl border bg-white p-6 space-y-6 shadow-sm">
        <div className="space-y-2">
          <div className="font-semibold">Exec name</div>
          <input
            className="w-full border rounded-lg p-3"
            placeholder="Exec full name"
            value={execName}
            onChange={(e) => setExecName(e.target.value)}
          />
        </div>

        {/* Quick Add (candidate-like blocks) */}
        <div className="rounded-xl border p-4 space-y-3 bg-gray-50">
          <div className="font-semibold">Add availability (quick blocks)</div>
          <div className="text-sm text-gray-600">
            Choose date + start + end, then click <b>Add block</b>. It appends a line below.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-sm text-gray-700">Date</div>
              <input
                type="date"
                className="w-full border rounded-lg p-3"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-gray-700">Start time</div>
              <input
                type="time"
                className="w-full border rounded-lg p-3"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-gray-700">End time</div>
              <input
                type="time"
                className="w-full border rounded-lg p-3"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg border" onClick={addBlock}>
              + Add block
            </button>

            {quickLinePreview && (
              <div className="text-sm text-gray-700">
                Will add: <span className="font-mono">{quickLinePreview}</span>
              </div>
            )}
          </div>

          {message && <div className="text-sm text-blue-700">{message}</div>}
        </div>

        {/* Manual Entry */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="font-semibold">Enter availability manually</div>
          <div className="text-sm text-gray-600">
            One per line. Examples:
            <div className="mt-1 font-mono text-xs">
              Jan 16 10AM-11:30AM{"\n"}
              Jan 16 2:30PM-4PM{"\n"}
              Jan 17 9AM-11AM
            </div>
          </div>

          <textarea
            className="w-full border rounded-lg p-3 min-h-[160px] font-mono text-sm"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder={"Jan 16 10AM-11:30AM\nJan 16 2:30PM-4PM\nJan 17 9AM-11AM"}
          />

          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>

        {/* Buttons placeholder — wire to your preview/submit endpoints */}
        <div className="space-y-2">
          <div className="font-semibold">Next</div>
          <div className="text-sm text-gray-600">
            Wire these buttons to your existing preview + save APIs.
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg border">Convert to preview</button>
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white">
              Save / Replace my availability
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

