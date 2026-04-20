import { RowState } from './row.svelte.ts';
import type { ColumnDef, RowFilter } from './types.ts';
import { ColumnState } from './column.svelte.js';
import {
	ColumnVisibilityState,
	GlobalSearchState,
	PaginationState,
	RowSelectionState,
	SortingState
} from './state.svelte.ts';

const DEFAULT_PAGE_SIZE = 50;

/**
 * A resolved cell — the value and formatted string for one column in one row.
 * Returned by `TableModel.getCells(row)` on demand; nothing is precomputed.
 */
export type ResolvedCell<TRow> = {
	column: ColumnState<TRow>;
	value: unknown;
	displayValue: string;
};

class TableModel<TRow> {
	// -------------------------------------------------------------------------
	// Static configuration
	// -------------------------------------------------------------------------

	private readonly _rowKey: keyof TRow;
	readonly columns: ColumnState<TRow>[] = $state([]);

	// -------------------------------------------------------------------------
	// Raw data — the single source of truth.
	//
	// $derived.by with try/catch lets callers write `data: () => result.rows`
	// where `result` is `$derived(await ...)`.  Returns [] while the async
	// signal is pending — no intermediate $state or $effect.pre needed.
	// -------------------------------------------------------------------------

	private readonly _rawData: TRow[];

	// -------------------------------------------------------------------------
	// Row-filter array (public)
	// -------------------------------------------------------------------------

	/**
	 * Row predicates applied client-side (AND semantics).
	 * Operate on the raw `TRow` object. Built-in search and column-filter
	 * closures are pushed here automatically in automatic mode.
	 */
	rowFilters: RowFilter<TRow>[] = $state([]);

	// -------------------------------------------------------------------------
	// Injectable sub-state — follow the same pattern as sorting/pagination:
	// create externally and inject via `state.*`, or let TableModel auto-create.
	// -------------------------------------------------------------------------

	sorting: SortingState<TRow> | null = null;
	globalSearch: GlobalSearchState<TRow> | null = null;
	columnVisibility: ColumnVisibilityState<TRow> | null = null;
	pagination: PaginationState | null = null;

	/**
	 * Row selection state. Create externally and inject via `state.rowSelection`
	 * to observe or control selection from outside the table (e.g. a
	 * "Delete X rows" toolbar, URL-synced selection, server-side tracking).
	 * `TableModel` creates one automatically when not provided.
	 */
	rowSelection: RowSelectionState<TRow> | null = null;

	// -------------------------------------------------------------------------
	// Derived pipeline
	// -------------------------------------------------------------------------

	/** Rows that pass every predicate in `rowFilters`. Use `.length` for counts. */
	readonly filteredRows: TRow[];

	/**
	 * Filtered, sorted, and paginated rows wrapped in `RowState` for template
	 * iteration. Key `{#each}` by `row.id`; access raw data via `row.data`.
	 */
	readonly visibleRows: RowState<TRow>[];

	// -------------------------------------------------------------------------
	// Counts
	// -------------------------------------------------------------------------

	readonly rowsCount: number;
	readonly pageCount: number;

	// -------------------------------------------------------------------------
	// Selection aggregates — derived here because they need data context
	// -------------------------------------------------------------------------

