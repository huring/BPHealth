"use client";

import type { Dispatch, FormEvent, KeyboardEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import { InstallPrompt } from "./install-prompt";

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
type BloodPressurePeriod = "morning" | "lunch" | "evening";

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

type AverageReading = {
  systolic: number;
  diastolic: number;
};

type BloodPressureRange = "1d" | "1w" | "1m" | "1y" | "all";

const BLOOD_PRESSURE_CACHE_KEY = "bphealth.blood-pressure-readings.v1";
const DAILY_FACTORS_CACHE_PREFIX = "bphealth.daily-factors.v1.";

function toDateInputValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const localTime = new Date(date.getTime() - offsetMs);
  return localTime.toISOString().slice(0, 10);
}

function shiftDateInputValue(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function getBloodPressurePeriodLabel(period: BloodPressurePeriod) {
  if (period === "morning") {
    return "Morning";
  }

  if (period === "lunch") {
    return "Lunch";
  }

  return "Evening";
}

function getBloodPressurePeriodTime(period: BloodPressurePeriod) {
  if (period === "morning") {
    return "08:00:00";
  }

  if (period === "lunch") {
    return "12:00:00";
  }

  return "18:00:00";
}

function getClockHour(date: Date, timeZone?: string) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone,
      }).format(date),
    );
  } catch {
    return null;
  }
}

function getDefaultBloodPressurePeriod(date = new Date()) {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour =
    getClockHour(date, localTimeZone) ?? getClockHour(date, "Europe/Stockholm") ?? date.getHours();

  if (hour >= 5 && hour < 11) {
    return "morning";
  }

  if (hour >= 11 && hour < 17) {
    return "lunch";
  }

  return "evening";
}

