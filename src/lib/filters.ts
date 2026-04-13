import type { FilterFn, FilterType, ColumnDef, NumberRange, DateRange } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts a `Date | string | undefined` to a UTC day timestamp, or `NaN`. */
function toUTCDay(v: Date | string | undefined | null): number {
	if (v === undefined || v === null || v === '') return NaN;
	const d = v instanceof Date ? v : new Date(String(v));
	if (isNaN(d.getTime())) return NaN;
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// ---------------------------------------------------------------------------
// Built-in filter functions
// ---------------------------------------------------------------------------

/**
 * Case-insensitive string containment filter.
 *
 * Converts both the cell value and the filter value to strings before
 * comparing. An empty string, `null`, or `undefined` filter value passes
 * all rows (no-op).
 *
 * @example
 * ```ts
 * textFilter('Hello World', 'world') // true
 * textFilter('Hello World', 'xyz')   // false
 * textFilter('Hello World', '')      // true  (no filter)
 * ```
 */
export const textFilter: FilterFn = (cellValue, filterValue): boolean => {
	if (filterValue === undefined || filterValue === null || filterValue === '') return true;
	return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
};

/**
 * Inclusive min/max range filter for numeric columns.
 *
 * Accepts a {@link NumberRange} object with optional `min` and `max` bounds.
 * A row passes when its cell value falls within `[min, max]` (both inclusive).
 * Omitting a bound leaves that side open-ended.
 *
 * Both the cell value and each bound are coerced with `Number()` before
 * comparison. A `NaN` result on the cell side excludes the row; a `NaN`
 * bound is ignored (treated as not set). A `null`, `undefined`, or empty
 * range object passes all rows.
 *
 * @example
 * ```ts
 * numberFilter(25, { min: 20, max: 30 })  // true  (20 ≤ 25 ≤ 30)
 * numberFilter(25, { min: 20 })            // true  (25 ≥ 20)
 * numberFilter(25, { max: 20 })            // false (25 > 20)
 * numberFilter(25, {})                     // true  (no bounds set)
 * numberFilter(25, undefined)              // true  (no filter)
 * ```
 */
export const numberFilter: FilterFn = (cellValue, filterValue): boolean => {
	if (filterValue === undefined || filterValue === null) return true;

	const range = filterValue as NumberRange;
	const hasMin = range.min !== undefined && range.min !== null && !isNaN(Number(range.min));
	const hasMax = range.max !== undefined && range.max !== null && !isNaN(Number(range.max));

	if (!hasMin && !hasMax) return true;

	const num = Number(cellValue);
	if (isNaN(num)) return false;

	if (hasMin && num < Number(range.min)) return false;
	if (hasMax && num > Number(range.max)) return false;
	return true;
};

/**
 * Inclusive date range filter for date columns.
 *
 * Accepts a {@link DateRange} object with optional `min` and `max` bounds.
 * A row passes when its cell date falls within `[min, max]` (both inclusive,
 * compared at day granularity in UTC). Omitting a bound leaves that side
 * open-ended.
 *
 * Each bound can be a `Date` object or an ISO date string (e.g. `"2024-01-15"`
 * from `<input type="date">`). The cell value can be a `Date` or a value
 * coercible to `Date`.
 *
 * An invalid or missing bound is ignored. A `null`, `undefined`, or empty
 * range object passes all rows.
 *
 * @example
 * ```ts
 * dateFilter(new Date('2024-03-10'), { min: '2024-01-01', max: '2024-12-31' })  // true
 * dateFilter(new Date('2024-03-10'), { min: '2024-06-01' })                     // false (before min)
 * dateFilter(new Date('2024-03-10'), { max: '2024-06-01' })                     // true  (before max)
 * dateFilter(new Date('2024-03-10'), {})                                        // true  (no bounds)
 * dateFilter(new Date('2024-03-10'), undefined)                                 // true  (no filter)
 * ```
 */
export const dateFilter: FilterFn = (cellValue, filterValue): boolean => {
	if (filterValue === undefined || filterValue === null) return true;

	const range = filterValue as DateRange;
	const minDay = toUTCDay(range.min);
	const maxDay = toUTCDay(range.max);
	const hasMin = !isNaN(minDay);
	const hasMax = !isNaN(maxDay);

	if (!hasMin && !hasMax) return true;

	const cellDay = toUTCDay(cellValue instanceof Date ? cellValue : new Date(String(cellValue)));
	if (isNaN(cellDay)) return false;

	if (hasMin && cellDay < minDay) return false;
	if (hasMax && cellDay > maxDay) return false;
	return true;
};

// ---------------------------------------------------------------------------
// Filter resolution
// ---------------------------------------------------------------------------

/** Maps each built-in filter type to its implementation. */
const BUILT_IN_FILTERS: Record<FilterType, FilterFn> = {
	text: textFilter,
	number: numberFilter,
	date: dateFilter
};

/**
 * Resolves the effective filter function for a column definition.
 *
 * Priority order:
 * 1. `def.filterFn` — custom function provided by the caller.
 * 2. `BUILT_IN_FILTERS[def.filterType]` — built-in function for the specified type.
 * 3. `textFilter` — fallback when neither is specified.
 *
 * Called once at `ColumnState` construction time so every column always has
 * a fully-resolved `filterFn` with no runtime branching.
 *
 * @param def - Column definition (or subset of it) containing `filterFn` and `filterType`.
 * @returns The resolved {@link FilterFn} for this column.
 */
export function resolveFilterFn(
	def: Pick<ColumnDef<unknown>, 'filterFn' | 'filterType'>
): FilterFn {
	if (def.filterFn) return def.filterFn;
	return BUILT_IN_FILTERS[def.filterType ?? 'text'];
}
