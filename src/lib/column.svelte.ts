import { resolveFilterFn } from './filters.js';
import type {
	ColumnDef,
	ColumnDefWithFn,
	DateRange,
	FilterFn,
	FilterType,
	NumberRange,
	SortFn
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when a range filter object has at least one active bound.
 * An empty object or an object with all-undefined bounds counts as "no filter".
 *
 * @internal
 */
function hasActiveRangeValue(v: NumberRange | DateRange): boolean {
	const min = (v as { min?: unknown }).min;
	const max = (v as { max?: unknown }).max;
	return (
		(min !== undefined && min !== null && min !== '') ||
		(max !== undefined && max !== null && max !== '')
	);
}

/**
 * Represents a single table column.
 *
 * Each `ColumnState` instance owns the reactive state that belongs to the
 * column: its filter value and its visibility. Static configuration
 * (`id`, `header`, `accessor`, sort/filter options) is set once at
 * construction and never changes.
 *
 * Column filter state is intentionally kept here rather than on
 * `TableState` so that columns are self-contained and composable.
 * `TableState` reads `isFiltered` and `filterValue` to derive its
 * filtered-row views without duplicating state.
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * // Columns are created automatically by TableState — you rarely
 * // need to instantiate ColumnState directly.
 * const table = new TableState({
 *   data,
 *   columns: [
 *     // Key variant — id defaults to 'name'
 *     { accessorKey: 'name', header: 'Name', sortable: true, filterable: true },
 *     // Function variant — explicit id required
 *     { id: 'full', header: 'Full Name', accessorFn: (r) => `${r.first} ${r.last}` }
 *   ]
 * })
 *
 * // Access the live column state:
 * // Bind directly from a Svelte input:
 * // <input type="text" bind:value={table.columns[0].filterValue} />
 * ```
 */
export class ColumnState<TRow> {
	// -------------------------------------------------------------------------
	// Static configuration — set once at construction, never mutated
	// -------------------------------------------------------------------------

	/** Unique identifier for this column. */
	readonly id: string;

	/** Display label for the column header. */
	readonly header: string;

	/** Extracts the cell value from a row data object. */
	readonly accessor: (row: TRow) => unknown;

	/** Whether this column can be sorted via `TableState.toggleSort`. */
	readonly sortable: boolean;

	/**
	 * Custom sort comparator.
	 * `undefined` when `sortable` is `false` or no custom comparator was supplied.
	 */
	readonly sortFn: SortFn<TRow> | undefined;

	/** Whether this column can be filtered via `TableState.setFilter`. */
	readonly filterable: boolean;

	/**
	 * The effective filter strategy for this column.
	 *
	 * Always set — defaults to `'text'` when neither `filterType` nor a
	 * custom `filterFn` was provided. Useful for rendering the appropriate
	 * filter input in a table UI (e.g. a number input for `'number'` columns).
	 */
	readonly filterType: FilterType;

	/**
	 * The resolved filter function for this column.
	 *
	 * Populated from `def.filterFn` if provided, otherwise from the
	 * built-in function for `def.filterType ?? 'text'`. Always present
	 * regardless of whether `filterable` is `true`.
	 */
	readonly filterFn: FilterFn;

	/**
	 * Optional display formatter for this column's cells.
	 *
	 * When present, `CellState.displayValue` calls this function instead of
	 * falling back to `String(value)`. Receives the raw accessor value and
	 * the full row data object.
	 *
	 * Set via the `cell` property on the column definition.
	 */
	readonly cellFn: ((value: unknown, row: TRow) => string) | undefined;

	// -------------------------------------------------------------------------
	// Reactive state
	// -------------------------------------------------------------------------

	/**
	 * Whether this column is currently visible.
	 *
	 * Setting to `false` hides the column from `TableState.visibleColumns`
	 * and `TableState.visibleCells` without removing the column's data
	 * from filtered/sorted results.
	 *
	 * @default true
	 */
	show = $state(true);

	/**
	 * The current filter value for this column.
	 *
	 * The type depends on the column's `filterType`:
	 * - `'text'`   — use a `string`
	 * - `'number'` — use a {@link NumberRange} object (`{ min?, max? }`)
	 * - `'date'`   — use a {@link DateRange} object (`{ min?, max? }`)
	 *
	 * For custom `filterFn` columns, any value accepted by your function works.
	 * Setting to `undefined` clears the filter.
	 */
	filterValue = $state<string | NumberRange | DateRange | undefined>(undefined);

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	/**
	 * `true` when the column has an active filter that `TableState` should apply.
	 *
	 * Derived from `filterable` and the current `filterValue`.
	 * A `string` value of `''`, `null`, or `undefined` is treated as "no filter".
	 * A `NumberRange` or `DateRange` object is inactive when both bounds are
	 * `undefined` (i.e. `{}`).
	 */
	isFiltered = $derived.by(() => {
		if (!this.filterable) return false;
		const v = this.filterValue;
		if (v === undefined || v === null || v === '') return false;
		if (typeof v === 'object') return hasActiveRangeValue(v);
		return true;
	});

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor(def: ColumnDef<TRow>) {
		if (def.accessorKey !== undefined) {
			const key = def.accessorKey;
			this.id = def.id ?? key;
			this.accessor = (row) => row[key as keyof TRow];
		} else {
			const fnDef = def as ColumnDefWithFn<TRow>;
			this.id = fnDef.id;
			this.accessor = fnDef.accessorFn;
		}
		this.header = def.header;
		this.sortable = def.sortable ?? false;
		this.sortFn = def.sortFn;
		this.filterable = def.filterable ?? false;
		this.filterType = def.filterType ?? 'text';
		this.filterFn = resolveFilterFn(def);
		this.cellFn = def.cell;
	}
}
