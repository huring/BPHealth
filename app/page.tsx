"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const localTime = new Date(date.getTime() - offsetMs);
  return localTime.toISOString().slice(0, 16);
}

type BloodPressureReading = {
  id: string;
  systolic: number;
  diastolic: number;
  measured_at: string;
};

function formatReadingTime(measuredAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(measuredAt));
}

export default function HomePage() {
  const supabaseConfigured = hasSupabaseConfig();
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [measuredAt, setMeasuredAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canSubmit = systolic.trim() !== "" && diastolic.trim() !== "" && measuredAt.trim() !== "";

  useEffect(() => {
    let isActive = true;

    async function loadReadings() {
      if (!supabaseConfigured) {
        if (isActive) {
          setStatus("Supabase is not configured yet. Add the env vars to enable saving and history.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("Supabase is not configured yet.");
        }
        const { data, error } = await supabase
          .from("blood_pressure_readings")
          .select("id, systolic, diastolic, measured_at")
          .order("measured_at", { ascending: false });

        if (error) {
          throw error;
        }

        if (isActive) {
          setReadings((data ?? []) as BloodPressureReading[]);
        }
      } catch (error) {
        if (isActive) {
          setStatus(error instanceof Error ? error.message : "Unable to load history.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadReadings();

    return () => {
      isActive = false;
    };
  }, [supabaseConfigured]);

  async function reloadReadings() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase is not configured yet.");
    }
    const { data, error } = await supabase
      .from("blood_pressure_readings")
      .select("id, systolic, diastolic, measured_at")
      .order("measured_at", { ascending: false });

    if (error) {
      throw error;
    }

    setReadings((data ?? []) as BloodPressureReading[]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabaseConfigured) {
      setStatus("Supabase is not configured yet. Add the env vars to save readings.");
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }
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
      await reloadReadings();
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
        {!supabaseConfigured ? (
          <p className="status">
            Supabase environment variables are missing. Add `NEXT_PUBLIC_SUPABASE_URL`
            and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable saving and history.
          </p>
        ) : null}
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

          <button type="submit" disabled={!canSubmit || isSaving || !supabaseConfigured}>
            {isSaving ? "Saving..." : "Save reading"}
          </button>

          {status ? <p className="status">{status}</p> : null}
        </form>
      </section>

      <section className="panel">
        <h2>History</h2>
        {isLoading ? (
          <p className="status">Loading readings...</p>
        ) : readings.length === 0 ? (
          <p className="status">No readings yet.</p>
        ) : (
          <ul className="history-list">
            {readings.map((reading) => (
              <li key={reading.id} className="history-item">
                <div>
                  <strong>
                    {reading.systolic}/{reading.diastolic}
                  </strong>
                  <p>{formatReadingTime(reading.measured_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
