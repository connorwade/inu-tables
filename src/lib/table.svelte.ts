import { ColumnState } from './column.svelte.js';
import { RowState } from './row.svelte.js';
import { CellState } from './cell.svelte.js';
import type { SortDirection, TableOptions } from './types.js';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

/**
 * The central mediator for all table state.
 *
 * `TableState` owns the sort and pagination state and exposes derived views
 * of the data after filtering, sorting, and paginating. It coordinates
 * changes across the entity instances it manages without duplicating their
 * state.
 *
 * **Architecture**
 *
 * - Filter state lives on each {@link ColumnState} (the column owns its filter).
 * - Selection state lives on each {@link RowState} (the row owns its selection).
 * - Sort and pagination state live here because they are cross-cutting concerns.
 * - `TableState` reads entity state via `$derived` and exposes the composed result.
 *
 * **Derived pipeline**
 * ```
 * rows (all, static)
 *   → filteredRows  ($derived — columns with isFiltered=true applied)
 *     → sortedRows  ($derived — current sortBy applied)
 *       → paginatedRows ($derived — current page slice)
 * ```
 *
 * @typeParam TRow - The shape of each row's data object.
 *
 * @example
 * ```ts
 * type Person = { name: string; age: number; joined: Date }
 *
 * const table = new TableState<Person>({
 *   data: [
 *     { name: 'Alice', age: 30, joined: new Date('2022-01-15') },
 *     { name: 'Bob',   age: 25, joined: new Date('2023-06-01') }
 *   ],
 * columns: [
 *     { accessorKey: 'name',   header: 'Name',   sortable: true, filterable: true },
 *     { accessorKey: 'age',    header: 'Age',    sortable: true, filterable: true, filterType: 'number' },
 *     { accessorKey: 'joined', header: 'Joined', sortable: true, filterable: true, filterType: 'date' }
 *   ],
 *   pageSize: 20
 * })
 *
 * // Bind a filter input directly:
 * // <input type="text" bind:value={(table.columns[0].filter as TextColumnFilter).value} />
 *
 * // Sort by age ascending → descending → clear:
 * table.toggleSort(table.columns[1]) // ascending
 * table.toggleSort(table.columns[1]) // descending
 * table.toggleSort(table.columns[1]) // cleared
 *
 * // Iterate the current page:
 * for (const row of table.paginatedRows) {
 *   for (const cell of table.getCellsForRow(row)) {
 *     console.log(cell.column.header, cell.value)
 *   }
 * }
 * ```
 */
export class TableState<TRow> {
	// -------------------------------------------------------------------------
	// Static collections — built once at construction, never replaced
	// -------------------------------------------------------------------------

	/** All column instances, in definition order. */
	readonly columns: ColumnState<TRow>[];

	/** All row instances, in data order. */
	readonly rows: RowState<TRow>[];

	/**
	 * All cell instances — every row × every column, row-major order.
	 *
	 * Use {@link getCellsForRow} for O(1) per-row access, or
	 * {@link visibleCells} for the current page filtered to visible columns.
	 */
	readonly cells: CellState<TRow>[];

	/** O(1) lookup map used internally by `getCellsForRow`. */
	readonly #cellsByRow: Map<RowState<TRow>, CellState<TRow>[]>;

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
	 * When non-empty (after trimming), a row must have at least one searchable
	 * column whose value matches the query before it appears in `filteredRows`.
	 * The default match is a case-insensitive substring check against
	 * `displayValue`; individual columns can override this with `searchFn`.
	 *
	 * Setting to `''` clears the search. Also cleared by {@link clearFilters}.
	 *
	 * To reset pagination when the query changes, add a `$effect` in your
	 * component that reads `searchQuery` and calls `setPage(0)`.
	 */
	searchQuery = $state('');

	// -------------------------------------------------------------------------
	// Pagination state
	// -------------------------------------------------------------------------

	/**
	 * Zero-based index of the currently visible page.
	 *
	 * Use {@link nextPage}, {@link prevPage}, and {@link setPage} to navigate
	 * safely within bounds. Resets to `0` automatically when a filter changes
	 * via {@link setFilter} or {@link clearFilters}.
	 */
	pageIndex = $state(0);

	/**
	 * Number of rows per page.
	 *
	 * Changing this value does not automatically reset `pageIndex`; call
	 * {@link setPage}`(0)` afterward if you want to return to the first page.
	 *
	 * @default 10
	 */
	pageSize = $state(10);

	// -------------------------------------------------------------------------
	// Derived pipeline
	// -------------------------------------------------------------------------

	/**
	 * Rows that pass every active column filter and the global search query,
	 * in data order.
	 *
	 * Recomputes whenever any column's `filter.value` or `searchQuery` changes.
	 * When no column has an active filter and `searchQuery` is empty, this
	 * returns the full `rows` array without allocating a new array.
	 *
	 * **Search value priority per column:**
	 * 1. `column.searchFn` — custom override (receives raw value, displayValue, row, query)
	 * 2. `displayValue` (`cellFn` result) — when a cell formatter is defined
	 * 3. Raw accessor value via `String(value ?? '')` — fallback
	 */
	filteredRows = $derived.by(() => {
		const active = this.columns.filter((c) => c.isFiltered);
		const rawQuery = this.searchQuery.trim();
		const searchCols = rawQuery ? this.columns.filter((c) => c.searchable) : [];

		if (active.length === 0 && searchCols.length === 0) return this.rows;

		const lowerQuery = rawQuery.toLowerCase();

		return this.rows.filter((row) => {
			// Every active column filter must pass
			if (active.length > 0) {
				const passesFilters = active.every((col) =>
					col.filter.fn(col.accessor(row.data), col.filter.value)
				);
				if (!passesFilters) return false;
			}

			// At least one searchable column must match the query
			if (searchCols.length > 0) {
				return searchCols.some((col) => {
					const raw = col.accessor(row.data);
					const display = col.cellFn ? col.cellFn(raw, row.data) : String(raw ?? '');
					if (col.searchFn) return col.searchFn(raw, display, row.data, rawQuery);
					return display.toLowerCase().includes(lowerQuery);
				});
			}

			return true;
		});
	});

