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

type ChartPoint = {
  x: number;
  y: number;
};

function formatReadingTime(measuredAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(measuredAt));
}

function getChronologicalReadings(readings: BloodPressureReading[]) {
  return [...readings].sort(
    (left, right) => new Date(left.measured_at).getTime() - new Date(right.measured_at).getTime(),
  );
}

function buildChartPoints(
  readings: BloodPressureReading[],
  accessor: (reading: BloodPressureReading) => number,
  width: number,
  height: number,
  padding: number,
  minValue: number,
  maxValue: number,
) {
  if (readings.length === 0) {
    return [];
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const range = Math.max(maxValue - minValue, 1);

  return readings.map((reading, index) => {
    const x = readings.length === 1 ? width / 2 : padding + (index / (readings.length - 1)) * innerWidth;
    const yValue = accessor(reading);
    const normalized = (yValue - minValue) / range;
    const y = padding + (1 - normalized) * innerHeight;

    return { x, y };
  });
}

function pointsToPath(points: ChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function formatChartTickValue(value: number) {
  return Math.round(value).toString();
}

function BloodPressureChart({ readings }: { readings: BloodPressureReading[] }) {
  const chronological = getChronologicalReadings(readings);

  if (chronological.length === 0) {
    return <p className="status">No chart data yet.</p>;
  }

  const width = 640;
  const height = 260;
  const padding = 28;
  const allValues = chronological.flatMap((reading) => [reading.systolic, reading.diastolic]);
  const minValue = Math.min(...allValues) - 10;
  const maxValue = Math.max(...allValues) + 10;
  const systolicPoints = buildChartPoints(
    chronological,
    (reading) => reading.systolic,
    width,
    height,
    padding,
    minValue,
    maxValue,
  );
  const diastolicPoints = buildChartPoints(
    chronological,
    (reading) => reading.diastolic,
    width,
    height,
    padding,
    minValue,
    maxValue,
  );
  const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];

  return (
    <div className="chart">
      <div className="chart-legend">
        <span>
          <i className="legend-systolic" />
          Systolic
        </span>
        <span>
          <i className="legend-diastolic" />
          Diastolic
        </span>
      </div>

      <svg
        aria-label="Blood pressure readings over time"
        className="chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        {yTicks.map((tickValue) => {
          const range = Math.max(maxValue - minValue, 1);
          const y = padding + (1 - (tickValue - minValue) / range) * (height - padding * 2);

          return (
            <g key={tickValue}>
              <line className="chart-grid" x1={padding} x2={width - padding} y1={y} y2={y} />
              <text className="chart-tick" x={8} y={y + 4}>
                {formatChartTickValue(tickValue)}
              </text>
            </g>
          );
        })}

        <path className="chart-line chart-line-systolic" d={pointsToPath(systolicPoints)} />
        <path className="chart-line chart-line-diastolic" d={pointsToPath(diastolicPoints)} />

        {systolicPoints.map((point, index) => (
          <circle key={`systolic-${chronological[index].id}`} className="chart-point chart-point-systolic" cx={point.x} cy={point.y} r="3.5" />
        ))}

        {diastolicPoints.map((point, index) => (
          <circle key={`diastolic-${chronological[index].id}`} className="chart-point chart-point-diastolic" cx={point.x} cy={point.y} r="3.5" />
        ))}
      </svg>

      <div className="chart-footnote">
        <span>{formatReadingTime(chronological[0].measured_at)}</span>
        <span>{formatReadingTime(chronological[chronological.length - 1].measured_at)}</span>
      </div>
    </div>
  );
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

      <section className="panel">
        <h2>Chart</h2>
        {isLoading ? <p className="status">Loading chart...</p> : <BloodPressureChart readings={readings} />}
      </section>
    </main>
  );
}
