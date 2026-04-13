import type { FilterFn, FilterType, ColumnDef } from './types.js';

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
 * Numeric greater-than-or-equal filter.
 *
 * Shows rows where the cell value is **greater than or equal to** the filter
 * value — the natural behaviour for a "minimum" number input.
 *
 * Both the cell value and the filter value are coerced with `Number()` before
 * comparison. A `NaN` result on either side passes the row (no filter applied).
 * `null`, `undefined`, or `''` filter values also pass all rows.
 *
 * Works directly with `bind:value` on `<input type="number">`:
 * ```svelte
 * <input type="number" bind:value={col.filterValue} />
 * ```
 *
 * @example
 * ```ts
 * numberFilter(25, 20)  // true  (25 >= 20)
 * numberFilter(25, 25)  // true  (25 >= 25)
 * numberFilter(25, 30)  // false (25 < 30)
 * numberFilter(25, '')  // true  (no filter)
 * ```
 */
export const numberFilter: FilterFn = (cellValue, filterValue): boolean => {
	if (filterValue === undefined || filterValue === null || filterValue === '') return true;
	const threshold = Number(filterValue);
	if (isNaN(threshold)) return true;
	const num = Number(cellValue);
	if (isNaN(num)) return false;
	return num >= threshold;
};

/**
 * Date "on or after" filter.
 *
 * Shows rows where the cell date is **on or after** the filter date —
 * the natural behaviour for a "from" date input.
 *
 * The filter value can be a `Date` object or an ISO date string (e.g.
 * `"2024-01-15"` from `<input type="date">`). The cell value can be a
 * `Date` or a value coercible to `Date` via `new Date(String(cellValue))`.
 *
 * Comparison is done at day granularity (midnight UTC of the filter date
 * vs midnight UTC of the cell date).
 *
 * Works directly with `bind:value` on `<input type="date">`:
 * ```svelte
 * <input type="date" bind:value={col.filterValue} />
 * ```
 *
 * @example
 * ```ts
 * dateFilter(new Date('2024-03-10'), '2024-01-01')  // true  (on or after)
 * dateFilter(new Date('2024-03-10'), '2024-03-10')  // true  (same day)
 * dateFilter(new Date('2024-03-10'), '2024-06-01')  // false (before)
 * dateFilter(new Date('2024-03-10'), '')             // true  (no filter)
 * ```
 */
export const dateFilter: FilterFn = (cellValue, filterValue): boolean => {
	if (filterValue === undefined || filterValue === null || filterValue === '') return true;
	const filterDate = filterValue instanceof Date ? filterValue : new Date(String(filterValue));
	if (isNaN(filterDate.getTime())) return true;
	const cellDate = cellValue instanceof Date ? cellValue : new Date(String(cellValue));
	if (isNaN(cellDate.getTime())) return false;
	// Compare at day granularity (strip time component)
	const filterDay = Date.UTC(
		filterDate.getUTCFullYear(),
		filterDate.getUTCMonth(),
		filterDate.getUTCDate()
	);
	const cellDay = Date.UTC(
		cellDate.getUTCFullYear(),
		cellDate.getUTCMonth(),
		cellDate.getUTCDate()
	);
	return cellDay >= filterDay;
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
