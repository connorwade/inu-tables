/**
 * Sort direction values aligned with the `aria-sort` attribute vocabulary.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-sort
 */
export type SortDirection = 'ascending' | 'descending';

/**
 * A min/max range used as the filter value for `'number'` columns.
 *
 * Either bound is optional — supply only `min`, only `max`, or both.
 * An object where both bounds are `undefined` is treated as "no filter".
 *
 * Used directly with the built-in {@link numberFilter}.
 *
 * @example
 * ```ts
 * col.filterValue = { min: 18, max: 65 }  // rows where 18 ≤ value ≤ 65
 * col.filterValue = { min: 18 }            // rows where value ≥ 18
 * col.filterValue = { max: 65 }            // rows where value ≤ 65
 * ```
 */
export interface NumberRange {
	/** Inclusive lower bound. Rows below this value are excluded. */
	min?: number;
	/** Inclusive upper bound. Rows above this value are excluded. */
	max?: number;
}

/**
 * A min/max range used as the filter value for `'date'` columns.
 *
 * Either bound is optional — supply only `min`, only `max`, or both.
 * An object where both bounds are `undefined` is treated as "no filter".
 *
 * Each bound can be a `Date` object or an ISO date string (e.g. `"2024-01-15"`
 * from `<input type="date">`). Comparison is done at day granularity (UTC).
 *
 * Used directly with the built-in {@link dateFilter}.
 *
 * @example
 * ```ts
 * col.filterValue = { min: '2024-01-01', max: '2024-12-31' }  // within 2024
 * col.filterValue = { min: new Date('2024-06-01') }            // on or after June 2024
 * ```
 */
export interface DateRange {
	/** Inclusive start date. Rows before this date are excluded. */
	min?: Date | string;
	/** Inclusive end date. Rows after this date are excluded. */
	max?: Date | string;
}

/**
 * Built-in filter strategies with pre-built filter functions.
 *
 * - `'text'`   — case-insensitive string containment; use {@link TextColumnFilter}
 * - `'number'` — inclusive min/max range; use {@link NumberColumnFilter}
 * - `'date'`   — inclusive date range at day granularity; use {@link DateColumnFilter}
 *
 * Provide this on a column definition to select the built-in filter class.
 * For fully custom logic, supply a `filterFn` instead.
 *
 * @internal
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
 * A function that decides whether a row matches the current global search query
 * for a specific column.
 *
 * When provided on a column definition, it overrides the default search
 * behaviour (which checks the column's `displayValue` for a case-insensitive
 * substring match).
 *
 * Return `true` to include the row, `false` to exclude it.
 *
 * @param value        - The raw value returned by the column's accessor for this row.
 * @param displayValue - The formatted display string (from `cell`, or `String(value)`).
 * @param row          - The full row data object.
 * @param query        - The current trimmed search query string (as typed by the user).
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * // Only match rows where the full name starts with the query
 * const searchFn: SearchFn<Person> = (_, display, _row, query) =>
 *   display.toLowerCase().startsWith(query.toLowerCase())
 * ```
 */
export type SearchFn<TRow> = (
	value: unknown,
	displayValue: string,
	row: TRow,
	query: string
) => boolean;

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

	/**
	 * Formats the cell value for display.
	 *
	 * When provided, `CellState.displayValue` uses this function instead of
	 * `String(value)`. Receives the raw accessor value and the full row data.
	 * Must return a plain string.
	 *
	 * @example
	 * ```ts
	 * // Format a numeric age field
	 * { accessorKey: 'age', header: 'Age', cell: (value) => `${value} yrs` }
	 *
	 * // Combine two fields
	 * { id: 'name', header: 'Name', accessorFn: (r) => r,
	 *   cell: (_, row) => `${row.firstName} ${row.lastName}` }
	 * ```
	 */
	cell?: (value: unknown, row: TRow) => string;

	/**
	 * Whether this column participates in global search.
	 *
	 * When `false`, the column is excluded from `TableState.searchQuery` matching.
	 * @default true
	 */
	searchable?: boolean;

	/**
	 * Custom search function for this column.
	 *
	 * When provided, overrides the default search behaviour (case-insensitive
	 * substring match against `displayValue`). Receives the raw accessor value,
	 * the formatted display string, the full row data, and the current query.
	 *
	 * @see {@link SearchFn}
	 *
	 * @example
	 * ```ts
	 * // Only match rows where the display value starts with the query
	 * { accessorKey: 'name', header: 'Name',
	 *   searchFn: (_, display, _row, query) =>
	 *     display.toLowerCase().startsWith(query.toLowerCase()) }
	 * ```
	 */
	searchFn?: SearchFn<TRow>;
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