	/** All rows in the current data set that are selected. */
	readonly selectedRows: TRow[];
	/** `true` when every row in the current data set is selected. */
	readonly allSelected: boolean;
	/** `true` when some (but not all) rows are selected. */
	readonly someSelected: boolean;

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor(params: {
		/**
		 * Row data. Two forms accepted:
		 *
		 * - **Static array** (`TRow[]`): client-side tables where the full
		 *   dataset is known up-front.
		 * - **Reactive getter** (`() => TRow[]`): server-side tables. Write
		 *   `data: () => result.rows` where `result = $derived(await ...)`.
		 *   TableModel wraps the getter in a `$derived.by` with try/catch so it
		 *   returns `[]` while the async signal is still pending — no extra
		 *   `$state` or `$effect.pre` required in calling code.
		 */
		data: TRow[] | (() => TRow[]);
		columns: ColumnDef<TRow>[];
		rowKey: keyof TRow;

		/**
		 * Optional external state. Inject your own instances to take ownership
		 * from outside the table (URL sync, server-side control, custom logic).
		 * The `manual*` options suppress client-side processing while still
		 * using the injected instances for UI binding.
		 */
		state?: {
			rowFilters?: RowFilter<TRow>[];
			sorting?: SortingState<TRow>;
			pagination?: PaginationState;
			globalSearch?: GlobalSearchState<TRow>;
			columnVisibility?: ColumnVisibilityState<TRow>;
			rowSelection?: RowSelectionState<TRow>;
			/** Server-side row count source: `rowCount: () => result.rowCount`. */
			rowCount?: () => number;
		};

		options?: {
			manualPagination?: boolean;
			manualSorting?: boolean;
			manualFiltering?: boolean;
			manualSearch?: boolean;
			manualColumnVisibility?: boolean;
			manualRowSelection?: boolean;
			pageSize?: number;
		};
	}) {
		this._rowKey = params.rowKey;
		this.columns = params.columns.map((def) => new ColumnState(def));

		if (params.state?.rowFilters) this.rowFilters = params.state.rowFilters;

		// Raw data
		const getData = typeof params.data === 'function' ? params.data : null;
		this._rawData = $derived.by(() => {
			if (!getData) return params.data as TRow[];
			try {
				return getData();
			} catch {
				return [] as TRow[];
			}
		});

		// Sorting
		if (params.state?.sorting) {
			this.sorting = params.state.sorting;
		} else if (!params.options?.manualSorting) {
			this.sorting = new SortingState();
		}

		// Global search
		if (params.state?.globalSearch) {
			this.globalSearch = params.state.globalSearch;
		} else if (!params.options?.manualSearch) {
			this.globalSearch = new GlobalSearchState(this.columns);
		}
		if (!params.options?.manualSearch && this.globalSearch) {
			this.rowFilters.push(this.globalSearch.filter);
		}

		// Column filters
		if (!params.options?.manualFiltering) {
			const columns = this.columns;
			this.rowFilters.push((row: TRow) => {
				for (const col of columns) {
					if (col.isFiltered && !col.filter.fn(col.accessor(row), col.filter.value)) return false;
				}
				return true;
			});
		}

		// filteredRows → sort → paginate → visibleRows
		this.filteredRows = $derived.by(() => {
			const data = this._rawData;
			if (this.rowFilters.length === 0) return data;
			return data.filter((row) => this.rowFilters.every((f) => f(row)));
		});

		this.visibleRows = $derived.by(() => {
			let rows: TRow[] = this.filteredRows;

			const sorting = this.sorting;
			if (sorting?.column && sorting.direction) {
				const { column, direction } = sorting;
				rows = [...rows].sort((a, b) => {
					if (column.sortFn) {
						const r = column.sortFn(a, b);
						return direction === 'descending' ? -r : r;
					}
					const av = column.accessor(a);
					const bv = column.accessor(b);
					if (av == null && bv == null) return 0;
					if (av == null) return 1;
					if (bv == null) return -1;
					const r = av < bv ? -1 : av > bv ? 1 : 0;
					return direction === 'descending' ? -r : r;
				});
			}

			if (this.pagination) {
				const start = this.pagination.pageIndex * this.pagination.pageSize;
				rows = rows.slice(start, start + this.pagination.pageSize);
			}

			const key = this._rowKey;
			return rows.map((row) => new RowState(row, row[key]));
		});

		// Counts
		this.rowsCount = $derived(this._rawData.length);

		const rawGetCount = params.state?.rowCount;
		const getCount = rawGetCount
			? () => {
					try {
						return rawGetCount();
					} catch {
						return 0;
					}
				}
			: () => this.filteredRows.length;

		// Pagination
		if (params.state?.pagination) {
			this.pagination = params.state.pagination;
		} else if (!params.options?.manualPagination) {
			this.pagination = new PaginationState({
				pageSize: params.options?.pageSize ?? DEFAULT_PAGE_SIZE
			});
		}

		this.pageCount = $derived.by(() => {
			if (!this.pagination) return 1;
			return Math.max(1, Math.ceil(getCount() / this.pagination.pageSize));
		});

		// Row selection
		if (params.state?.rowSelection) {
			this.rowSelection = params.state.rowSelection;
		} else if (!params.options?.manualRowSelection) {
			this.rowSelection = new RowSelectionState(params.rowKey);
		}

		// Selection aggregates — need data context, so they live here
		const sel = this.rowSelection;
		this.selectedRows = $derived(sel ? this._rawData.filter((row) => sel.isSelected(row)) : []);
		this.allSelected = $derived(
			sel !== null && this._rawData.length > 0 && sel.selectedCount === this._rawData.length
		);
		this.someSelected = $derived(
			sel !== null && sel.selectedCount > 0 && sel.selectedCount < this._rawData.length
		);

		// Column visibility
		if (params.state?.columnVisibility) {
			this.columnVisibility = params.state.columnVisibility;
		} else if (!params.options?.manualColumnVisibility) {
			this.columnVisibility = new ColumnVisibilityState(this.columns);
		}
	}

	// -------------------------------------------------------------------------
	// Selection convenience — delegate to rowSelection; take TRow not RowState
	// -------------------------------------------------------------------------

	isSelected(row: TRow): boolean {
		return this.rowSelection?.isSelected(row) ?? false;
	}

	toggleSelected(row: TRow): void {
		this.rowSelection?.toggleSelected(row);
	}

	selectAll(): void {
		this.rowSelection?.selectAll(this._rawData);
	}

	deselectAll(): void {
		this.rowSelection?.deselectAll();
	}

	// -------------------------------------------------------------------------
	// Cell access — on demand, takes TRow
	// -------------------------------------------------------------------------

	/**
	 * Resolved cells for a row, computed on demand.
	 * Pass `row.data` when iterating `visibleRows`.
	 *
	 * ```svelte
	 * {#each table.visibleRows as row (row.id)}
	 *   {#each table.getCells(row.data) as cell (cell.column.id)}
	 *     {cell.displayValue}
	 *   {/each}
	 * {/each}
	 * ```
	 */
	getCells(row: TRow): ResolvedCell<TRow>[] {
		return this.columns.map((col) => {
			const value = col.accessor(row);
			return {
				column: col,
				value,
				displayValue: col.cellFn ? col.cellFn(value, row) : String(value ?? '')
			};
		});
	}

	getKey(row: TRow): TRow[keyof TRow] {
		return row[this._rowKey];
	}
}

export default TableModel;