	/**
	 * Filtered rows after applying the current sort.
	 *
	 * A new array is created for sorting so that `filteredRows` is never
	 * mutated. `null` and `undefined` accessor values sort to the end
	 * regardless of direction. The native `Array.sort` is stable in all
	 * modern environments.
	 */
	sortedRows = $derived.by(() => {
		if (!this.sortBy) return this.filteredRows;
		const { column, direction } = this.sortBy;
		return [...this.filteredRows].sort((a, b) => {
			if (column.sortFn) {
				const r = column.sortFn(a.data, b.data);
				return direction === 'descending' ? -r : r;
			}
			const av = column.accessor(a.data);
			const bv = column.accessor(b.data);
			// Nullish values always sort last
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			const result = av < bv ? -1 : av > bv ? 1 : 0;
			return direction === 'descending' ? -result : result;
		});
	});

	/**
	 * Total number of pages given the current filter result and page size.
	 * Always at least `1`, even when there are no matching rows.
	 */
	pageCount = $derived(Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)));

	/**
	 * The slice of sorted rows on the current page.
	 *
	 * This is the primary array to iterate when rendering the table body.
	 */
	paginatedRows = $derived.by(() => {
		const start = this.pageIndex * this.pageSize;
		return this.sortedRows.slice(start, start + this.pageSize);
	});

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
	// Derived cell views
	// -------------------------------------------------------------------------

	/**
	 * Cells that belong to visible columns for rows on the current page,
	 * ordered row-first then column-first within each row.
	 *
	 * This is the flat list to iterate when rendering a table grid where
	 * column visibility and pagination must both be respected.
	 *
	 * Recomputes when `paginatedRows` or `visibleColumns` changes.
	 */
	visibleCells = $derived.by(() => {
		const colSet = new SvelteSet(this.visibleColumns);
		return this.paginatedRows.flatMap((row) =>
			(this.#cellsByRow.get(row) ?? []).filter((cell) => colSet.has(cell.column))
		);
	});

	// -------------------------------------------------------------------------
	// Derived selection state
	// -------------------------------------------------------------------------

	/**
	 * `true` when every row in the full dataset is selected.
	 * `false` when there are no rows.
	 *
	 * Useful for driving a "select all" checkbox checked state.
	 */
	allSelected = $derived.by(() => this.rows.length > 0 && this.rows.every((r) => r.selected));

	/**
	 * `true` when at least one row is selected but not all rows are selected.
	 *
	 * Maps to the `indeterminate` state of a "select all" checkbox.
	 */
	someSelected = $derived.by(
		() => this.rows.some((r) => r.selected) && !this.rows.every((r) => r.selected)
	);

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor(options: TableOptions<TRow>) {
		this.pageSize = options.pageSize ?? 10;
		this.columns = options.columns.map((def) => new ColumnState(def));
		this.rows = options.data.map((row) => new RowState(row));

		this.#cellsByRow = new SvelteMap();
		this.cells = [];

		for (const row of this.rows) {
			const rowCells: CellState<TRow>[] = [];
			for (const column of this.columns) {
				const cell = new CellState(row, column);
				this.cells.push(cell);
				rowCells.push(cell);
			}
			this.#cellsByRow.set(row, rowCells);
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
	 * If a different column was previously active, it is replaced.
	 * No-op when `column.sortable` is `false`.
	 *
	 * @param column - The column to sort by.
	 *
	 * @example
	 * ```ts
	 * table.toggleSort(table.columns[0]) // ascending
	 * table.toggleSort(table.columns[0]) // descending
	 * table.toggleSort(table.columns[0]) // null (cleared)
	 * ```
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
	 * the page to 0.
	 *
	 * For individual column filters, set `column.filter.value` directly —
	 * it is a plain `$state` property and can be used with `bind:value`:
	 *
	 * ```svelte
	 * <input type="text" bind:value={(col.filter as TextColumnFilter).value} />
	 * ```
	 *
	 * To reset pagination when a filter or search changes, add a `$effect` in
	 * your component:
	 *
	 * ```svelte
	 * $effect(() => {
	 *   table.columns.forEach(c => c.filter.value);
	 *   table.searchQuery;
	 *   table.setPage(0);
	 * });
	 * ```
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
	 * Sets the `selected` state for every row in the full dataset.
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
	 * O(1) — backed by an internal `Map` built at construction time.
	 *
	 * @param row - The row whose cells you want.
	 * @returns The cells for this row, or an empty array if the row is unknown.
	 */
	getCellsForRow(row: RowState<TRow>): CellState<TRow>[] {
		return this.#cellsByRow.get(row) ?? [];
	}
}
