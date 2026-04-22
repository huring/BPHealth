"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const localTime = new Date(date.getTime() - offsetMs);
  return localTime.toISOString().slice(0, 16);
}

export default function HomePage() {
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit = systolic.trim() !== "" && diastolic.trim() !== "" && measuredAt.trim() !== "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.from("blood_pressure_readings").insert({
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        measured_at: new Date(measuredAt).toISOString(),
      });

      if (error) {
        throw error;
      }

      setStatus("Reading saved.");
      setSystolic("");
      setDiastolic("");
      setMeasuredAt(toDateTimeLocalValue(new Date()));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save reading.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">BPHealth</p>
        <h1>Log a blood pressure reading.</h1>
        <p className="lede">
          This first form writes directly to Supabase so we can validate the data flow
          before adding history or charts.
        </p>
      </section>

      <section className="panel">
        <h2>New reading</h2>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Systolic</span>
            <input
              inputMode="numeric"
              name="systolic"
              type="number"
              min="1"
              step="1"
              value={systolic}
              onChange={(event) => setSystolic(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Diastolic</span>
            <input
              inputMode="numeric"
              name="diastolic"
              type="number"
              min="1"
              step="1"
              value={diastolic}
              onChange={(event) => setDiastolic(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Measured at</span>
            <input
              name="measured_at"
              type="datetime-local"
              value={measuredAt}
              onChange={(event) => setMeasuredAt(event.target.value)}
            />
          </label>

          <button type="submit" disabled={!canSubmit || isSaving}>
            {isSaving ? "Saving..." : "Save reading"}
          </button>

          {status ? <p className="status">{status}</p> : null}
        </form>
      </section>
    </main>
  );
}
