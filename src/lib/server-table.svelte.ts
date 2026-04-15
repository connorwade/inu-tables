import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { BaseTableState } from './base-table.svelte.js';
import { ColumnState } from './column.svelte.js';
import { RowState } from './row.svelte.js';
import { CellState } from './cell.svelte.js';
import type { ServerTableOptions, ServerTableParams, ServerTableResult } from './server-types.js';

/**
 * The central mediator for server-driven table state.
 *
 * `ServerTableState` holds the same sort, filter, and pagination state as
 * {@link TableState} (via {@link BaseTableState}) but delegates all data
 * operations to a server-side fetch function. Whenever `pageIndex`,
 * `pageSize`, `sortBy`, any column `filter.value`, or `searchQuery` changes,
 * a new request is fired automatically and the result replaces the current
 * page of rows.
 *
 * **Architecture**
 *
 * - Column definitions and filter state live on {@link ColumnState}, same as
 *   `TableState`. Users can `bind:value={(col.filter as TextColumnFilter).value}` exactly as before.
 * - Sort, search, and pagination state live on {@link BaseTableState}.
 * - Row data (`rows`, `rowCount`) is replaced on every successful fetch.
 * - A generation counter prevents stale responses from overwriting newer data
 *   when state changes rapidly.
 *
 * **Derived pipeline** (server-side variant)
 * ```
 * [pageIndex, pageSize, sortBy, filters, search] → fetch() → rows (current page only)
 * ```
 * Filtering, sorting, and pagination are entirely the server's responsibility.
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * import { ServerTableState } from 'inu-tables'
 * import { getPersons } from './data.remote.ts'
 *
 * const table = new ServerTableState<Person>({
 *   columns: [
 *     { accessorKey: 'firstName', header: 'First Name', sortable: true, filterable: true },
 *     { accessorKey: 'age',       header: 'Age',        sortable: true, filterable: true, filterType: 'number' }
 *   ],
 *   fetch: getPersons,
 *   pageSize: 20
 * })
 * ```
 */
export class ServerTableState<TRow> extends BaseTableState<TRow> {
	// -------------------------------------------------------------------------
	// Static collections — built once at construction, never replaced
	// -------------------------------------------------------------------------

	/** All column instances, in definition order. */
	readonly columns: ColumnState<TRow>[];

	// -------------------------------------------------------------------------
	// Current-page data — replaced after every successful fetch
	// -------------------------------------------------------------------------

	/**
	 * Row instances for the current page.
	 *
	 * Replaced wholesale after each successful fetch. Selection state is
	 * therefore page-local; it resets whenever the page changes.
	 */
	rows = $state<RowState<TRow>[]>([]);

	/** O(1) lookup map used internally by `getCellsForRow`. Rebuilt with `rows`. */
	#cellsByRow = $state(new SvelteMap<RowState<TRow>, CellState<TRow>[]>());

	// -------------------------------------------------------------------------
	// Server-reported totals and async state
	// -------------------------------------------------------------------------

	/**
	 * Total number of rows that match the current filters, as reported by the
	 * last successful server response. Used to derive `pageCount`.
	 */
	rowCount = $state(0);

	/**
	 * `true` while a fetch is in flight.
	 *
	 * Useful for showing a loading indicator in the table UI.
	 */
	loading = $state(false);

	/**
	 * The error thrown by the most recent failed fetch, or `null` if the last
	 * fetch succeeded (or no fetch has completed yet).
	 */
	error = $state<Error | null>(null);

	// -------------------------------------------------------------------------
	// Derived state
	// -------------------------------------------------------------------------

	/**
	 * Total number of pages given the current `rowCount` and `pageSize`.
	 * Always at least `1`, even when there are no matching rows.
	 */
	readonly pageCount = $derived(Math.max(1, Math.ceil(this.rowCount / this.pageSize)));

