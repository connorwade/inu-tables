import { SvelteMap } from 'svelte/reactivity';
import { CellState } from './cell.svelte.js';
import { RowState } from './row.svelte.ts';
import type { ColumnDef } from './types.ts';
import { ColumnState } from './column.svelte.js';
import {
	ColumnVisibilityState,
	GlobalSearchState,
	PaginationState,
	RowSelectionState,
	SortingState,
	TableFilterState
} from './state.svelte.ts';

const DEFAULT_PAGE_SIZE = 50;

class TableModel<TRow> {
	readonly data: TRow[];
	readonly pageSize: number;
	readonly rows: RowState<TRow>[] = $state([]);
	readonly columns: ColumnState<TRow>[] = $state([]);
	readonly cells: CellState<TRow>[] = $state([]);
	private cellsByRow = new SvelteMap<RowState<TRow>['id'], CellState<TRow>[]>();

	pagination: PaginationState<TRow> | null = null;
	sorting: SortingState<TRow> | null = null;
	globalSearch: GlobalSearchState<TRow> | null = null;
	rowSelection: RowSelectionState<TRow> | null = null;
	columnVisibility: ColumnVisibilityState<TRow> | null = null;
	tableFilter: TableFilterState<TRow> | null = null;

	readonly rowsCount = $derived(this.rows.length);

	constructor(params: {
		data: TRow[];
		columns: ColumnDef<TRow>[];
		rowKey: keyof TRow;
		options?: {
			manualPagination?: boolean;
			manualSorting?: boolean;
			manualFiltering?: boolean;
			manualSearch?: boolean;
			manualRowSelection?: boolean;
			manualColumnVisibility?: boolean;
			manualColumnFiltering?: boolean;
			pageSize?: number;
		};
	}) {
		this.data = params.data;
		this.pageSize = params.options?.pageSize ?? DEFAULT_PAGE_SIZE;

		this.columns = params.columns.map((def) => new ColumnState(def));
		this.rows = params.data.map((row) => new RowState(row, row[params.rowKey]));

		this.cellsByRow = new SvelteMap();
		this.cells = [];

		for (const row of this.rows) {
			const rowCells: CellState<TRow>[] = [];
			for (const column of this.columns) {
				const cell = new CellState(row, column);
				this.cells.push(cell);
				rowCells.push(cell);
			}
			this.cellsByRow.set(row.id, rowCells);
		}

		if (!params.options?.manualSearch) {
			this.globalSearch = new GlobalSearchState(this.rows, this.columns);
		}

		if (!params.options?.manualSorting) {
			this.sorting = new SortingState(() => this.globalSearch?.searchedRows ?? this.rows);
		}

		if (!params.options?.manualFiltering) {
			this.tableFilter = new TableFilterState({
				rows: () => this.sorting?.sortedRows ?? this.globalSearch?.searchedRows ?? this.rows,
				columns: this.columns
			});
		}

		if (!params.options?.manualPagination) {
			this.pagination = new PaginationState(
				() =>
					this.tableFilter?.filteredRows ??
					this.sorting?.sortedRows ??
					this.globalSearch?.searchedRows ??
					this.rows,
				{ pageSize: this.pageSize }
			);
		}

		if (!params.options?.manualRowSelection) {
			this.rowSelection = new RowSelectionState(this.rows);
		}
		if (!params.options?.manualColumnVisibility) {
			this.columnVisibility = new ColumnVisibilityState(this.columns);
		}
	}

	getCellsForRow(row: RowState<TRow>): CellState<TRow>[] {
		return this.cellsByRow.get(row.id) ?? [];
	}
}

export default TableModel;
