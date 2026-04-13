import { resolveFilterFn } from './filters.js';
import type { ColumnDef, FilterFn, FilterType, SortFn } from './types.js';

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
 *     {
 *       id: 'name',
 *       header: 'Name',
 *       accessor: r => r.name,
 *       sortable: true,
 *       filterable: true,
 *       filterType: 'text'
 *     }
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
	 * Typed as `string | number | undefined` so it can be used directly with
	 * `bind:value` on a Svelte input:
	 *
	 * ```svelte
	 * <input type="text"   bind:value={col.filterValue} />
	 * <input type="number" bind:value={col.filterValue} />
	 * <input type="date"   bind:value={col.filterValue} />
	 * ```
	 *
	 * Setting to `undefined` or `''` clears the filter.
	 */
	filterValue = $state<string | number | undefined>(undefined);

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	/**
	 * `true` when the column has an active filter that `TableState` should apply.
	 *
	 * Derived from `filterable` and the current `filterValue`.
	 * A value of `''`, `null`, or `undefined` is treated as "no filter".
	 */
	isFiltered = $derived.by(
		() =>
			this.filterable &&
			this.filterValue !== undefined &&
			this.filterValue !== null &&
			this.filterValue !== ''
	);

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor(def: ColumnDef<TRow>) {
		this.id = def.id;
		this.header = def.header;
		this.accessor = def.accessor;
		this.sortable = def.sortable ?? false;
		this.sortFn = def.sortFn;
		this.filterable = def.filterable ?? false;
		this.filterType = def.filterType ?? 'text';
		this.filterFn = resolveFilterFn(def);
	}
}
