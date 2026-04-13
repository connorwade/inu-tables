import type { ColumnState } from './column.svelte.js';
import type { RowState } from './row.svelte.js';

/**
 * Represents a single table cell — the intersection of a {@link RowState}
 * and a {@link ColumnState}.
 *
 * The cell value is computed once at construction by calling
 * `column.accessor(row.data)` and stored as a plain readonly property.
 * Cells are never mutated after construction; they reflect the source
 * data through the column's accessor function.
 *
 * `CellState` instances are created and owned by `TableState`. You
 * normally access them through `TableState.cells`,
 * `TableState.getCellsForRow`, or `TableState.visibleCells`.
 *
 * @typeParam TRow - The shape of the row's data object.
 *
 * @example
 * ```ts
 * const table = new TableState({ data, columns })
 *
 * // Iterate cells for a specific row (O(1)):
 * for (const cell of table.getCellsForRow(table.rows[0])) {
 *   console.log(cell.column.header, cell.value)
 * }
 *
 * // Iterate all visible cells on the current page:
 * for (const cell of table.visibleCells) {
 *   console.log(cell.column.id, cell.value)
 * }
 * ```
 */
export class CellState<TRow> {
	/** The row this cell belongs to. */
	readonly row: RowState<TRow>;

	/** The column this cell belongs to. */
	readonly column: ColumnState<TRow>;

	/**
	 * The value for this cell, computed from `column.accessor(row.data)`
	 * at construction time.
	 *
	 * The type is `unknown` because the accessor's return type is not
	 * tracked generically. Cast to the expected type when you need it:
	 * ```ts
	 * const name = cell.value as string
	 * ```
	 */
	readonly value: unknown;

	constructor(row: RowState<TRow>, column: ColumnState<TRow>) {
		this.row = row;
		this.column = column;
		this.value = column.accessor(row.data);
	}
}
