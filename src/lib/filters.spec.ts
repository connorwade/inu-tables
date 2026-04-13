import { describe, it, expect } from 'vitest';
import { textFilter, numberFilter, dateFilter, resolveFilterFn } from './filters.js';

// ---------------------------------------------------------------------------
// textFilter
// ---------------------------------------------------------------------------

describe('textFilter', () => {
	it('matches when the cell value contains the filter string', () => {
		expect(textFilter('Hello World', 'World')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(textFilter('Hello World', 'world')).toBe(true);
		expect(textFilter('hello world', 'HELLO')).toBe(true);
	});

	it('returns false when the value does not contain the filter string', () => {
		expect(textFilter('Hello World', 'xyz')).toBe(false);
	});

	it('passes all rows when filter value is an empty string', () => {
		expect(textFilter('Hello World', '')).toBe(true);
	});

	it('passes all rows when filter value is null', () => {
		expect(textFilter('Hello World', null)).toBe(true);
	});

	it('passes all rows when filter value is undefined', () => {
		expect(textFilter('Hello World', undefined)).toBe(true);
	});

	it('coerces non-string cell values to strings', () => {
		expect(textFilter(42, '4')).toBe(true);
		expect(textFilter(true, 'tru')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// numberFilter — range API
// ---------------------------------------------------------------------------

describe('numberFilter', () => {
	// --- both bounds ---
	it('passes when value is within min and max (inclusive)', () => {
		expect(numberFilter(25, { min: 20, max: 30 })).toBe(true);
	});

	it('passes when value equals min', () => {
		expect(numberFilter(20, { min: 20, max: 30 })).toBe(true);
	});

	it('passes when value equals max', () => {
		expect(numberFilter(30, { min: 20, max: 30 })).toBe(true);
	});

	it('fails when value is below min', () => {
		expect(numberFilter(10, { min: 20, max: 30 })).toBe(false);
	});

	it('fails when value is above max', () => {
		expect(numberFilter(40, { min: 20, max: 30 })).toBe(false);
	});

	// --- min only ---
	it('passes when value is at or above min (no max)', () => {
		expect(numberFilter(25, { min: 20 })).toBe(true);
		expect(numberFilter(20, { min: 20 })).toBe(true);
	});

	it('fails when value is below min (no max)', () => {
		expect(numberFilter(10, { min: 20 })).toBe(false);
	});

	// --- max only ---
	it('passes when value is at or below max (no min)', () => {
		expect(numberFilter(15, { max: 20 })).toBe(true);
		expect(numberFilter(20, { max: 20 })).toBe(true);
	});

	it('fails when value is above max (no min)', () => {
		expect(numberFilter(25, { max: 20 })).toBe(false);
	});

	// --- empty / no-op ---
	it('passes all rows when range object is empty ({})', () => {
		expect(numberFilter(25, {})).toBe(true);
	});

	it('passes all rows when filter value is null', () => {
		expect(numberFilter(25, null)).toBe(true);
	});

	it('passes all rows when filter value is undefined', () => {
		expect(numberFilter(25, undefined)).toBe(true);
	});

	// --- NaN / invalid ---
	it('excludes row when cell value is not a number', () => {
		expect(numberFilter('abc', { min: 10 })).toBe(false);
	});

	it('ignores a bound that is NaN', () => {
		expect(numberFilter(25, { min: NaN, max: 30 })).toBe(true);
		expect(numberFilter(25, { min: 20, max: NaN })).toBe(true);
	});

	// --- string cell coercion ---
	it('coerces string cell values to numbers', () => {
		expect(numberFilter('30', { min: 25 })).toBe(true);
		expect(numberFilter('20', { min: 25 })).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// dateFilter — range API
// ---------------------------------------------------------------------------

describe('dateFilter', () => {
	const jan15 = new Date('2024-01-15');
	const mar10 = new Date('2024-03-10');
	const jun01 = new Date('2024-06-01');
	const dec31 = new Date('2023-12-31');

	// --- both bounds ---
	it('passes when cell date is within the range (inclusive)', () => {
		expect(dateFilter(mar10, { min: jan15, max: jun01 })).toBe(true);
	});

	it('passes when cell date equals the min bound', () => {
		expect(dateFilter(jan15, { min: jan15, max: jun01 })).toBe(true);
	});

	it('passes when cell date equals the max bound', () => {
		expect(dateFilter(jun01, { min: jan15, max: jun01 })).toBe(true);
	});

	it('fails when cell date is before min', () => {
		expect(dateFilter(dec31, { min: jan15, max: jun01 })).toBe(false);
	});

	it('fails when cell date is after max', () => {
		expect(dateFilter(new Date('2025-01-01'), { min: jan15, max: jun01 })).toBe(false);
	});

	// --- min only ---
	it('passes when cell date is on or after min (no max)', () => {
		expect(dateFilter(mar10, { min: jan15 })).toBe(true);
		expect(dateFilter(jan15, { min: jan15 })).toBe(true);
	});

	it('fails when cell date is before min (no max)', () => {
		expect(dateFilter(dec31, { min: jan15 })).toBe(false);
	});

	// --- max only ---
	it('passes when cell date is on or before max (no min)', () => {
		expect(dateFilter(jan15, { max: jun01 })).toBe(true);
		expect(dateFilter(jun01, { max: jun01 })).toBe(true);
	});

	it('fails when cell date is after max (no min)', () => {
		expect(dateFilter(new Date('2025-01-01'), { max: jun01 })).toBe(false);
	});

	// --- ISO string bounds ---
	it('accepts ISO date strings as bounds', () => {
		expect(dateFilter(mar10, { min: '2024-01-01', max: '2024-12-31' })).toBe(true);
		expect(dateFilter(dec31, { min: '2024-01-01', max: '2024-12-31' })).toBe(false);
	});

	// --- ISO string cell value ---
	it('coerces ISO string cell values to Date', () => {
		expect(dateFilter('2024-03-10', { min: jan15 })).toBe(true);
		expect(dateFilter('2023-12-31', { min: jan15 })).toBe(false);
	});

	// --- empty / no-op ---
	it('passes all rows when range object is empty ({})', () => {
		expect(dateFilter(jan15, {})).toBe(true);
	});

	it('passes all rows when filter value is null', () => {
		expect(dateFilter(jan15, null)).toBe(true);
	});

	it('passes all rows when filter value is undefined', () => {
		expect(dateFilter(jan15, undefined)).toBe(true);
	});

	// --- invalid ---
	it('ignores a bound that is an invalid date string', () => {
		expect(dateFilter(mar10, { min: 'not-a-date', max: jun01 })).toBe(true);
	});

	it('excludes row when cell value is an invalid date', () => {
		expect(dateFilter('not-a-date', { min: jan15 })).toBe(false);
	});

	// --- day granularity ---
	it('treats dates with different times on the same day as equal (UTC day)', () => {
		const noon = new Date('2024-01-15T12:00:00Z');
		const evening = new Date('2024-01-15T23:59:59Z');
		expect(dateFilter(noon, { min: evening })).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// resolveFilterFn
// ---------------------------------------------------------------------------

describe('resolveFilterFn', () => {
	it('returns the custom filterFn when provided', () => {
		const custom = () => true;
		const resolved = resolveFilterFn({ filterFn: custom });
		expect(resolved).toBe(custom);
	});

	it('returns textFilter when filterType is "text"', () => {
		const resolved = resolveFilterFn({ filterType: 'text' });
		expect(resolved).toBe(textFilter);
	});

	it('returns numberFilter when filterType is "number"', () => {
		const resolved = resolveFilterFn({ filterType: 'number' });
		expect(resolved).toBe(numberFilter);
	});

	it('returns dateFilter when filterType is "date"', () => {
		const resolved = resolveFilterFn({ filterType: 'date' });
		expect(resolved).toBe(dateFilter);
	});

	it('defaults to textFilter when neither filterFn nor filterType is provided', () => {
		const resolved = resolveFilterFn({});
		expect(resolved).toBe(textFilter);
	});

	it('prefers custom filterFn over filterType', () => {
		const custom = () => false;
		const resolved = resolveFilterFn({ filterFn: custom, filterType: 'number' });
		expect(resolved).toBe(custom);
	});
});
