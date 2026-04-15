import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { BaseTableState } from './base-table.svelte.js';
import { ColumnState } from './column.svelte.js';
import { RowState } from './row.svelte.js';
import { CellState } from './cell.svelte.js';
import type { TableOptions } from './types.js';

/**
 * The central mediator for all client-side table state.
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
 * - Sort, search, and pagination state live on {@link BaseTableState}.
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
 *   columns: [
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
export class TableState<TRow> extends BaseTableState<TRow> {
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
	readonly pageCount = $derived(Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize)));

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
	// Constructor
	// -------------------------------------------------------------------------

	constructor(options: TableOptions<TRow>) {
		super();
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
