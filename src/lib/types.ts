/**
 * Sort direction values aligned with the `aria-sort` attribute vocabulary.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-sort
 */
export type SortDirection = 'ascending' | 'descending';

/**
 * Built-in filter strategies with pre-built filter functions.
 *
 * - `'text'`   — case-insensitive string containment
 * - `'number'` — numeric `>=` comparison (show rows ≥ the filter value)
 * - `'date'`   — date "on or after" comparison (show rows on or after the filter date)
 *
 * All three accept a plain `string | number | undefined` filter value and
 * can be used directly with `bind:value` on a Svelte input element.
 * For range filtering or custom logic, supply a `filterFn` instead.
 */
export type FilterType = 'text' | 'number' | 'date';

/**
 * A function that decides whether a row's cell value passes a column filter.
 *
 * Return `true` to include the row, `false` to exclude it.
 *
 * @param cellValue   - The value produced by the column's accessor for this row.
 * @param filterValue - The current filter value set on the column.
 */
export type FilterFn = (cellValue: unknown, filterValue: unknown) => boolean;

/**
 * A comparator for sorting two raw row objects by a column's values.
 *
 * Follow the same contract as `Array.prototype.sort`:
 * return negative to place `a` before `b`, positive to place `b` before `a`, `0` for equal.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export type SortFn<TRow> = (a: TRow, b: TRow) => number;

/**
 * Definition for a single table column.
 * Pass an array of these to the `TableState` constructor.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export interface ColumnDef<TRow> {
	/** Unique identifier for this column. Used as a stable key. */
	id: string;

	/** Display label shown in the column header. */
	header: string;

	/** Extracts the cell value from a row data object. */
	accessor: (row: TRow) => unknown;

	/**
	 * Whether this column supports sorting.
	 * @default false
	 */
	sortable?: boolean;

	/**
	 * Custom sort comparator. Receives two raw row objects.
	 * If omitted and `sortable` is `true`, a default comparator is applied
	 * based on the accessor values (lexicographic for strings, numeric for numbers).
	 */
	sortFn?: SortFn<TRow>;

	/**
	 * Whether this column supports filtering.
	 * @default false
	 */
	filterable?: boolean;

	/**
	 * Selects the built-in filter function when no custom `filterFn` is provided.
	 * @default 'text'
	 */
	filterType?: FilterType;

	/**
	 * Custom filter function. Overrides `filterType` when provided.
	 * Receives the cell value (accessor result) and the current `filterValue`.
	 */
	filterFn?: FilterFn;
}

/**
 * Options accepted by the `TableState` constructor.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export interface TableOptions<TRow> {
	/** The raw data array. Each element becomes a {@link RowState}. */
	data: TRow[];

	/** Column definitions. Each element becomes a {@link ColumnState}. */
	columns: ColumnDef<TRow>[];

	/**
	 * Number of rows per page.
	 * @default 10
	 */
	pageSize?: number;
}