function getBloodPressureMeasuredAt(day: string, period: BloodPressurePeriod) {
  return new Date(`${day}T${getBloodPressurePeriodTime(period)}`).toISOString();
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

function formatAverageLabel(reading: AverageReading) {
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

function formatChartAxisLabel(measuredAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(measuredAt));
}

function getAverageReading(readings: BloodPressureReading[]) {
  if (readings.length === 0) {
    return null;
  }

  const totalSystolic = readings.reduce((sum, reading) => sum + reading.systolic, 0);
  const totalDiastolic = readings.reduce((sum, reading) => sum + reading.diastolic, 0);

  return {
    systolic: Math.round(totalSystolic / readings.length),
    diastolic: Math.round(totalDiastolic / readings.length),
  } satisfies AverageReading;
}

function readCachedJson<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeCachedJson(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function getChartAxisTickIndexes(length: number, maxTicks = 5) {
  if (length <= maxTicks) {
    return Array.from({ length }, (_, index) => index);
  }

  const indexes = Array.from({ length: maxTicks }, (_, index) =>
    Math.round((index * (length - 1)) / (maxTicks - 1)),
  );

  return Array.from(new Set(indexes)).sort((left, right) => left - right);
}

function getRangeLabel(range: BloodPressureRange) {
  if (range === "1d") {
    return "1d";
  }

  if (range === "1w") {
    return "1w";
  }

  if (range === "1m") {
    return "1m";
  }

  if (range === "1y") {
    return "1y";
  }

  return "All";
}

function getRangeWindowDays(range: BloodPressureRange) {
  if (range === "1d") {
    return 1;
  }

  if (range === "1w") {
    return 7;
  }

  if (range === "1m") {
    return 30;
  }

  if (range === "1y") {
    return 365;
  }

  return null;
}

function filterBloodPressureReadingsByRange(readings: BloodPressureReading[], range: BloodPressureRange) {
  const windowDays = getRangeWindowDays(range);

  if (windowDays === null) {
    return readings;
  }

  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  return readings.filter((reading) => new Date(reading.measured_at).getTime() >= cutoff);
}

function ChipButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`chip${active ? " chip-active" : ""}`}
      type="button"
      aria-pressed={Boolean(active)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BloodPressureEntryModal({
  isMounted,
  isOpen,
  supabaseConfigured,
  isSaving,
  status,
  systolic,
  setSystolic,
  diastolic,
  setDiastolic,
  measuredDay,
  setMeasuredDay,
  measuredPeriod,
  setMeasuredPeriod,
  dailySleptOrNapped,
  setDailySleptOrNapped,
  dailyHadAlcohol,
  setDailyHadAlcohol,
  dailyFeeling,
  setDailyFeeling,
  onClose,
  onSubmit,
}: {
  isMounted: boolean;
  isOpen: boolean;
  supabaseConfigured: boolean;
  isSaving: boolean;
  status: string | null;
  systolic: string;
  setSystolic: (value: string) => void;
  diastolic: string;
  setDiastolic: (value: string) => void;
  measuredDay: string;
  setMeasuredDay: (value: string) => void;
  measuredPeriod: BloodPressurePeriod;
  setMeasuredPeriod: (value: BloodPressurePeriod) => void;
  dailySleptOrNapped: boolean;
  setDailySleptOrNapped: Dispatch<SetStateAction<boolean>>;
  dailyHadAlcohol: boolean;
  setDailyHadAlcohol: Dispatch<SetStateAction<boolean>>;
  dailyFeeling: DailyFeeling;
  setDailyFeeling: Dispatch<SetStateAction<DailyFeeling>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const systolicInputRef = useRef<HTMLInputElement>(null);
  const diastolicInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      systolicInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  if (!isMounted) {
    return null;
  }

  const periods: BloodPressurePeriod[] = ["morning", "lunch", "evening"];

  return (
    <div
      className={`entry-modal${isOpen ? " entry-modal-open" : " entry-modal-closing"}`}
      aria-hidden={!isOpen}
    >
      <button
        aria-label="Close measurement modal"
        className="entry-modal-backdrop"
        type="button"
        onClick={onClose}
      />

      <section
        aria-labelledby="entry-modal-title"
        aria-modal="true"
        className="entry-modal-panel"
        role="dialog"
      >
        <header className="entry-modal-header">
          <div>
            <p className="eyebrow">Add measurement</p>
            <h2 className="entry-modal-title" id="entry-modal-title">
              Blood pressure
            </h2>
          </div>

          <button
            aria-label="Close measurement modal"
            className="entry-modal-close"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="entry-modal-form" onSubmit={onSubmit}>
          <div className="entry-modal-body">
            {!supabaseConfigured ? (
              <p className="status">
                Supabase environment variables are missing. Add `NEXT_PUBLIC_SUPABASE_URL`
                and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable saving.
              </p>
            ) : null}

            <div className="entry-modal-grid">
              <label className="field field-compact entry-modal-field">
                <span>SYS</span>
                <input
                  ref={systolicInputRef}
                  aria-label="Systolic"
                  autoComplete="off"
                  enterKeyHint="next"
                  inputMode="numeric"
                  name="systolic"
                  type="number"
                  min="1"
                  step="1"
                  value={systolic}
                  onChange={(event) => setSystolic(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      diastolicInputRef.current?.focus();
                    }
                  }}
                />
              </label>

              <label className="field field-compact entry-modal-field">
                <span>DIA</span>
                <input
                  ref={diastolicInputRef}
                  aria-label="Diastolic"
                  autoComplete="off"
                  enterKeyHint="next"
                  inputMode="numeric"
                  name="diastolic"
                  type="number"
                  min="1"
                  step="1"
                  value={diastolic}
                  onChange={(event) => setDiastolic(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      dateInputRef.current?.focus();
                    }
                  }}
                />
              </label>

              <label className="field field-wide entry-modal-field entry-modal-date">
                <span>Date</span>
                <input
                  ref={dateInputRef}
                  enterKeyHint="done"
                  name="measured_day"
                  type="date"
                  value={measuredDay}
                  onChange={(event) => setMeasuredDay(event.target.value)}
                />
              </label>
            </div>

            <div className="segmented-stack">
              <span className="field-label">Time of day</span>
              <div className="segmented" role="radiogroup" aria-label="Time of day">
                {periods.map((period) => (
                  <button
                    key={period}
                    aria-pressed={measuredPeriod === period}
                    className={`segmented-option${measuredPeriod === period ? " segmented-option-active" : ""}`}
                    type="button"
                    onClick={() => setMeasuredPeriod(period)}
                  >
                    {getBloodPressurePeriodLabel(period)}
                  </button>
                ))}
              </div>
            </div>

            <div className="entry-modal-factors" aria-label="Daily factors">
              <div className="chip-row">
                <ChipButton
                  active={dailySleptOrNapped}
                  onClick={() => setDailySleptOrNapped((current) => !current)}
                >
                  Slept / nap
                </ChipButton>
                <ChipButton
                  active={dailyHadAlcohol}
                  onClick={() => setDailyHadAlcohol((current) => !current)}
                >
                  Alcohol
                </ChipButton>
              </div>

              <div className="segmented" role="radiogroup" aria-label="Feeling">
                {(["good_productive", "neutral", "bad"] as DailyFeeling[]).map((feeling) => (
                  <button
                    key={feeling}
                    aria-pressed={dailyFeeling === feeling}
                    className={`segmented-option${dailyFeeling === feeling ? " segmented-option-active" : ""}`}
                    type="button"
                    onClick={() => setDailyFeeling(feeling)}
                  >
                    {feeling === "good_productive" ? "Good" : feeling === "neutral" ? "Neutral" : "Bad"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <footer className="entry-modal-footer">
            {status ? <p className="status">{status}</p> : null}
            <button className="entry-modal-submit" type="submit" disabled={!supabaseConfigured || isSaving}>
              {isSaving ? "Saving..." : "Add measurement"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function BloodPressureChart({
  readings,
  timeRange,
  onTimeRangeChange,
}: {
  readings: BloodPressureReading[];
  timeRange: BloodPressureRange;
  onTimeRangeChange: (range: BloodPressureRange) => void;
}) {
  const chronological = getChronologicalReadings(readings);
  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  const rangeReadings = filterBloodPressureReadingsByRange(chronological, timeRange);
  const latestReading = rangeReadings[rangeReadings.length - 1] ?? null;

  useEffect(() => {
    if (rangeReadings.length === 0) {
      setSelectedReadingId(null);
      return;
    }

    setSelectedReadingId((current) => {
      if (current && rangeReadings.some((reading) => reading.id === current)) {
        return current;
      }

      return latestReading?.id ?? rangeReadings[rangeReadings.length - 1].id;
    });
  }, [rangeReadings, latestReading?.id]);

  if (chronological.length === 0) {
    return <p className="status">No chart data yet.</p>;
  }

  if (rangeReadings.length === 0) {
    return (
      <div className="chart">
        <div className="chart-ranges" role="tablist" aria-label="Chart time range">
          {(["1d", "1w", "1m", "1y", "all"] as BloodPressureRange[]).map((range) => (
            <ChipButton key={range} active={timeRange === range} onClick={() => onTimeRangeChange(range)}>
              {getRangeLabel(range)}
            </ChipButton>
          ))}
        </div>

        <p className="status">No readings in this range yet.</p>
      </div>
    );
  }

  const width = 640;
  const height = 324;
  const padding = 32;
  const axisY = height - 34;
  const allValues = rangeReadings.flatMap((reading) => [reading.systolic, reading.diastolic]);
  const minValue = Math.min(...allValues) - 10;
  const maxValue = Math.max(...allValues) + 10;
  const systolicPoints = buildChartPoints(
    rangeReadings,
    (reading) => reading.systolic,
    width,
    height,
    padding,
    minValue,
    maxValue,
  );
  const diastolicPoints = buildChartPoints(
    rangeReadings,
    (reading) => reading.diastolic,
    width,
    height,
    padding,
    minValue,
    maxValue,
  );
  const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];
  const axisTickIndexes = getChartAxisTickIndexes(rangeReadings.length);
  const selectedReading =
    rangeReadings.find((reading) => reading.id === selectedReadingId) ?? latestReading;

  function handleReadingSelect(readingId: string) {
    setSelectedReadingId(readingId);
  }

  function handleReadingKeyDown(event: KeyboardEvent<SVGCircleElement>, readingId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedReadingId(readingId);
    }
  }

  return (
    <div className="chart">
      <div className="chart-ranges" role="tablist" aria-label="Chart time range">
        {(["1d", "1w", "1m", "1y", "all"] as BloodPressureRange[]).map((range) => (
          <ChipButton key={range} active={timeRange === range} onClick={() => onTimeRangeChange(range)}>
            {getRangeLabel(range)}
          </ChipButton>
        ))}
      </div>

      <div className="chart-meta">
        {selectedReading ? (
          <button
            className="chart-selection"
            type="button"
            onClick={() => handleReadingSelect(selectedReading.id)}
            aria-label={`Selected reading ${formatReadingLabel(selectedReading)} from ${formatReadingTime(selectedReading.measured_at)}`}
          >
            <span>Selected</span>
            <strong>{formatReadingLabel(selectedReading)}</strong>
            <small>{formatReadingTime(selectedReading.measured_at)}</small>
          </button>
        ) : null}
      </div>

      <div className="chart-stage">
        <div className="chart-range-status" aria-live="polite">
          Showing {rangeReadings.length} reading{rangeReadings.length === 1 ? "" : "s"} for {getRangeLabel(timeRange)}
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

          {rangeReadings.map((reading, index) => {
            const systolicPoint = systolicPoints[index];
            const diastolicPoint = diastolicPoints[index];
            const topY = Math.min(systolicPoint.y, diastolicPoint.y);
            const bottomY = Math.max(systolicPoint.y, diastolicPoint.y);
            const isSelected = reading.id === selectedReadingId;

            return (
              <g
                key={`range-${reading.id}`}
                className={isSelected ? "chart-selected" : "chart-dimmed"}
              >
                <line
                  className="chart-range"
                  x1={systolicPoint.x}
                  x2={diastolicPoint.x}
                  y1={topY}
                  y2={bottomY}
                />
                <circle
                  className="chart-range-point chart-range-point-systolic"
                  cx={systolicPoint.x}
                  cy={systolicPoint.y}
                  r={isSelected ? "5.6" : "4.5"}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select systolic ${reading.systolic} on ${formatChartAxisLabel(reading.measured_at)}`}
                  onClick={() => handleReadingSelect(reading.id)}
                  onKeyDown={(event) => handleReadingKeyDown(event, reading.id)}
                />
                <circle
                  className="chart-range-point chart-range-point-diastolic"
                  cx={diastolicPoint.x}
                  cy={diastolicPoint.y}
                  r={isSelected ? "5.6" : "4.5"}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select diastolic ${reading.diastolic} on ${formatChartAxisLabel(reading.measured_at)}`}
                  onClick={() => handleReadingSelect(reading.id)}
                  onKeyDown={(event) => handleReadingKeyDown(event, reading.id)}
                />
              </g>
            );
          })}

          <path className="chart-line chart-line-systolic" d={pointsToPath(systolicPoints)} />
          <path className="chart-line chart-line-diastolic" d={pointsToPath(diastolicPoints)} />

          {axisTickIndexes.map((index) => {
            const point = rangeReadings[index];
            const chartPoint = systolicPoints[index];

            return (
              <g key={`axis-${point.id}`}>
                <line className="chart-axis-tick" x1={chartPoint.x} x2={chartPoint.x} y1={axisY} y2={axisY + 8} />
                <text className="chart-axis-label" x={chartPoint.x} y={axisY + 24} textAnchor="middle">
                  {formatChartAxisLabel(point.measured_at)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  const supabaseConfigured = hasSupabaseConfig();
  const addMeasurementButtonRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [measuredDay, setMeasuredDay] = useState(() => toDateInputValue(new Date()));
  const [measuredPeriod, setMeasuredPeriod] = useState<BloodPressurePeriod>(() =>
    getDefaultBloodPressurePeriod(),
  );
  const [dailySleptOrNapped, setDailySleptOrNapped] = useState(false);
  const [dailyHadAlcohol, setDailyHadAlcohol] = useState(false);
  const [dailyFeeling, setDailyFeeling] = useState<DailyFeeling>("neutral");
  const [chartRange, setChartRange] = useState<BloodPressureRange>("all");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isAddModalMounted, setIsAddModalMounted] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const addModalCloseTimer = useRef<number | null>(null);
  const chronologicalReadings = getChronologicalReadings(readings);
  const rangeReadings = filterBloodPressureReadingsByRange(chronologicalReadings, chartRange);
  const latestReading = rangeReadings[rangeReadings.length - 1] ?? null;
  const averageReading = getAverageReading(rangeReadings);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
          writeCachedJson(BLOOD_PRESSURE_CACHE_KEY, data ?? []);
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

  useEffect(() => {
    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setStatus((current) => current ?? "Back online.");
    }

    function handleOffline() {
      setIsOnline(false);
      setStatus("You're offline. Showing cached data.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const cachedReadings = readCachedJson<BloodPressureReading[]>(BLOOD_PRESSURE_CACHE_KEY);
    if (cachedReadings && cachedReadings.length > 0) {
      setReadings(cachedReadings);
      setIsLoading(false);
      setStatus("Showing cached readings while syncing.");
    }
  }, []);

  useEffect(() => {
    if (!isAddModalMounted) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      setIsAddModalOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isAddModalMounted]);

  useEffect(() => {
    if (!isAddModalMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAddModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddModalMounted]);

  useEffect(() => {
    return () => {
      if (addModalCloseTimer.current !== null) {
        window.clearTimeout(addModalCloseTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAddModalMounted) {
      return;
    }

    let isActive = true;

    async function loadDailyFactorsForDay() {
      const cacheKey = `${DAILY_FACTORS_CACHE_PREFIX}${measuredDay}`;
      const cachedRow = readCachedJson<DailyFactorRow>(cacheKey);

      if (cachedRow && isActive) {
        setDailySleptOrNapped(cachedRow.slept_or_napped);
        setDailyHadAlcohol(cachedRow.had_alcohol);
        setDailyFeeling(cachedRow.feeling);
      }

      if (!supabaseConfigured) {
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          throw new Error("Supabase is not configured yet.");
        }

        const { data, error } = await supabase
          .from("daily_factors")
          .select("day, slept_or_napped, had_alcohol, feeling")
          .eq("day", measuredDay)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }

        if (data) {
          const row = data as DailyFactorRow;
          setDailySleptOrNapped(row.slept_or_napped);
          setDailyHadAlcohol(row.had_alcohol);
          setDailyFeeling(row.feeling);
          writeCachedJson(cacheKey, row);
        } else if (!cachedRow) {
          setDailySleptOrNapped(false);
          setDailyHadAlcohol(false);
          setDailyFeeling("neutral");
        }
      } catch (error) {
        if (isActive) {
          setStatus(error instanceof Error ? error.message : "Unable to load daily factors.");
        }
      }
    }

    void loadDailyFactorsForDay();

    return () => {
      isActive = false;
    };
  }, [isAddModalMounted, measuredDay, supabaseConfigured]);

  function openAddModal() {
    if (addModalCloseTimer.current !== null) {
      window.clearTimeout(addModalCloseTimer.current);
      addModalCloseTimer.current = null;
    }

    setMeasuredDay(toDateInputValue(new Date()));
    setMeasuredPeriod(getDefaultBloodPressurePeriod());
    setDailySleptOrNapped(false);
    setDailyHadAlcohol(false);
    setDailyFeeling("neutral");
    setStatus(null);
    setIsAddModalMounted(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);

    if (addModalCloseTimer.current !== null) {
      window.clearTimeout(addModalCloseTimer.current);
    }

    addModalCloseTimer.current = window.setTimeout(() => {
      setIsAddModalMounted(false);
      addMeasurementButtonRef.current?.focus();
    }, 180);
  }

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
    writeCachedJson(BLOOD_PRESSURE_CACHE_KEY, data ?? []);
  }

  async function handleDelete(reading: BloodPressureReading) {
    if (!supabaseConfigured) {
      setStatus("Supabase is not configured yet. Add the env vars to delete readings.");
      return;
    }

    if (!isOnline) {
      setStatus("You're offline. Delete actions need a connection.");
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

    if (!isOnline) {
      setStatus("You're offline. Reading saves need a connection.");
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
        measured_at: getBloodPressureMeasuredAt(measuredDay, measuredPeriod),
      });

      if (error) {
        throw error;
      }

      const { error: dailyError } = await supabase.from("daily_factors").upsert(
        {
          day: measuredDay,
          slept_or_napped: dailySleptOrNapped,
          had_alcohol: dailyHadAlcohol,
          feeling: dailyFeeling,
        },
        { onConflict: "day" },
      );

      if (dailyError) {
        throw dailyError;
      }

      writeCachedJson(BLOOD_PRESSURE_CACHE_KEY, [
        {
          id: crypto.randomUUID(),
          systolic: Number(systolic),
          diastolic: Number(diastolic),
          measured_at: getBloodPressureMeasuredAt(measuredDay, measuredPeriod),
        },
        ...chronologicalReadings,
      ]);
      writeCachedJson(`${DAILY_FACTORS_CACHE_PREFIX}${measuredDay}`, {
        day: measuredDay,
        slept_or_napped: dailySleptOrNapped,
        had_alcohol: dailyHadAlcohol,
        feeling: dailyFeeling,
      } satisfies DailyFactorRow);
      setStatus("Measurement saved.");
      setSystolic("");
      setDiastolic("");
      setMeasuredDay(toDateInputValue(new Date()));
      setMeasuredPeriod(getDefaultBloodPressurePeriod());
      setDailySleptOrNapped(false);
      setDailyHadAlcohol(false);
      setDailyFeeling("neutral");
      closeAddModal();
      await reloadReadings();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save reading.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="shell app-shell">
      <InstallPrompt />
      {!isOnline ? (
        <p className="install-banner" role="status">
          Offline mode: cached data is available, but saving needs a connection.
        </p>
      ) : null}
      <header className="page-hero" id="latest">
        {!isMounted ? (
          <div className="page-hero-stats" aria-label="Latest and average blood pressure">
            <div className="hero-stat hero-stat-placeholder">
              <span className="hero-stat-label">Latest</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">--</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">--</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>

            <div className="hero-stat hero-stat-placeholder">
              <span className="hero-stat-label">Average</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">--</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">--</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>
          </div>
        ) : latestReading && averageReading ? (
          <div className="page-hero-stats" aria-label="Latest and average blood pressure">
            <div className="hero-stat">
              <span className="hero-stat-label">Latest</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">{latestReading.systolic}</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">{latestReading.diastolic}</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>

            <div className="hero-stat">
              <span className="hero-stat-label">Average</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">{averageReading.systolic}</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">{averageReading.diastolic}</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>
          </div>
        ) : latestReading ? (
          <div className="page-hero-stats" aria-label="Latest blood pressure">
            <div className="hero-stat">
              <span className="hero-stat-label">Latest</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">{latestReading.systolic}</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">{latestReading.diastolic}</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>
            <div className="hero-stat hero-stat-empty">
              <span className="hero-stat-label">Average</span>
              <strong className="hero-stat-value">--/--</strong>
              <span className="hero-stat-unit">mmHg</span>
            </div>
          </div>
        ) : (
          <p className="page-hero-note">No readings yet.</p>
        )}
      </header>

      <section className="page-section" id="chart">
        {isLoading ? (
          <p className="status">Loading chart...</p>
        ) : (
          <BloodPressureChart
            readings={readings}
            timeRange={chartRange}
            onTimeRangeChange={setChartRange}
          />
        )}
      </section>

      <section className="page-section" id="add">
        {!supabaseConfigured ? (
          <p className="status">
            Supabase environment variables are missing. Add `NEXT_PUBLIC_SUPABASE_URL`
            and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable saving and history.
          </p>
        ) : null}
        <button
          ref={addMeasurementButtonRef}
          className="add-measurement-button"
          type="button"
          onClick={openAddModal}
        >
          Add measurement
        </button>
        {!isAddModalMounted && status ? <p className="status">{status}</p> : null}
      </section>

      <details className="page-section history-panel" id="history">
        <summary>
          <span>Recent readings</span>
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

      <BloodPressureEntryModal
        isMounted={isAddModalMounted}
        isOpen={isAddModalOpen}
        supabaseConfigured={supabaseConfigured}
        isSaving={isSaving}
        status={status}
        systolic={systolic}
        setSystolic={setSystolic}
        diastolic={diastolic}
        setDiastolic={setDiastolic}
        measuredDay={measuredDay}
        setMeasuredDay={setMeasuredDay}
        measuredPeriod={measuredPeriod}
        setMeasuredPeriod={setMeasuredPeriod}
        dailySleptOrNapped={dailySleptOrNapped}
        setDailySleptOrNapped={setDailySleptOrNapped}
        dailyHadAlcohol={dailyHadAlcohol}
        setDailyHadAlcohol={setDailyHadAlcohol}
        dailyFeeling={dailyFeeling}
        setDailyFeeling={setDailyFeeling}
        onClose={closeAddModal}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
