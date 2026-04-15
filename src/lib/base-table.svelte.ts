import type { SortDirection } from './types.js';
import type { ColumnState } from './column.svelte.js';
import type { RowState } from './row.svelte.js';

/**
 * Abstract base class containing the state and methods shared between
 * {@link TableState} and {@link ServerTableState}.
 *
 * Not exported from the library — consume `TableState` or `ServerTableState`.
 *
 * @internal
 * @typeParam TRow - The shape of each row's data object.
 */
export abstract class BaseTableState<TRow> {
	// -------------------------------------------------------------------------
	// Abstract members — concrete subclasses must provide these
	// -------------------------------------------------------------------------

	/**
	 * All column instances, in definition order.
	 * Built once at construction and never replaced.
	 */
	abstract readonly columns: ColumnState<TRow>[];

	/**
	 * The current row instances.
	 *
	 * In `TableState` this is the full dataset (readonly, built once).
	 * In `ServerTableState` this is the current page (replaced after every fetch).
	 *
	 * `allSelected`, `someSelected`, and `selectAll` operate on this set.
	 */
	abstract rows: RowState<TRow>[];

	/**
	 * Total number of pages.
	 *
	 * In `TableState` this is derived from `filteredRows.length / pageSize`.
	 * In `ServerTableState` this is derived from the server-reported `rowCount / pageSize`.
	 * Always at least `1`.
	 */
	abstract readonly pageCount: number;

	// -------------------------------------------------------------------------
	// Sort state
	// -------------------------------------------------------------------------

	/**
	 * The active sort column and direction, or `null` when unsorted.
	 *
	 * Use {@link toggleSort} to cycle through `ascending → descending → null`.
	 * Read per-column sort direction for `aria-sort` via {@link getSortDirection}.
	 */
	sortBy = $state<{ column: ColumnState<TRow>; direction: SortDirection } | null>(null);

	// -------------------------------------------------------------------------
	// Search state
	// -------------------------------------------------------------------------

	/**
	 * The current global search query string.
	 *
	 * In `TableState`, filtering happens client-side and `filteredRows` reacts
	 * immediately. In `ServerTableState`, a new fetch is triggered.
	 * Setting to `''` clears the search. Also cleared by {@link clearFilters}.
	 */
	searchQuery = $state('');

	// -------------------------------------------------------------------------
	// Pagination state
	// -------------------------------------------------------------------------

	/**
	 * Zero-based index of the currently visible page.
	 *
	 * Use {@link nextPage}, {@link prevPage}, and {@link setPage} to navigate
	 * safely within bounds. Resets to `0` when filters are cleared via
	 * {@link clearFilters}.
	 */
	pageIndex = $state(0);

	/**
	 * Number of rows per page.
	 *
	 * @default 10
	 */
	pageSize = $state(10);

	// -------------------------------------------------------------------------
	// Derived column views
	// -------------------------------------------------------------------------

	/**
	 * Columns where `show` is `true`, in definition order.
	 *
	 * Recomputes whenever any column's `show` changes.
	 */
	visibleColumns = $derived.by(() => this.columns.filter((c) => c.show));

	// -------------------------------------------------------------------------
	// Derived selection state
	// -------------------------------------------------------------------------

	/**
	 * `true` when every row in {@link rows} is selected and at least one exists.
	 * Setting to `true` or `false` selects or deselects every row in {@link rows}.
	 */
	get allSelected() {
		return this.rows.length > 0 && this.rows.every((r) => r.selected);
	}
	set allSelected(selected: boolean) {
		this.rows.forEach((r) => (r.selected = selected));
	}

	/**
	 * `true` when at least one row is selected but not all rows are selected.
	 *
	 * Maps to the `indeterminate` state of a "select all" checkbox.
	 */
	someSelected = $derived.by(
		() => this.rows.some((r) => r.selected) && !this.rows.every((r) => r.selected)
	);

	// -------------------------------------------------------------------------
	// Sort actions
	// -------------------------------------------------------------------------

	/**
	 * Cycles the sort state for the given column.
	 *
	 * **Cycle:** `none → ascending → descending → none`
	 *
	 * If a different column was previously active, it is replaced.
	 * No-op when `column.sortable` is `false`.
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
	 * Suitable for use directly on `aria-sort`:
	 * ```svelte
	 * <th aria-sort={table.getSortDirection(col)}>…</th>
	 * ```
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
	 * Clears the filter value on every column, clears `searchQuery`, and resets
	 * the page to `0`.
	 */
	clearFilters(): void {
		for (const col of this.columns) {
			col.filter.reset();
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
	 * Sets the `selected` state for every row in {@link rows}.
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
	 * Returns `true` if `nextPage()` would advance to a new page.
	 */
	canGetNextPage(): boolean {
		return this.pageIndex < this.pageCount - 1;
	}

	/**
	 * Returns `true` if `prevPage()` would return to a previous page.
	 */
	canGetPrevPage(): boolean {
		return this.pageIndex > 0;
	}

	/**
	 * Advances to the next page. No-op when already on the last page.
	 */
	nextPage(): void {
		if (this.canGetNextPage()) this.pageIndex++;
	}

	/**
	 * Returns to the previous page. No-op when already on the first page.
	 */
	prevPage(): void {
		if (this.canGetPrevPage()) this.pageIndex--;
	}

	/**
	 * Navigates to a specific page, clamped to `[0, pageCount - 1]`.
	 *
	 * @param index - Zero-based page index.
	 */
	setPage(index: number): void {
		this.pageIndex = Math.max(0, Math.min(index, this.pageCount - 1));
	}
}
