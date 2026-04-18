import type { ColumnState } from './column.svelte.ts';
import type { RowState } from './row.svelte.ts';
import type { SortDirection } from './types.ts';

const DEFAULT_PAGE_SIZE = 50;

type RowSource<TRow> = RowState<TRow>[] | (() => RowState<TRow>[]);

function toRowGetter<TRow>(source: RowSource<TRow>): () => RowState<TRow>[] {
	return typeof source === 'function' ? source : () => source;
}

export class PaginationState<TRow> {
	pageIndex = $state(0);
	pageSize = $state(DEFAULT_PAGE_SIZE);
	paginatedRows: RowState<TRow>[];
	pageCount: number;

	constructor(definitiveRows: RowSource<TRow>, options: { pageSize?: number }) {
		const getRows = toRowGetter(definitiveRows);
		if (options.pageSize) this.pageSize = options.pageSize;
		this.paginatedRows = $derived.by(() => {
			const rows = getRows();
			const start = this.pageIndex * this.pageSize;
			return rows.slice(start, start + this.pageSize);
		});

		this.pageCount = $derived.by(() => Math.max(1, Math.ceil(getRows().length / this.pageSize)));
	}
}

export class SortingState<TRow> {
	column: ColumnState<TRow> | null = $state(null);
	direction: SortDirection | null = $state(null);
	sortedRows: RowState<TRow>[];

	constructor(definitiveRows: RowSource<TRow>) {
		const getRows = toRowGetter(definitiveRows);
		this.sortedRows = $derived.by(() => {
			const rows = getRows();
			if (!this.column || !this.direction) return rows;
			const { accessor } = this.column;
			const direction = this.direction;
			return [...rows].sort((a, b) => {
				if (this.column!.sortFn) {
					const r = this.column!.sortFn(a.data, b.data);
					return direction === 'descending' ? -r : r;
				}
				const av = accessor(a.data);
				const bv = accessor(b.data);
				// Nullish values always sort last
				if (av == null && bv == null) return 0;
				if (av == null) return 1;
				if (bv == null) return -1;
				const result = av < bv ? -1 : av > bv ? 1 : 0;
				return direction === 'descending' ? -result : result;
			});
		});
	}

	toggleSort(column: ColumnState<TRow>): void {
		if (!column.sortable) return;
		if (this.column === column) {
			this.direction = this.direction === 'ascending' ? 'descending' : null;
			if (this.direction === null) {
				this.column = null;
			}
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

export class GlobalSearchState<TRow> {
	searchedRows: RowState<TRow>[];
	searchQuery = $state('');

	constructor(rows: RowSource<TRow>, columns: ColumnState<TRow>[]) {
		const getRows = toRowGetter(rows);
		this.searchedRows = $derived.by(() => {
			const rowList = getRows();
			const query = this.searchQuery.trim().toLowerCase();
			if (query === '') return rowList;
			return rowList.filter((row) => {
				return columns.some((column) => {
					const cellValue = column.accessor(row.data);
					return String(cellValue).toLowerCase().includes(query);
				});
			});
		});
	}
}

export class RowSelectionState<TRow> {
	selectedRows: RowState<TRow>[];
	private rowsCount = $state() as number;

	constructor(rows: RowState<TRow>[]) {
		this.rowsCount = rows.length;
		this.selectedRows = $derived(rows.filter((r) => r.selected));
	}

	get allSelected(): boolean {
		return this.rowsCount > 0 && this.selectedRows.length === this.rowsCount;
	}

	set allSelected(selectedRows: RowState<TRow>[]) {
		selectedRows.forEach((r) => (r.selected = true));
	}

	get someSelected(): boolean {
		return this.selectedRows.length > 0 && this.selectedRows.length < this.rowsCount;
	}
}

export class ColumnVisibilityState<TRow> {
	visibleColumns: ColumnState<TRow>[];

	constructor(columns: ColumnState<TRow>[] = []) {
		this.visibleColumns = $derived(columns.filter((c) => c.show));
	}
}

export class TableFilterState<TRow> {
	filteredRows: RowState<TRow>[];

	constructor({ rows, columns }: { rows: RowSource<TRow>; columns: ColumnState<TRow>[] }) {
		const getRows = toRowGetter(rows);
		this.filteredRows = $derived.by(() => {
			let result = getRows();

			// Apply column filters
			for (const column of columns) {
				if (column.isFiltered) {
					result = result.filter((row) => {
						const cellValue = column.accessor(row.data);
						return column.filter.fn(cellValue, column.filter.value);
					});
				}
			}

			return result;
		});
	}
}

export class ColumnFilterState<TFilterValue> {
	value = $state() as TFilterValue;

	fn: (row: unknown, value: TFilterValue) => boolean;
	reset: (() => void) | undefined;

	constructor(
		fn: (row: unknown, value: TFilterValue) => boolean,
		{ initialValue, reset }: { initialValue?: TFilterValue; reset?: () => void }
	) {
		this.fn = fn;
		if (initialValue !== undefined) {
			this.value = initialValue;
		}
		if (reset) {
			this.reset = reset;
		}
	}
}
