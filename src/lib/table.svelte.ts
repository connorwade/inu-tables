type RowAccessor<RowData> = (row: RowData) => any;
type RowData = Record<string, any>;
type ColumnDef<RowData> = {
	id: string;
	header: string;
	accessor: RowAccessor<RowData>;
};

export class TableState<RowData> {
	rawData: RowData[];

	columns: ColumnState<RowData>[];
	rows: RowState<RowData>[];
	cells: CellState<RowData>[];

	constructor(rawData: RowData[], columnDefs: ColumnDef<RowData>[]) {
		this.rawData = rawData;
		this.columns = columnDefs.map((def) => {
			const column = new ColumnState<RowData>();
			column.id = def.id;
			column.header = def.header;
			column.accessor = def.accessor;
			return column;
		});

		this.rows = rawData.map((row) => {
			const rowState = new RowState<RowData>();
			rowState.data = row;
			return rowState;
		});

		this.cells = [];
		for (const row of this.rows) {
			for (const column of this.columns) {
				const cell = new CellState<RowData>();
				cell.row = row;
				cell.column = column;
				cell.value = column.accessor(row.data);
				this.cells.push(cell);
			}
		}
	}
}

export class ColumnState<RowData> {
	id: string;
	header: string;
	accessor: (row: RowData) => any;
	show = $state(true);
}

export class RowState<RowData> {
	data: RowData;
	selected = $state(false);
}

export class CellState<RowData> {
	row: RowState<RowData>;
	column: ColumnState<RowData>;
	value: any;
}
