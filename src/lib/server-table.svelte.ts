import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { ColumnState } from './column.svelte.js';
import { RowState } from './row.svelte.js';
import { CellState } from './cell.svelte.js';
import type { DateRange, NumberRange, SortDirection } from './types.js';
import type { ServerTableOptions, ServerTableParams, ServerTableResult } from './server-types.js';

/**
 * The central mediator for server-driven table state.
 *
 * `ServerTableState` holds the same sort, filter, and pagination state as
 * {@link TableState} but delegates all data operations to a server-side
 * fetch function. Whenever `pageIndex`, `pageSize`, `sortBy`, or any column
 * `filterValue` changes, a new request is fired automatically and the result
 * replaces the current page of rows.
 *
 * **Architecture**
 *
 * - Column definitions and filter state live on {@link ColumnState}, same as
 *   `TableState`. Users can `bind:value={col.filterValue}` exactly as before.
 * - Sort and pagination state live here, same as `TableState`.
 * - Row data (`rows`, `rowCount`) is replaced on every successful fetch.
 * - A generation counter prevents stale responses from overwriting newer data
 *   when state changes rapidly.
 *
 * **Derived pipeline** (server-side variant)
 * ```
 * [pageIndex, pageSize, sortBy, filters] → fetch() → rows (current page only)
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
export class ServerTableState<TRow> {
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
	// Sort state
	// -------------------------------------------------------------------------

	/**
	 * The active sort column and direction, or `null` when unsorted.
	 *
	 * Use {@link toggleSort} to cycle through `ascending → descending → null`.
	 * Changing this value triggers a new server fetch.
	 */
	sortBy = $state<{ column: ColumnState<TRow>; direction: SortDirection } | null>(null);

	// -------------------------------------------------------------------------
	// Pagination state
	// -------------------------------------------------------------------------

	/**
	 * Zero-based index of the currently visible page.
	 *
	 * Changing this value triggers a new server fetch.
	 * Use {@link nextPage}, {@link prevPage}, and {@link setPage} to navigate
	 * safely within bounds. Reset to `0` automatically by {@link setFilter}
	 * and {@link clearFilters}.
	 */
	pageIndex = $state(0);

	/**
	 * Number of rows per page.
	 *
	 * Changing this value triggers a new server fetch.
	 * @default 10
	 */
	pageSize = $state(10);

	/**
	 * Total number of rows that match the current filters, as reported by the
	 * last successful server response. Used to derive `pageCount`.
	 */
	rowCount = $state(0);

	// -------------------------------------------------------------------------
	// Search state
	// -------------------------------------------------------------------------

	/**
	 * The current global search query string.
	 *
	 * Changing this value triggers a new server fetch with `search` included
	 * in `ServerTableParams`. Prefer {@link setSearch} over setting this
	 * directly so that `pageIndex` is reset automatically.
	 *
	 * Also cleared by {@link clearFilters}.
	 */
	searchQuery = $state('');

	// -------------------------------------------------------------------------
	// Async state
	// -------------------------------------------------------------------------

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
	pageCount = $derived(Math.max(1, Math.ceil(this.rowCount / this.pageSize)));

	/**
	 * Columns where `show` is `true`, in definition order.
	 */
	visibleColumns = $derived.by(() => this.columns.filter((c) => c.show));

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

	/**
	 * `true` when every row on the current page is selected.
	 * `false` when the current page is empty.
	 *
	 * Selection is page-local and resets when a new page is loaded.
	 */
	allSelected = $derived.by(() => this.rows.length > 0 && this.rows.every((r) => r.selected));

	/**
	 * `true` when at least one row on the current page is selected but not all.
	 *
	 * Maps to the `indeterminate` state of a "select all" checkbox.
	 */
	someSelected = $derived.by(
		() => this.rows.some((r) => r.selected) && !this.rows.every((r) => r.selected)
	);

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
		this.columns = options.columns.map((def) => new ColumnState(def));
		this.pageSize = options.pageSize ?? 10;
		this.#fetchFn = options.fetch;

		// Re-fetch whenever any piece of table state that the server needs changes.
		// The effect captures reads on pageIndex, pageSize, sortBy, and every
		// column's filterValue so Svelte can track all dependencies automatically.
		$effect(() => {
			const params: ServerTableParams = {
				pageIndex: this.pageIndex,
				pageSize: this.pageSize,
				sortBy: this.sortBy
					? { id: this.sortBy.column.id, direction: this.sortBy.direction }
					: null,
				filters: Object.fromEntries(
					this.columns.filter((c) => c.isFiltered).map((c) => [c.id, c.filterValue] as const)
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
	// Sort actions
	// -------------------------------------------------------------------------

	/**
	 * Cycles the sort state for the given column.
	 *
	 * **Cycle:** `none → ascending → descending → none`
	 *
	 * Triggers a new server fetch. No-op when `column.sortable` is `false`.
	 *
	 * @param column - The column to sort by.
	 */
	toggleSort(column: ColumnState<TRow>): void {
		if (!column.sortable) return;
		if (this.sortBy?.column === column) {
			this.sortBy =
				this.sortBy.direction === 'ascending' ? { column, direction: 'descending' } : null;
		} else {
			this.sortBy = { column, direction: 'ascending' };
		}
	}

	/**
	 * Returns the current sort direction for a column using the `aria-sort`
	 * attribute vocabulary.
	 *
	 * Returns `'none'` when the column is not the active sort column.
	 *
	 * @param column - The column to query.
	 */
	getSortDirection(column: ColumnState<TRow>): SortDirection | 'none' {
		if (!this.sortBy || this.sortBy.column !== column) return 'none';
		return this.sortBy.direction;
	}

	// -------------------------------------------------------------------------
	// Filter actions
	// -------------------------------------------------------------------------

	/**
	 * Sets a column's filter value and resets `pageIndex` to `0`.
	 *
	 * Prefer this over setting `column.filterValue` directly when you want
	 * the page to reset automatically (which is almost always the right
	 * behaviour for server-side filtering).
	 *
	 * @param column - The column to filter.
	 * @param value  - The new filter value. Pass `undefined` to clear.
	 */
	setFilter(column: ColumnState<TRow>, value: string | NumberRange | DateRange | undefined): void {
		column.filterValue = value;
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

	/**
	 * Clears the filter value on every column, clears `searchQuery`, and resets
	 * `pageIndex` to `0`.
	 */
	clearFilters(): void {
		for (const col of this.columns) {
			col.filterValue = undefined;
		}
		this.searchQuery = '';
		this.pageIndex = 0;
	}

	// -------------------------------------------------------------------------
	// Selection actions
	// -------------------------------------------------------------------------

	/**
	 * Toggles the `selected` state of a single row.
	 *
	 * @param row - The row to toggle.
	 */
	selectRow(row: RowState<TRow>): void {
		row.selected = !row.selected;
	}

	/**
	 * Sets the `selected` state for every row on the current page.
	 *
	 * @param selected - `true` to select all rows, `false` to deselect all.
	 */
	selectAll(selected: boolean): void {
		for (const row of this.rows) {
			row.selected = selected;
		}
	}

	// -------------------------------------------------------------------------
	// Pagination actions
	// -------------------------------------------------------------------------

	/**
	 * Advances to the next page. No-op when already on the last page.
	 */
	nextPage(): void {
		if (this.pageIndex < this.pageCount - 1) this.pageIndex++;
	}

	/**
	 * Returns to the previous page. No-op when already on the first page.
	 */
	prevPage(): void {
		if (this.pageIndex > 0) this.pageIndex--;
	}

	/**
	 * Navigates to a specific page, clamped to `[0, pageCount - 1]`.
	 *
	 * @param index - Zero-based page index.
	 */
	setPage(index: number): void {
		this.pageIndex = Math.max(0, Math.min(index, this.pageCount - 1));
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
