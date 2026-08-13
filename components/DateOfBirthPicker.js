'use client';

import { useEffect, useMemo, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const daysInMonth = (year, month) => {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
};

const parseValue = (value) => {
  if (!value) return { day: '', month: '', year: '' };
  const [y, m, d] = value.split('-');
  return { year: y || '', month: m ? String(Number(m)) : '', day: d ? String(Number(d)) : '' };
};

// Three plain <select> dropdowns (Day / Month / Year) instead of the native
// <input type="date"> calendar — easier for picking a birth year decades
// back, and fully themeable.
//
// Keeps its own local {day, month, year} state rather than deriving it from
// the composed "YYYY-MM-DD" value alone: a date isn't valid (and so
// `onChange` reports '') until all three are picked, so deriving purely from
// the parent value would wipe out a partial selection (e.g. picking Day
// first, before Month/Year) on every render.
export default function DateOfBirthPicker({ value, onChange, idPrefix = 'dob' }) {
  const [local, setLocal] = useState(() => parseValue(value));

  // Stay in sync if the parent resets/sets the value from outside (e.g.
  // loading an existing profile, or a form reset) — harmless once local
  // state already matches, since parseValue(value) then equals `local`.
  useEffect(() => {
    setLocal(parseValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, i) => current - i);
  }, []);

  const days = useMemo(() => {
    const count = daysInMonth(local.year, local.month);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [local.year, local.month]);

  const update = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);

    if (next.day && next.month && next.year) {
      const maxDay = daysInMonth(next.year, next.month);
      const clampedDay = Math.min(Number(next.day), maxDay);
      const dd = String(clampedDay).padStart(2, '0');
      const mm = String(next.month).padStart(2, '0');
      onChange(`${next.year}-${mm}-${dd}`);
    } else {
      onChange('');
    }
  };

  return (
    <div className="dob-picker">
      <select
        id={`${idPrefix}-day`}
        aria-label="Day"
        value={local.day}
        onChange={(e) => update({ day: e.target.value })}
      >
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-month`}
        aria-label="Month"
        value={local.month}
        onChange={(e) => update({ month: e.target.value })}
      >
        <option value="">Month</option>
        {MONTHS.map((m, idx) => (
          <option key={m} value={idx + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-year`}
        aria-label="Year"
        value={local.year}
        onChange={(e) => update({ year: e.target.value })}
      >
        <option value="">Year</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
