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
 * Shared column options common to both column definition variants.
 *
 * @typeParam TRow - The shape of each row's data object.
 * @internal
 */
interface ColumnDefBase<TRow> {
	/** Display label shown in the column header. */
	header: string;

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
 * Column definition using a row key as the accessor.
 *
 * The column `id` defaults to `accessorKey` when not explicitly provided.
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * { accessorKey: 'name', header: 'Name', sortable: true }
 * // id is automatically 'name'
 *
 * { accessorKey: 'name', id: 'playerName', header: 'Player' }
 * // explicit id override
 * ```
 */
export interface ColumnDefWithKey<TRow> extends ColumnDefBase<TRow> {
	/**
	 * A key of the row object used to extract the cell value.
	 * Also serves as the column `id` unless `id` is explicitly provided.
	 */
	accessorKey: keyof TRow & string;

	/**
	 * Optional override for the column id.
	 * When omitted, `accessorKey` is used as the id.
	 */
	id?: string;

	accessorFn?: never;
}

/**
 * Column definition using a function as the accessor.
 *
 * Use this variant when the cell value cannot be expressed as a single key
 * (e.g. computed or combined fields). An explicit `id` is required.
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * {
 *   id: 'fullName',
 *   header: 'Full Name',
 *   accessorFn: (r) => `${r.firstName} ${r.lastName}`
 * }
 * ```
 */
export interface ColumnDefWithFn<TRow> extends ColumnDefBase<TRow> {
	/** Extracts the cell value from a row data object. */
	accessorFn: (row: TRow) => unknown;

	/** Unique identifier for this column. Required when using `accessorFn`. */
	id: string;

	accessorKey?: never;
}

/**
 * Definition for a single table column.
 * Pass an array of these to the `TableState` constructor.
 *
 * Two variants are supported:
 * - **Key variant** (`accessorKey`): provide a key of the row type; the id
 *   defaults to that key and the accessor is `row[accessorKey]`.
 * - **Function variant** (`accessorFn` + `id`): provide an explicit id and
 *   a function that extracts the cell value from a row.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export type ColumnDef<TRow> = ColumnDefWithKey<TRow> | ColumnDefWithFn<TRow>;

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
