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

type DailyFeeling = "good_productive" | "neutral" | "bad";

type DailyFactorRow = {
  day: string;
  slept_or_napped: boolean;
  had_alcohol: boolean;
  feeling: DailyFeeling;
};

type ChartPoint = {
  x: number;
  y: number;
};

function toDateInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const localTime = new Date(date.getTime() - offsetMs);
  return localTime.toISOString().slice(0, 10);
}

function formatReadingTime(measuredAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(measuredAt));
}

function formatReadingLabel(reading: BloodPressureReading) {
  return `${reading.systolic}/${reading.diastolic}`;
}

function formatDateLabel(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${day}T00:00:00`));
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

function DailyFactorsPanel({ supabaseConfigured }: { supabaseConfigured: boolean }) {
  const [day, setDay] = useState(() => toDateInputValue(new Date()));
  const [sleptOrNapped, setSleptOrNapped] = useState(false);
  const [hadAlcohol, setHadAlcohol] = useState(false);
  const [feeling, setFeeling] = useState<DailyFeeling>("neutral");
  const [dailyStatus, setDailyStatus] = useState<string | null>(null);
  const [isLoadingDailyFactors, setIsLoadingDailyFactors] = useState(false);
  const [isSavingDailyFactors, setIsSavingDailyFactors] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadDailyFactors() {
      if (!supabaseConfigured) {
        return;
      }

      setIsLoadingDailyFactors(true);
      setDailyStatus(null);

      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("Supabase is not configured yet.");
        }

        const { data, error } = await supabase
          .from("daily_factors")
          .select("day, slept_or_napped, had_alcohol, feeling")
          .eq("day", day)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }

        if (data) {
          const row = data as DailyFactorRow;
          setSleptOrNapped(row.slept_or_napped);
          setHadAlcohol(row.had_alcohol);
          setFeeling(row.feeling);
          setDailyStatus(`Loaded saved factors for ${formatDateLabel(day)}.`);
        } else {
          setSleptOrNapped(false);
          setHadAlcohol(false);
          setFeeling("neutral");
          setDailyStatus(`No saved factors for ${formatDateLabel(day)} yet.`);
        }
      } catch (error) {
        if (isActive) {
          setDailyStatus(error instanceof Error ? error.message : "Unable to load daily factors.");
        }
      } finally {
        if (isActive) {
          setIsLoadingDailyFactors(false);
        }
      }
    }

    void loadDailyFactors();

    return () => {
      isActive = false;
    };
  }, [day, supabaseConfigured]);

  async function handleDailySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabaseConfigured) {
      setDailyStatus("Supabase is not configured yet. Add the env vars to save daily factors.");
      return;
    }

    setIsSavingDailyFactors(true);
    setDailyStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      const { error } = await supabase.from("daily_factors").upsert(
        {
          day,
          slept_or_napped: sleptOrNapped,
          had_alcohol: hadAlcohol,
          feeling,
        },
        { onConflict: "day" },
      );

      if (error) {
        throw error;
      }

      setDailyStatus(`Saved daily factors for ${formatDateLabel(day)}.`);
    } catch (error) {
      setDailyStatus(error instanceof Error ? error.message : "Unable to save daily factors.");
    } finally {
      setIsSavingDailyFactors(false);
    }
  }

  return (
    <section className="panel">
      <h2>Daily factors</h2>
      <p className="panel-lede">
        Keep daily input fast. One row per day is enough for this pass.
      </p>
      {!supabaseConfigured ? (
        <p className="status">
          Supabase environment variables are missing. Add `NEXT_PUBLIC_SUPABASE_URL` and
          `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable saving daily factors.
        </p>
      ) : null}
      <form className="form daily-form" onSubmit={handleDailySubmit}>
        <label className="field daily-date">
          <span>Day</span>
          <input
            name="day"
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>

        <label className="daily-toggle">
          <input
            checked={sleptOrNapped}
            name="slept_or_napped"
            type="checkbox"
            onChange={(event) => setSleptOrNapped(event.target.checked)}
          />
          <span>Slept or napped</span>
        </label>

        <label className="daily-toggle">
          <input
            checked={hadAlcohol}
            name="had_alcohol"
            type="checkbox"
            onChange={(event) => setHadAlcohol(event.target.checked)}
          />
          <span>Alcohol that day</span>
        </label>

        <label className="field daily-feeling">
          <span>Feeling</span>
          <select
            name="feeling"
            value={feeling}
            onChange={(event) => setFeeling(event.target.value as DailyFeeling)}
          >
            <option value="good_productive">Good / productive</option>
            <option value="neutral">Neutral</option>
            <option value="bad">Bad</option>
          </select>
        </label>

        <button type="submit" disabled={isSavingDailyFactors || !supabaseConfigured}>
          {isSavingDailyFactors ? "Saving..." : isLoadingDailyFactors ? "Loading..." : "Save day"}
        </button>

        {dailyStatus ? <p className="status">{dailyStatus}</p> : null}
      </form>
    </section>
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

  async function handleDelete(reading: BloodPressureReading) {
    if (!supabaseConfigured) {
      setStatus("Supabase is not configured yet. Add the env vars to delete readings.");
      return;
    }

    const confirmed = window.confirm(`Delete ${formatReadingLabel(reading)} from ${formatReadingTime(reading.measured_at)}?`);
    if (!confirmed) {
      return;
    }

    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      const { error } = await supabase.from("blood_pressure_readings").delete().eq("id", reading.id);

      if (error) {
        throw error;
      }

      await reloadReadings();
      setStatus("Reading deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete reading.");
    }
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
        <h2>Chart</h2>
        {isLoading ? <p className="status">Loading chart...</p> : <BloodPressureChart readings={readings} />}
      </section>

      <section className="panel">
        <h2>New reading</h2>
        {!supabaseConfigured ? (
          <p className="status">
            Supabase environment variables are missing. Add `NEXT_PUBLIC_SUPABASE_URL`
            and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable saving and history.
          </p>
        ) : null}
        <form className="form form-inline" onSubmit={handleSubmit}>
          <label className="field field-compact">
            <span>SYS</span>
            <input
              aria-label="Systolic"
              inputMode="numeric"
              name="systolic"
              type="number"
              min="1"
              step="1"
              value={systolic}
              onChange={(event) => setSystolic(event.target.value)}
            />
          </label>

          <span className="form-separator" aria-hidden="true">
            /
          </span>

          <label className="field field-compact">
            <span>DIA</span>
            <input
              aria-label="Diastolic"
              inputMode="numeric"
              name="diastolic"
              type="number"
              min="1"
              step="1"
              value={diastolic}
              onChange={(event) => setDiastolic(event.target.value)}
            />
          </label>

          <label className="field field-wide">
            <span>Measured at</span>
            <input
              name="measured_at"
              type="datetime-local"
              value={measuredAt}
              onChange={(event) => setMeasuredAt(event.target.value)}
            />
          </label>

          <button type="submit" disabled={!canSubmit || isSaving || !supabaseConfigured}>
            {isSaving ? "Saving..." : "Save"}
          </button>

          {status ? <p className="status">{status}</p> : null}
        </form>
      </section>

      <details className="panel history-panel">
        <summary>
          <span>History</span>
          <span className="history-count">{readings.length}</span>
        </summary>
        {isLoading ? (
          <p className="status history-copy">Loading readings...</p>
        ) : readings.length === 0 ? (
          <p className="status history-copy">No readings yet.</p>
        ) : (
          <ul className="history-list">
            {readings.map((reading) => (
              <li key={reading.id} className="history-item">
                <div className="history-meta">
                  <strong>
                    {formatReadingLabel(reading)}
                  </strong>
                  <p>{formatReadingTime(reading.measured_at)}</p>
                </div>
                <button
                  className="history-delete"
                  type="button"
                  onClick={() => void handleDelete(reading)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <DailyFactorsPanel supabaseConfigured={supabaseConfigured} />
    </main>
  );
}
