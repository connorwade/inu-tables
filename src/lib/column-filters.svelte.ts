import { SvelteDate } from 'svelte/reactivity';
import type { FilterFn } from './types.ts';

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
// Base class
// ---------------------------------------------------------------------------

/**
 * Reactive wrapper around a column's filter logic.
 *
 * The base class is fully generic — supply `TFilterValue` to get a typed
 * `value` property. The three built-in subclasses ({@link TextColumnFilter},
 * {@link NumberColumnFilter}, {@link DateColumnFilter}) are pre-configured
 * with the matching filter function and `active` logic.
 *
 * @typeParam TFilterValue - The type of the filter value held by this filter.
 *
 * @example
 * ```ts
 * // Wrap a custom function in a base ColumnFilter:
 * const myFilter = new ColumnFilter({ fn: (cell, val) => cell === val })
 * myFilter.value = 'exact-match'
 * ```
 */
export class ColumnFilter<TFilterValue = unknown> {
	value: TFilterValue | undefined = $state(undefined);

	/**
	 * `true` when this filter has an active value that should be applied.
	 *
	 * The base implementation returns `true` whenever `value` is not
	 * `undefined`. Subclasses override this to provide type-specific logic
	 * (e.g. {@link NumberColumnFilter} treats `{ min: undefined, max: undefined }`
	 * as inactive even though `value` is defined).
	 */
	active = $derived.by(() => this.value !== undefined);

	fn: FilterFn;
	reset: () => void;

	constructor({
		fn,
		reset,
		initialValue
	}: {
		fn: FilterFn;
		reset?: () => void;
		initialValue?: TFilterValue;
	}) {
		this.fn = fn;
		if (!reset) {
			this.reset = () => (this.value = undefined);
		} else {
			this.reset = reset;
		}
		if (initialValue !== undefined) {
			this.value = initialValue;
		}
	}
}

// ---------------------------------------------------------------------------
// Built-in subclasses
// ---------------------------------------------------------------------------

/**
 * Case-insensitive string containment filter.
 *
 * A `string` filter value is active when it is non-empty. The filter function
 * converts both the cell value and the filter value to strings before
 * comparing, and is a no-op (passes all rows) when the value is
 * `undefined`, `null`, or `''`.
 *
 * @example
 * ```ts
 * const f = new TextColumnFilter()
 * f.value = 'ali'  // rows whose cell contains "ali" (case-insensitive) pass
 * f.reset()        // clears back to undefined
 * ```
 */
export class TextColumnFilter extends ColumnFilter<string> {
	active = $derived.by(() => this.value !== undefined && this.value !== null && this.value !== '');

	constructor() {
		super({
			fn: (cellValue, filterValue) => {
				if (filterValue === undefined || filterValue === null || filterValue === '') return true;
				return String(cellValue).toLowerCase().includes(String(filterValue).toLowerCase());
			},
			reset: () => (this.value = undefined)
		});
	}
}

/**
 * Inclusive min/max range filter for numeric columns.
 *
 * The filter value is a `{ min?, max? }` object. A bound is active only when
 * it is a finite number (not `undefined`, not `null`, not `NaN`). Both the
 * cell value and each bound are coerced with `Number()` before comparison,
 * so string cell values like `'30'` are handled correctly.
 *
 * The filter is considered **inactive** (`active === false`) when neither
 * bound is set, even though `value` is always a `{ min, max }` object.
 *
 * @example
 * ```ts
 * const f = new NumberColumnFilter()
 * f.value = { min: 18, max: 65 }  // rows where 18 ≤ cell ≤ 65 pass
 * f.reset()                        // resets to { min: undefined, max: undefined }
 * ```
 */
export class NumberColumnFilter extends ColumnFilter<{ min?: number; max?: number }> {
	active = $derived.by(() => {
		const v = this.value;
		if (!v) return false;
		return (
			(v.min !== undefined && v.min !== null && !isNaN(Number(v.min))) ||
			(v.max !== undefined && v.max !== null && !isNaN(Number(v.max)))
		);
	});

	constructor() {
		super({
			fn: (cellValue, filterValue) => {
				if (filterValue === undefined || filterValue === null) return true;
				const range = filterValue as { min?: number; max?: number };
				const hasMin = range.min !== undefined && range.min !== null && !isNaN(Number(range.min));
				const hasMax = range.max !== undefined && range.max !== null && !isNaN(Number(range.max));
				if (!hasMin && !hasMax) return true;
				const num = Number(cellValue);
				if (isNaN(num)) return false;
				if (hasMin && num < Number(range.min)) return false;
				if (hasMax && num > Number(range.max)) return false;
				return true;
			},
			reset: () => (this.value = { min: undefined, max: undefined }),
			initialValue: { min: undefined, max: undefined }
		});
	}
}

/**
 * Inclusive date range filter for date columns.
 *
 * The filter value is a `{ min?, max? }` object where each bound can be a
 * `Date` or an ISO date string (e.g. `"2024-01-15"` from `<input type="date">`).
 * Cell values can also be `Date` objects or ISO strings — both are normalised
 * to UTC day timestamps before comparison so that time-of-day differences
 * are ignored.
 *
 * The filter is considered **inactive** when neither bound resolves to a valid
 * date, even though `value` is always a `{ min, max }` object.
 *
 * @example
 * ```ts
 * const f = new DateColumnFilter()
 * f.value = { min: '2024-01-01', max: '2024-12-31' }  // rows within 2024 pass
 * f.reset()                                             // resets to { min: undefined, max: undefined }
 * ```
 */
export class DateColumnFilter extends ColumnFilter<{ min?: Date | string; max?: Date | string }> {
	active = $derived.by(() => {
		const v = this.value;
		if (!v) return false;
		return !isNaN(toUTCDay(v.min)) || !isNaN(toUTCDay(v.max));
	});

	constructor() {
		super({
			fn: (cellValue, filterValue) => {
				if (filterValue === undefined || filterValue === null) return true;
				const range = filterValue as { min?: Date | string; max?: Date | string };
				const minDay = toUTCDay(range.min);
				const maxDay = toUTCDay(range.max);
				const hasMin = !isNaN(minDay);
				const hasMax = !isNaN(maxDay);
				if (!hasMin && !hasMax) return true;
				const rawCell = cellValue instanceof Date ? cellValue : new SvelteDate(String(cellValue));
				const cellDay = toUTCDay(rawCell);
				if (isNaN(cellDay)) return false;
				if (hasMin && cellDay < minDay) return false;
				if (hasMax && cellDay > maxDay) return false;
				return true;
			},
			reset: () => (this.value = { min: undefined, max: undefined }),
			initialValue: { min: undefined, max: undefined }
		});
	}
}
