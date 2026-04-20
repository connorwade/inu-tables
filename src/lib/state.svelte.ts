import { SvelteSet } from 'svelte/reactivity';
import type { ColumnState } from './column.svelte.ts';
import type { RowFilter, SortDirection } from './types.ts';

const DEFAULT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// PaginationState
// ---------------------------------------------------------------------------

/**
 * Tracks which page is currently visible.
 *
 * `pageCount` is computed by `TableModel`, which knows both the filtered row
 * count and the page size. Access it via `table.pageCount`.
 */
export class PaginationState {
	pageIndex = $state(0);
	pageSize = $state(DEFAULT_PAGE_SIZE);

	constructor(options: { pageSize?: number } = {}) {
		if (options.pageSize) this.pageSize = options.pageSize;
	}
}

// ---------------------------------------------------------------------------
// SortingState
// ---------------------------------------------------------------------------

/**
 * Tracks which column is sorted and in which direction.
 *
 * For **server-side** tables, read `column` and `direction` in a reactive
 * expression (e.g. `$derived(await fetch(..., { sortBy: sorting.column?.id }))`)
 * and pass them as query parameters to the server.
 */
export class SortingState<TRow> {
	column: ColumnState<TRow> | null = $state(null);
	direction: SortDirection | null = $state(null);

	toggleSort(column: ColumnState<TRow>): void {
		if (!column.sortable) return;
		if (this.column === column) {
			this.direction = this.direction === 'ascending' ? 'descending' : null;
			if (this.direction === null) this.column = null;
		} else {
			this.column = column;
			this.direction = 'ascending';
		}
	}

	getSortDirection(column: ColumnState<TRow>): SortDirection | 'none' {
		if (this.column !== column) return 'none';
		return this.direction ?? 'none';
	}
}

// ---------------------------------------------------------------------------
// GlobalSearchState
// ---------------------------------------------------------------------------

/**
 * Tracks the global search query and produces a `RowFilter` predicate that
 * operates directly on raw row data (`TRow`).
 *
 * For **server-side** tables, omit `columns` — only `searchQuery` matters for
 * UI binding. The `filter` closure is never pushed to `rowFilters` when
 * `manualSearch: true`.
 */
export class GlobalSearchState<TRow> {
	searchQuery = $state('');

	/**
	 * Stable filter closure. Reads `searchQuery` reactively on every call.
	 * Push onto `TableModel.rowFilters` to enable client-side search.
	 */
	readonly filter: RowFilter<TRow>;

	constructor(columns: ColumnState<TRow>[] = []) {
		this.filter = (row: TRow): boolean => {
			const query = this.searchQuery.trim().toLowerCase();
			if (query === '' || columns.length === 0) return true;
			return columns.some((col) => {
				if (!col.searchable) return false;
				const cellValue = col.accessor(row);
				const displayValue = col.cellFn
					? col.cellFn(cellValue, row)
					: String(cellValue ?? '');
				if (col.searchFn) return col.searchFn(cellValue, displayValue, row, query);
				return displayValue.toLowerCase().includes(query);
			});
		};
	}
}

// ---------------------------------------------------------------------------
// RowSelectionState
// ---------------------------------------------------------------------------

/**
 * Tracks which rows are selected by their key value.
 *
 * Operates on raw `TRow` objects — no `RowState` wrapper needed.
 *
 * Create externally and inject via `state.rowSelection` if you need to observe
 * or control selection from outside the table (e.g. a "Delete selected" button,
 * URL-synced selection, server-side selection).  Otherwise `TableModel` creates
 * one automatically.
 *
 * Data-dependent aggregates (`allSelected`, `someSelected`, `selectedRows`) live
 * on `TableModel` because they require knowledge of the current row set.
 */
export class RowSelectionState<TRow> {
	private readonly _rowKey: keyof TRow;
	private readonly _keys: SvelteSet<TRow[keyof TRow]> = new SvelteSet();

	/** Number of currently selected rows. */
	readonly selectedCount: number;

	constructor(rowKey: keyof TRow) {
		this._rowKey = rowKey;
		this.selectedCount = $derived(this._keys.size);
	}

	isSelected(row: TRow): boolean {
		return this._keys.has(row[this._rowKey]);
	}

	select(row: TRow): void {
		this._keys.add(row[this._rowKey]);
	}

	deselect(row: TRow): void {
		this._keys.delete(row[this._rowKey]);
	}

	toggleSelected(row: TRow): void {
		const key = row[this._rowKey];
		if (this._keys.has(key)) this._keys.delete(key);
		else this._keys.add(key);
	}

	selectAll(rows: TRow[]): void {
		for (const row of rows) this._keys.add(row[this._rowKey]);
	}

	deselectAll(): void {
		this._keys.clear();
	}
}

// ---------------------------------------------------------------------------
// ColumnVisibilityState
// ---------------------------------------------------------------------------

export class ColumnVisibilityState<TRow> {
	visibleColumns: ColumnState<TRow>[];

	constructor(columns: ColumnState<TRow>[] = []) {
		this.visibleColumns = $derived(columns.filter((c) => c.show));
	}
}

// ---------------------------------------------------------------------------
// ColumnFilterState (kept for external / advanced use)
// ---------------------------------------------------------------------------

export class ColumnFilterState<TFilterValue> {
	value = $state() as TFilterValue;

	fn: (row: unknown, value: TFilterValue) => boolean;
	reset: (() => void) | undefined;

	constructor(
		fn: (row: unknown, value: TFilterValue) => boolean,
		{ initialValue, reset }: { initialValue?: TFilterValue; reset?: () => void }
	) {
		this.fn = fn;
		if (initialValue !== undefined) this.value = initialValue;
		if (reset) this.reset = reset;
	}
}
