import {
	ColumnFilter,
	TextColumnFilter,
	NumberColumnFilter,
	DateColumnFilter
} from './column-filters.svelte.js';
import type { ColumnDef, ColumnDefWithFn, SearchFn, SortFn } from './types.js';

// ---------------------------------------------------------------------------
// ColumnState
// ---------------------------------------------------------------------------

/**
 * Represents a single table column.
 *
 * Each `ColumnState` instance owns the reactive state that belongs to the
 * column: its filter and its visibility. Static configuration
 * (`id`, `header`, `accessor`, sort/filter options) is set once at
 * construction and never changes.
 *
 * Column filter state is intentionally kept here rather than on
 * `TableState` so that columns are self-contained and composable.
 * `TableState` reads `isFiltered` and `filter` to derive its
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
 * // Access the live filter state:
 * // Bind a text filter directly from a Svelte input:
 * // <input type="text" bind:value={(col.filter as TextColumnFilter).value} />
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
	 * The reactive filter instance for this column.
	 *
	 * The concrete type depends on how the column was defined:
	 * - `filterType: 'text'` (or no type/fn) → {@link TextColumnFilter}
	 * - `filterType: 'number'` → {@link NumberColumnFilter}
	 * - `filterType: 'date'`   → {@link DateColumnFilter}
	 * - custom `filterFn`       → base {@link ColumnFilter}
	 *
	 * Use `instanceof` to narrow to the specific subclass in UI code:
	 *
	 * ```svelte
	 * {#if col.filter instanceof NumberColumnFilter}
	 *   <input type="number" bind:value={col.filter.value!.min} />
	 * {:else}
	 *   <input type="text" bind:value={(col.filter as TextColumnFilter).value} />
	 * {/if}
	 * ```
	 *
	 * Call `col.filter.reset()` to restore the filter to its empty state.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filter!: ColumnFilter<any>;

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

	/**
	 * Whether this column participates in global search.
	 *
	 * When `false`, the column is excluded when `TableState.searchQuery` is
	 * evaluated. Defaults to `true`.
	 */
	readonly searchable: boolean;

	/**
	 * Custom search function for this column.
	 *
	 * When present, overrides the default case-insensitive substring match
	 * against `displayValue`. Receives the raw value, the formatted display
	 * string, the full row data, and the current trimmed query string.
	 *
	 * Set via the `searchFn` property on the column definition.
	 */
	readonly searchFn: SearchFn<TRow> | undefined;

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

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	/**
	 * `true` when the column has an active filter that `TableState` should apply.
	 *
	 * Derived from `filterable` and `filter.active`. The definition of "active"
	 * depends on the filter type:
	 * - {@link TextColumnFilter}: non-empty, non-null string
	 * - {@link NumberColumnFilter} / {@link DateColumnFilter}: at least one
	 *   valid bound set on the range object
	 * - base {@link ColumnFilter}: any non-`undefined` value
	 */
	isFiltered = $derived.by(() => {
		if (!this.filterable) return false;
		return this.filter.active;
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

		// Resolve the filter instance — priority: custom fn > filterType > default text
		if (def.filterFn) {
			this.filter = new ColumnFilter({ fn: def.filterFn });
		} else if (def.filterType === 'number') {
			this.filter = new NumberColumnFilter();
		} else if (def.filterType === 'date') {
			this.filter = new DateColumnFilter();
		} else {
			this.filter = new TextColumnFilter();
		}

		this.cellFn = def.cell;
		this.searchable = def.searchable ?? true;
		this.searchFn = def.searchFn;
	}
}
