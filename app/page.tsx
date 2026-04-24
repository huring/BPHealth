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

type MeasurementTagRow = {
  id: string;
  name: string;
  created_at: string;
};

type MeasurementTagAssignmentRow = {
  measurement_id: string;
  tag_id: string;
  created_at: string;
};

type BloodPressurePeriod = "morning" | "lunch" | "evening";

type ChartPoint = {
  x: number;
  y: number;
};

type AverageReading = {
  systolic: number;
  diastolic: number;
};

type BloodPressureRange = "1d" | "1w" | "1m" | "1y" | "all";

const AUTOMATIC_MEASUREMENT_TAG_NAMES = ["morning", "lunch", "evening"] as const;

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

function isTodayDateInputValue(dateValue: string) {
  return dateValue === toDateInputValue(new Date());
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

function formatReadingLabel(reading: BloodPressureReading) {
  return `${reading.systolic}/${reading.diastolic}`;
}

function normalizeMeasurementTagName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function formatMeasurementDayLabel(day: string) {
  return formatPrettyDate(new Date(`${day}T00:00:00`), true, false);
}

function getAutomaticMeasurementTagName(period: BloodPressurePeriod) {
  return getBloodPressurePeriodLabel(period).toLowerCase();
}

function isAutomaticMeasurementTagName(name: string) {
  return AUTOMATIC_MEASUREMENT_TAG_NAMES.includes(normalizeMeasurementTagName(name).toLowerCase() as (typeof AUTOMATIC_MEASUREMENT_TAG_NAMES)[number]);
}

function filterReadingsByTags(
  readings: BloodPressureReading[],
  selectedTagIds: string[],
  tagIdsByReadingId: Record<string, string[]>,
) {
  if (selectedTagIds.length === 0) {
    return readings;
  }

  return readings.filter((reading) => {
    const readingTagIds = tagIdsByReadingId[reading.id] ?? [];
    return selectedTagIds.every((tagId) => readingTagIds.includes(tagId));
  });
}

function getVisibleMeasurementTags(measurementTags: MeasurementTagRow[]) {
  return measurementTags
    .filter((tag) => !isAutomaticMeasurementTagName(tag.name))
    .slice()
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function getMeasurementTagCountsById(assignments: MeasurementTagAssignmentRow[]) {
  return assignments.reduce<Record<string, number>>((counts, assignment) => {
    counts[assignment.tag_id] = (counts[assignment.tag_id] ?? 0) + 1;
    return counts;
  }, {});
}

function getLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getRelativeDayLabel(date: Date, reference = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const target = getLocalDayStart(date).getTime();
  const current = getLocalDayStart(reference).getTime();
  const diffDays = Math.round((current - target) / dayMs);

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays === 2) {
    return "2 days ago";
  }

  return null;
}

function formatPrettyDate(date: Date, preferRelative: boolean, includeTime: boolean) {
  const absoluteDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
  const relative = preferRelative ? getRelativeDayLabel(date) : null;

  return relative ?? absoluteDate;
}

function formatReadingTime(measuredAt: string, preferRelative = false) {
  return formatPrettyDate(new Date(measuredAt), preferRelative, true);
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
    return "Today";
  }

  if (range === "1w") {
    return "Week";
  }

  if (range === "1m") {
    return "Month";
  }

  if (range === "1y") {
    return "Year";
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
  className,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`chip${className ? ` ${className}` : ""}${active ? " chip-active" : ""}`}
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
  measurementTags,
  selectedTagIds,
  tagDraft,
  setTagDraft,
  isTagDraftOpen,
  setIsTagDraftOpen,
  tagStatus,
  onCreateTag,
  onToggleTag,
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
  measurementTags: MeasurementTagRow[];
  selectedTagIds: string[];
  tagDraft: string;
  setTagDraft: (value: string) => void;
  isTagDraftOpen: boolean;
  setIsTagDraftOpen: (value: boolean) => void;
  tagStatus: string | null;
  onCreateTag: () => void;
  onToggleTag: (tagId: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const systolicInputRef = useRef<HTMLInputElement>(null);
  const diastolicInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const manualMeasurementTags = measurementTags.filter((tag) => !isAutomaticMeasurementTagName(tag.name));
  const isToday = isTodayDateInputValue(measuredDay);

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

  useEffect(() => {
    if (!isOpen || !isTagDraftOpen) {
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      tagInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen, isTagDraftOpen]);

  if (!isMounted) {
    return null;
  }

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

            <div className="field field-wide entry-modal-field entry-modal-date">
              <div className="date-row">
                <button
                  className="date-step-button"
                  type="button"
                  aria-label="Previous day"
                  onClick={() => setMeasuredDay(shiftDateInputValue(measuredDay, -1))}
                >
                  ←
                </button>
                <div className="date-label" aria-live="polite">
                  {formatMeasurementDayLabel(measuredDay)}
                </div>
                <button
                  className="date-step-button"
                  type="button"
                  aria-label="Next day"
                  disabled={isToday}
                  onClick={() => {
                    if (!isToday) {
                      setMeasuredDay(shiftDateInputValue(measuredDay, 1));
                    }
                  }}
                >
                  →
                </button>
              </div>
            </div>

            <div className="entry-modal-grid">
              <label className="field field-compact entry-modal-field">
                <span>Systolic</span>
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
                <span>Diastolic</span>
                <input
                  ref={diastolicInputRef}
                  aria-label="Diastolic"
                  autoComplete="off"
                  enterKeyHint="done"
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
                      setIsTagDraftOpen(true);
                    }
                  }}
                />
              </label>
            </div>

            <div className="chip-stack tag-chip-stack" aria-label="Measurement tags">
              {tagStatus ? <p className="status tag-status">{tagStatus}</p> : null}
              <div className="tag-inline-row">
                <div className="chip-row tag-chip-cloud">
                  {manualMeasurementTags.length === 0 ? (
                    <p className="status tag-empty">No tags yet. Add one to get started.</p>
                  ) : (
                    manualMeasurementTags.map((tag) => (
                      <ChipButton
                        key={tag.id}
                        active={selectedTagIds.includes(tag.id)}
                        className="chip-tag"
                        onClick={() => onToggleTag(tag.id)}
                      >
                        <span className="chip-label">{tag.name}</span>
                      </ChipButton>
                    ))
                  )}
                </div>
                {isTagDraftOpen ? (
                  <input
                    ref={tagInputRef}
                    aria-label="Add a tag"
                    autoComplete="off"
                    className="tag-input tag-input-inline"
                    enterKeyHint="done"
                    placeholder="New tag"
                    type="text"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCreateTag();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        setIsTagDraftOpen(false);
                        setTagDraft("");
                      }
                    }}
                  />
                ) : null}
                <button
                  className="tag-plus-button"
                  type="button"
                  disabled={!supabaseConfigured || isSaving}
                  aria-label={isTagDraftOpen ? "Add tag input open" : "Add tag"}
                  onClick={() => setIsTagDraftOpen(true)}
                >
                  +
                </button>
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
  preferRelativeDates,
}: {
  readings: BloodPressureReading[];
  timeRange: BloodPressureRange;
  onTimeRangeChange: (range: BloodPressureRange) => void;
  preferRelativeDates: boolean;
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

      return null;
    });
  }, [rangeReadings, latestReading?.id]);

  if (chronological.length === 0) {
    return <p className="status">No chart data yet.</p>;
  }

  if (rangeReadings.length === 0) {
    return (
      <div className="chart">
        <div className="chart-ranges segmented" role="radiogroup" aria-label="Chart time range">
          {(["1d", "1w", "1m", "1y", "all"] as BloodPressureRange[]).map((range) => (
            <button
              key={range}
              aria-pressed={timeRange === range}
              className={`segmented-option${timeRange === range ? " segmented-option-active" : ""}`}
              type="button"
              onClick={() => onTimeRangeChange(range)}
            >
              {getRangeLabel(range)}
            </button>
          ))}
        </div>

        <p className="status">No readings in this range yet.</p>
      </div>
    );
  }

  const width = 640;
  const height = 352;
  const padding = 48;
  const axisY = height - 34;
  const innerWidth = width - padding * 2;
  const allValues = rangeReadings.flatMap((reading) => [reading.systolic, reading.diastolic]);
  const minValue = Math.min(...allValues) - 10;
  const maxValue = Math.max(...allValues) + 10;
  const chartPointSpacing = rangeReadings.length > 1 ? innerWidth / (rangeReadings.length - 1) : innerWidth;
  const rangeBodyWidth = Math.max(10, Math.min(16, chartPointSpacing * 0.34));
  const rangeBodyRadius = Math.min(rangeBodyWidth / 2, 8);
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
  const axisTickIndexes = getChartAxisTickIndexes(rangeReadings.length, chartPointSpacing < 72 ? 4 : 5);
  const selectedReading = rangeReadings.find((reading) => reading.id === selectedReadingId) ?? null;
  const selectedReadingIndex = selectedReading
    ? rangeReadings.findIndex((reading) => reading.id === selectedReading.id)
    : -1;
  const selectedSystolicPoint = selectedReadingIndex >= 0 ? systolicPoints[selectedReadingIndex] : null;
  const selectedDiastolicPoint = selectedReadingIndex >= 0 ? diastolicPoints[selectedReadingIndex] : null;
  const selectedChipPosition =
    selectedReading && selectedSystolicPoint && selectedDiastolicPoint
      ? {
          x: Math.min(width - 110, Math.max(110, selectedSystolicPoint.x)),
          y: Math.min(selectedSystolicPoint.y, selectedDiastolicPoint.y),
        }
      : null;
  const selectedChipPlacement =
    selectedChipPosition && selectedChipPosition.y < 76 ? "below" : "above";

  function handleReadingSelect(readingId: string) {
    setSelectedReadingId((current) => (current === readingId ? null : readingId));
  }

  function handleReadingKeyDown(event: KeyboardEvent<SVGElement>, readingId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleReadingSelect(readingId);
    }
  }

  return (
    <div className="chart">
      <div className="chart-ranges segmented" role="radiogroup" aria-label="Chart time range">
        {(["1d", "1w", "1m", "1y", "all"] as BloodPressureRange[]).map((range) => (
          <button
            key={range}
            aria-pressed={timeRange === range}
            className={`segmented-option${timeRange === range ? " segmented-option-active" : ""}`}
            type="button"
            onClick={() => onTimeRangeChange(range)}
          >
            {getRangeLabel(range)}
          </button>
        ))}
      </div>

      <div className="chart-stage">
        {selectedReading && selectedChipPosition ? (
          <button
            className={`chart-selection-chip chart-selection-chip--${selectedChipPlacement}`}
            type="button"
            style={{
              left: `${(selectedChipPosition.x / width) * 100}%`,
              top: `${(selectedChipPosition.y / height) * 100}%`,
            }}
            aria-label={`Deselect reading ${formatReadingLabel(selectedReading)} from ${formatReadingTime(selectedReading.measured_at, preferRelativeDates)}`}
            aria-pressed="true"
            onClick={() => handleReadingSelect(selectedReading.id)}
          >
            <strong>{formatReadingLabel(selectedReading)}</strong>
            <small suppressHydrationWarning>{formatReadingTime(selectedReading.measured_at, preferRelativeDates)}</small>
          </button>
        ) : null}

        <svg
          aria-label="Blood pressure readings over time"
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
        >
          <defs>
            <linearGradient id="bp-range-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="bp-range-selected-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f97373" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {yTicks.map((tickValue) => {
            const range = Math.max(maxValue - minValue, 1);
            const y = padding + (1 - (tickValue - minValue) / range) * (height - padding * 2);

            return (
              <g key={tickValue}>
                <line className="chart-grid" x1={padding} x2={width - padding} y1={y} y2={y} />
                <text className="chart-tick" x={12} y={y + 4}>
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
            const bodyHeight = Math.max(bottomY - topY, rangeBodyWidth);
            const bodyY = (topY + bottomY) / 2 - bodyHeight / 2;
            const bodyX = systolicPoint.x - rangeBodyWidth / 2;
            const isSelected = reading.id === selectedReadingId;
            const rangeState = selectedReadingId ? (isSelected ? "chart-selected" : "chart-dimmed") : "";

            return (
              <g key={`range-${reading.id}`} className={rangeState}>
                <rect
                  className="chart-range-body"
                  x={bodyX}
                  y={bodyY}
                  width={rangeBodyWidth}
                  height={bodyHeight}
                  rx={rangeBodyRadius}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`Select range ${formatReadingLabel(reading)} on ${formatChartAxisLabel(reading.measured_at)}`}
                  onClick={() => handleReadingSelect(reading.id)}
                  onKeyDown={(event) => handleReadingKeyDown(event, reading.id)}
                />
                <circle
                  className="chart-range-point chart-range-point-systolic"
                  cx={systolicPoint.x}
                  cy={systolicPoint.y}
                  r={isSelected ? "5.6" : "4.5"}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
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
                  aria-pressed={isSelected}
                  aria-label={`Select diastolic ${reading.diastolic} on ${formatChartAxisLabel(reading.measured_at)}`}
                  onClick={() => handleReadingSelect(reading.id)}
                  onKeyDown={(event) => handleReadingKeyDown(event, reading.id)}
                />
              </g>
            );
          })}

          {axisTickIndexes.map((index) => {
            const point = rangeReadings[index];
            const chartPoint = systolicPoints[index];

            return (
              <g key={`axis-${point.id}`}>
                <line className="chart-axis-tick" x1={chartPoint.x} x2={chartPoint.x} y1={axisY} y2={axisY + 8} />
                <text
                  suppressHydrationWarning
                  className="chart-axis-label"
                  x={chartPoint.x}
                  y={axisY + 24}
                  textAnchor="middle"
                >
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
  const [measurementTags, setMeasurementTags] = useState<MeasurementTagRow[]>([]);
  const [measurementTagAssignments, setMeasurementTagAssignments] = useState<MeasurementTagAssignmentRow[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [isTagDraftOpen, setIsTagDraftOpen] = useState(false);
  const [tagStatus, setTagStatus] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<BloodPressureRange>("all");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalMounted, setIsAddModalMounted] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const addModalCloseTimer = useRef<number | null>(null);
  const chronologicalReadings = getChronologicalReadings(readings);
  const measurementTagIdsByReadingId = measurementTagAssignments.reduce<Record<string, string[]>>(
    (accumulator, assignment) => {
      const current = accumulator[assignment.measurement_id] ?? [];
      if (!current.includes(assignment.tag_id)) {
        accumulator[assignment.measurement_id] = [...current, assignment.tag_id];
      }

      return accumulator;
    },
    {},
  );
  const measurementTagsById = Object.fromEntries(
    measurementTags.map((tag) => [tag.id, tag] as const),
  ) as Record<string, MeasurementTagRow>;
  const measurementTagCountsById = getMeasurementTagCountsById(measurementTagAssignments);
  const manualMeasurementTags = getVisibleMeasurementTags(measurementTags);
  const filteredChronologicalReadings = filterReadingsByTags(
    chronologicalReadings,
    selectedFilterTagIds,
    measurementTagIdsByReadingId,
  );
  const recentReadings = [...filteredChronologicalReadings].reverse();
  const rangeReadings = filterBloodPressureReadingsByRange(filteredChronologicalReadings, chartRange);
  const latestReading = rangeReadings[rangeReadings.length - 1] ?? null;
  const averageReading = getAverageReading(rangeReadings);
  const latestSystolic = latestReading ? latestReading.systolic : "--";
  const latestDiastolic = latestReading ? latestReading.diastolic : "--";
  const averageSystolic = averageReading ? averageReading.systolic : "--";
  const averageDiastolic = averageReading ? averageReading.diastolic : "--";
  const filteredTagCount = selectedFilterTagIds.length;
  const filteredTagLabel =
    filteredTagCount === 0
      ? "All readings"
      : `${filteredTagCount} filter${filteredTagCount === 1 ? "" : "s"} active`;
  const measurementTagsByReadingId = Object.fromEntries(
    Object.entries(measurementTagIdsByReadingId).map(([readingId, tagIds]) => [
      readingId,
      tagIds.map((tagId) => measurementTagsById[tagId]).filter((tag): tag is MeasurementTagRow => Boolean(tag)),
    ]),
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadReadingsAndTags() {
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
        const [readingsResult, tagsResult, assignmentsResult] = await Promise.all([
          supabase
            .from("blood_pressure_readings")
            .select("id, systolic, diastolic, measured_at")
            .order("measured_at", { ascending: false }),
          supabase
            .from("measurement_tags")
            .select("id, name, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("measurement_tag_assignments")
            .select("measurement_id, tag_id, created_at")
            .order("created_at", { ascending: false }),
        ]);

        if (readingsResult.error) {
          throw readingsResult.error;
        }
        if (tagsResult.error) {
          throw tagsResult.error;
        }
        if (assignmentsResult.error) {
          throw assignmentsResult.error;
        }

        if (isActive) {
          setReadings((readingsResult.data ?? []) as BloodPressureReading[]);
          setMeasurementTags((tagsResult.data ?? []) as MeasurementTagRow[]);
          setMeasurementTagAssignments((assignmentsResult.data ?? []) as MeasurementTagAssignmentRow[]);
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

    void loadReadingsAndTags();

    return () => {
      isActive = false;
    };
  }, [supabaseConfigured]);

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

  function openAddModal() {
    if (addModalCloseTimer.current !== null) {
      window.clearTimeout(addModalCloseTimer.current);
      addModalCloseTimer.current = null;
    }

    setMeasuredDay(toDateInputValue(new Date()));
    setSelectedTagIds([]);
    setTagDraft("");
    setIsTagDraftOpen(false);
    setTagStatus(null);
    setStatus(null);
    setIsAddModalMounted(true);
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setIsTagDraftOpen(false);

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
    const [readingsResult, tagsResult, assignmentsResult] = await Promise.all([
      supabase
        .from("blood_pressure_readings")
        .select("id, systolic, diastolic, measured_at")
        .order("measured_at", { ascending: false }),
      supabase
        .from("measurement_tags")
        .select("id, name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("measurement_tag_assignments")
        .select("measurement_id, tag_id, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (readingsResult.error) {
      throw readingsResult.error;
    }
    if (tagsResult.error) {
      throw tagsResult.error;
    }
    if (assignmentsResult.error) {
      throw assignmentsResult.error;
    }

    setReadings((readingsResult.data ?? []) as BloodPressureReading[]);
    setMeasurementTags((tagsResult.data ?? []) as MeasurementTagRow[]);
    setMeasurementTagAssignments((assignmentsResult.data ?? []) as MeasurementTagAssignmentRow[]);
  }

  async function handleCreateMeasurementTag() {
    if (!supabaseConfigured) {
      setTagStatus("Supabase is not configured yet. Add the env vars to save tags.");
      return;
    }

    const normalizedName = normalizeMeasurementTagName(tagDraft);
    if (!normalizedName) {
      setTagStatus("Enter a tag name first.");
      return;
    }

    const normalizedLookup = normalizedName.toLowerCase();
    const existingTag = measurementTags.find(
      (tag) => normalizeMeasurementTagName(tag.name).toLowerCase() === normalizedLookup,
    );

    if (existingTag) {
      setSelectedTagIds((current) =>
        current.includes(existingTag.id) ? current : [...current, existingTag.id],
      );
      setTagDraft("");
      setIsTagDraftOpen(false);
      return;
    }

    setTagStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase is not configured yet.");
      }

      const { data, error } = await supabase
        .from("measurement_tags")
        .insert({ name: normalizedName })
        .select("id, name, created_at")
        .single();
      if (error) {
        throw error;
      }

      await reloadReadings();
      if (data) {
        setSelectedTagIds((current) =>
          current.includes(data.id) ? current : [...current, data.id],
        );
      }
      setTagDraft("");
      setIsTagDraftOpen(false);
    } catch (error) {
      setTagStatus(error instanceof Error ? error.message : "Unable to save tag.");
    }
  }

  async function resolveMeasurementTagId(
    supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
    tagName: string,
  ) {
    const normalizedName = normalizeMeasurementTagName(tagName);
    const localMatch = measurementTags.find(
      (tag) => normalizeMeasurementTagName(tag.name).toLowerCase() === normalizedName.toLowerCase(),
    );

    if (localMatch) {
      return localMatch.id;
    }

    const { data, error } = await supabase
      .from("measurement_tags")
      .select("id, name, created_at")
      .ilike("name", normalizedName)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return (data as MeasurementTagRow).id;
    }

    const { data: insertedTag, error: insertError } = await supabase
      .from("measurement_tags")
      .insert({ name: normalizedName })
      .select("id, name, created_at")
      .single();

    if (insertError) {
      throw insertError;
    }

    return (insertedTag as MeasurementTagRow).id;
  }

  function handleToggleMeasurementTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((currentTagId) => currentTagId !== tagId) : [...current, tagId],
    );
  }

  async function handleDelete(reading: BloodPressureReading) {
    if (!supabaseConfigured) {
      setStatus("Supabase is not configured yet. Add the env vars to delete readings.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${formatReadingLabel(reading)} from ${formatReadingTime(reading.measured_at, isMounted)}?`,
    );
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
      const measuredPeriod = getDefaultBloodPressurePeriod();
      const automaticTagId = await resolveMeasurementTagId(
        supabase,
        getAutomaticMeasurementTagName(measuredPeriod),
      );
      const { data, error } = await supabase
        .from("blood_pressure_readings")
        .insert({
          systolic: Number(systolic),
          diastolic: Number(diastolic),
          measured_at: getBloodPressureMeasuredAt(measuredDay, measuredPeriod),
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const tagIds = Array.from(new Set([...selectedTagIds, automaticTagId]));
        const assignmentRows = tagIds.map((tagId) => ({
          measurement_id: data.id,
          tag_id: tagId,
        }));

        const { error: assignmentsError } = await supabase
          .from("measurement_tag_assignments")
          .insert(assignmentRows);

        if (assignmentsError) {
          throw assignmentsError;
        }
      }
      setStatus("Measurement saved.");
      setSystolic("");
      setDiastolic("");
      setMeasuredDay(toDateInputValue(new Date()));
      setSelectedTagIds([]);
      setIsTagDraftOpen(false);
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
      <div className="dashboard-top">
        <header className="page-hero" id="latest">
          <div className="page-hero-stats" aria-label="Latest and average blood pressure">
            <div className={`hero-stat${latestReading ? "" : " hero-stat-placeholder"}`}>
              <span className="hero-stat-label">Latest</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">{latestSystolic}</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">{latestDiastolic}</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
              <span className="hero-stat-footnote" suppressHydrationWarning>
                {latestReading ? formatReadingTime(latestReading.measured_at, isMounted) : "No latest reading"}
              </span>
            </div>

            <div className={`hero-stat${averageReading ? "" : " hero-stat-placeholder"}`}>
              <span className="hero-stat-label">Average</span>
              <strong className="hero-stat-value">
                <span className="bp-systolic">{averageSystolic}</span>
                <span className="bp-separator">/</span>
                <span className="bp-diastolic">{averageDiastolic}</span>
              </strong>
              <span className="hero-stat-unit">mmHg</span>
              <span className="hero-stat-footnote" suppressHydrationWarning>
                Based on {rangeReadings.length} readings
              </span>
            </div>
          </div>
          {!latestReading ? <p className="page-hero-note">No readings yet.</p> : null}
        </header>

        <section className="page-section" id="chart">
          {isLoading ? (
            <p className="status">Loading chart...</p>
          ) : (
          <BloodPressureChart
            readings={filteredChronologicalReadings}
            timeRange={chartRange}
            onTimeRangeChange={setChartRange}
            preferRelativeDates={isMounted}
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
      </div>

      <details className="page-section tag-filter-panel">
        <summary>
          <span>Tags</span>
          <span className="history-count">{filteredTagLabel}</span>
        </summary>
        <p className="tag-help">
          Filter the chart and history by one or more tags. Measurements must match every selected tag.
        </p>
        <div className="chip-row tag-filter-row" aria-label="Measurement tag filters">
          {measurementTags.length === 0 ? (
            <p className="status tag-empty">No tags yet. Add a measurement tag to start filtering.</p>
          ) : (
            <>
              <button
                className={`chip chip-filter${selectedFilterTagIds.length === 0 ? " chip-active" : ""}`}
                type="button"
                aria-pressed={selectedFilterTagIds.length === 0}
                onClick={() => setSelectedFilterTagIds([])}
              >
                All
              </button>
              {measurementTags.map((tag) => (
                <ChipButton
                  key={tag.id}
                  active={selectedFilterTagIds.includes(tag.id)}
                  className={`chip-filter${isAutomaticMeasurementTagName(tag.name) ? " chip-filter-automatic" : ""}`}
                  onClick={() =>
                    setSelectedFilterTagIds((current) =>
                      current.includes(tag.id)
                        ? current.filter((currentTagId) => currentTagId !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                >
                  <span className="chip-label">{tag.name}</span>
                  <span className="chip-count-badge">{measurementTagCountsById[tag.id] ?? 0}</span>
                </ChipButton>
              ))}
            </>
          )}
        </div>
      </details>

      <details className="page-section history-panel" id="history">
        <summary>
          <span>Recent readings</span>
          <span className="history-count">{filteredChronologicalReadings.length}</span>
        </summary>
        {isLoading ? (
          <p className="status history-copy">Loading readings...</p>
        ) : filteredChronologicalReadings.length === 0 ? (
          <p className="status history-copy">
            {selectedFilterTagIds.length === 0 ? "No readings yet." : "No readings match the selected tags."}
          </p>
        ) : (
          <ul className="history-list">
            {recentReadings.map((reading) => {
              const readingTags = measurementTagsByReadingId[reading.id] ?? [];

              return (
                <li key={reading.id} className="history-item">
                  <div className="history-content">
                    <div className="history-top">
                      <strong>{formatReadingLabel(reading)}</strong>
                      <div className="history-actions">
                        <span className="history-date" suppressHydrationWarning>
                          {formatReadingTime(reading.measured_at, isMounted)}
                        </span>
                        <button
                          className="history-delete"
                          type="button"
                          aria-label={`Delete ${formatReadingLabel(reading)} from ${formatReadingTime(reading.measured_at, isMounted)}`}
                          onClick={() => void handleDelete(reading)}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                            <path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V4h3.25a.75.75 0 0 1 0 1.5h-.57l-.77 11.07A2.25 2.25 0 0 1 14.66 18H9.34a2.25 2.25 0 0 1-2.25-2.43L6.32 5.5h-.57a.75.75 0 0 1 0-1.5H9v-.25Zm1.5.25v.25h3v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Zm-1.82 1.5.7 10.07c.02.38.34.68.72.68h5.4c.38 0 .7-.3.72-.68l.7-10.07H8.68Zm1.57 2.25a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75Z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="history-chips">
                      {readingTags.map((tag) => (
                        <span key={tag.id} className="history-chip">
                          <span className="chip-label">{tag.name}</span>
                          <span className="chip-count-badge">{measurementTagCountsById[tag.id] ?? 0}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
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
        measurementTags={measurementTags}
        selectedTagIds={selectedTagIds}
        tagDraft={tagDraft}
        setTagDraft={setTagDraft}
        isTagDraftOpen={isTagDraftOpen}
        setIsTagDraftOpen={setIsTagDraftOpen}
        tagStatus={tagStatus}
        onCreateTag={() => void handleCreateMeasurementTag()}
        onToggleTag={handleToggleMeasurementTag}
        onClose={closeAddModal}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
