import type { ColumnDef, SortDirection } from './types.js';

/**
 * The parameters sent to the server on every table state change.
 *
 * Serialise these as query-string or JSON body — the exact transport is up
 * to the caller. When using SvelteKit remote functions the object is passed
 * directly as the function argument.
 */
export interface ServerTableParams {
	/** Zero-based index of the requested page. */
	pageIndex: number;

	/** Number of rows per page. */
	pageSize: number;

	/**
	 * Active sort column and direction, or `null` when unsorted.
	 *
	 * Uses the column `id` string rather than a `ColumnState` reference so
	 * it is safe to serialise and send over the wire.
	 */
	sortBy: { id: string; direction: SortDirection } | null;

	/**
	 * Active filter values keyed by column `id`.
	 *
	 * Only columns with a non-empty `filterValue` are included. The server is
	 * responsible for interpreting each value according to the column's type.
	 */
	filters: Record<string, string | number | undefined>;
}

/**
 * The object the server must return for each page request.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export interface ServerTableResult<TRow> {
	/** The rows for the requested page, already filtered and sorted. */
	rows: TRow[];

	/**
	 * Total number of rows that match the current filters (before pagination).
	 *
	 * Used to derive `pageCount` on the client:
	 * `pageCount = Math.ceil(rowCount / pageSize)`.
	 */
	rowCount: number;
}

/**
 * Options accepted by the `ServerTableState` constructor.
 *
 * @typeParam TRow - The shape of each row's data object.
 */
export interface ServerTableOptions<TRow> {
	/** Column definitions. Each element becomes a {@link ColumnState}. */
	columns: ColumnDef<TRow>[];

	/**
	 * Async function that fetches a page of data from the server.
	 *
	 * Called automatically whenever `pageIndex`, `pageSize`, `sortBy`, or any
	 * column `filterValue` changes. Pass a SvelteKit remote function directly
	 * or any `(params) => Promise<ServerTableResult<TRow>>` implementation.
	 *
	 * @example
	 * ```ts
	 * // SvelteKit remote function
	 * import { getPersons } from './data.remote.ts'
	 *
	 * const table = new ServerTableState({ columns, fetch: getPersons })
	 * ```
	 */
	fetch: (params: ServerTableParams) => Promise<ServerTableResult<TRow>>;

	/**
	 * Number of rows per page.
	 * @default 10
	 */
	pageSize?: number;
}
