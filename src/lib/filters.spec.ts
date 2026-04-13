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
// numberFilter
// ---------------------------------------------------------------------------

describe('numberFilter', () => {
	it('returns true when cell value equals the threshold', () => {
		expect(numberFilter(25, 25)).toBe(true);
	});

	it('returns true when cell value is above the threshold', () => {
		expect(numberFilter(30, 25)).toBe(true);
	});

	it('returns false when cell value is below the threshold', () => {
		expect(numberFilter(20, 25)).toBe(false);
	});

	it('accepts a string filter value and parses it as a number', () => {
		expect(numberFilter(30, '25')).toBe(true);
		expect(numberFilter(20, '25')).toBe(false);
	});

	it('passes all rows when filter value is an empty string', () => {
		expect(numberFilter(25, '')).toBe(true);
	});

	it('passes all rows when filter value is null', () => {
		expect(numberFilter(25, null)).toBe(true);
	});

	it('passes all rows when filter value is undefined', () => {
		expect(numberFilter(25, undefined)).toBe(true);
	});

	it('passes all rows when filter value is not a valid number', () => {
		expect(numberFilter(25, 'abc')).toBe(true);
	});

	it('coerces string cell values to numbers', () => {
		expect(numberFilter('30', 25)).toBe(true);
		expect(numberFilter('20', 25)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// dateFilter
// ---------------------------------------------------------------------------

describe('dateFilter', () => {
	const jan15 = new Date('2024-01-15');
	const mar10 = new Date('2024-03-10');
	const dec31 = new Date('2023-12-31');

	it('returns true when cell date is on the same day as the filter date', () => {
		expect(dateFilter(new Date('2024-01-15'), jan15)).toBe(true);
	});

	it('returns true when cell date is after the filter date', () => {
		expect(dateFilter(mar10, jan15)).toBe(true);
	});

	it('returns false when cell date is before the filter date', () => {
		expect(dateFilter(dec31, jan15)).toBe(false);
	});

	it('accepts an ISO date string as the filter value', () => {
		expect(dateFilter(mar10, '2024-01-01')).toBe(true);
		expect(dateFilter(dec31, '2024-01-01')).toBe(false);
	});

	it('passes all rows when filter value is an empty string', () => {
		expect(dateFilter(jan15, '')).toBe(true);
	});

	it('passes all rows when filter value is null', () => {
		expect(dateFilter(jan15, null)).toBe(true);
	});

	it('passes all rows when filter value is undefined', () => {
		expect(dateFilter(jan15, undefined)).toBe(true);
	});

	it('passes all rows when filter value is an invalid date string', () => {
		expect(dateFilter(jan15, 'not-a-date')).toBe(true);
	});

	it('coerces ISO string cell values to Date', () => {
		expect(dateFilter('2024-03-10', jan15)).toBe(true);
		expect(dateFilter('2023-12-31', jan15)).toBe(false);
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