	/**
	 * Cells that belong to visible columns for the rows on the current page,
	 * ordered row-first then column-first within each row.
	 */
	visibleCells = $derived.by(() => {
		const colSet = new SvelteSet(this.visibleColumns);
		return this.rows.flatMap((row) =>
			(this.#cellsByRow.get(row) ?? []).filter((cell) => colSet.has(cell.column))
		);
	});

	// -------------------------------------------------------------------------
	// Private — fetch machinery
	// -------------------------------------------------------------------------

	readonly #fetchFn: (params: ServerTableParams) => Promise<ServerTableResult<TRow>>;

	/**
	 * Monotonically-increasing counter incremented before every fetch.
	 * A response is discarded if its generation no longer matches `#generation`
	 * when it resolves, preventing stale data from overwriting newer results.
	 */
	#generation = 0;

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor(options: ServerTableOptions<TRow>) {
		super();
		this.columns = options.columns.map((def) => new ColumnState(def));
		this.pageSize = options.pageSize ?? 10;
		this.#fetchFn = options.fetch;

		// Re-fetch whenever any piece of table state that the server needs changes.
		// The effect captures reads on pageIndex, pageSize, sortBy, and every
		// column's filter.value so Svelte can track all dependencies automatically.
		$effect(() => {
			const params: ServerTableParams = {
				pageIndex: this.pageIndex,
				pageSize: this.pageSize,
				sortBy: this.sortBy
					? { id: this.sortBy.column.id, direction: this.sortBy.direction }
					: null,
				filters: Object.fromEntries(
					this.columns.filter((c) => c.isFiltered).map((c) => [c.id, c.filter.value] as const)
				),
				search: this.searchQuery.trim() || undefined
			};

			this.#load(params);
		});
	}

	// -------------------------------------------------------------------------
	// Private — load
	// -------------------------------------------------------------------------

	/**
	 * Fires the user-supplied fetch function and applies the result to reactive
	 * state. Stale responses (from superseded state changes) are silently
	 * discarded via the generation counter.
	 */
	async #load(params: ServerTableParams): Promise<void> {
		const gen = ++this.#generation;
		this.loading = true;
		this.error = null;

		try {
			const result = await this.#fetchFn(params);

			// Discard if a newer fetch has already started
			if (gen !== this.#generation) return;

			const newRows = result.rows.map((data) => new RowState(data));
			const newCellsByRow = new SvelteMap<RowState<TRow>, CellState<TRow>[]>();

			for (const row of newRows) {
				newCellsByRow.set(
					row,
					this.columns.map((col) => new CellState(row, col))
				);
			}

			this.rows = newRows;
			this.#cellsByRow = newCellsByRow;
			this.rowCount = result.rowCount;
		} catch (e) {
			if (gen !== this.#generation) return;
			this.error = e instanceof Error ? e : new Error(String(e));
		} finally {
			if (gen === this.#generation) this.loading = false;
		}
	}

	// -------------------------------------------------------------------------
	// Filter actions (server-specific wrappers)
	// -------------------------------------------------------------------------

	/**
	 * Sets a column's filter value and resets `pageIndex` to `0`.
	 *
	 * Prefer this over setting `column.filter.value` directly when you want
	 * the page to reset automatically (which is almost always the right
	 * behaviour for server-side filtering).
	 *
	 * @param column - The column to filter.
	 * @param value  - The new filter value. Pass `undefined` to clear.
	 */
	setFilter(column: ColumnState<TRow>, value: unknown): void {
		column.filter.value = value;
		this.pageIndex = 0;
	}

	/**
	 * Sets the global search query and resets `pageIndex` to `0`.
	 *
	 * Prefer this over setting `searchQuery` directly so that the page resets
	 * automatically on every new search.
	 *
	 * @param query - The new search query. Pass `''` to clear.
	 */
	setSearch(query: string): void {
		this.searchQuery = query;
		this.pageIndex = 0;
	}

	// -------------------------------------------------------------------------
	// Cell helpers
	// -------------------------------------------------------------------------

	/**
	 * Returns all cells for the given row in column-definition order.
	 *
	 * O(1) — backed by an internal `Map` rebuilt after each page load.
	 *
	 * @param row - The row whose cells you want.
	 * @returns The cells for this row, or an empty array if the row is unknown.
	 */
	getCellsForRow(row: RowState<TRow>): CellState<TRow>[] {
		return this.#cellsByRow.get(row) ?? [];
	}
}
