/**
 * Represents a single data row with its own reactive selection state.
 *
 * `RowState` is intentionally minimal: it holds a reference to the original
 * row data and owns only the state that belongs to the row itself. The
 * library never clones or mutates `data` — all table behaviour (filtering,
 * sorting, pagination) is applied to the `RowState` instances, not to the
 * underlying data.
 *
 * @typeParam TRow - The shape of the row's data object.
 *
 * @example
 * ```ts
 * // RowState instances are created automatically by TableState.
 * const table = new TableState({ data, columns })
 *
 * // Toggle selection on the first row:
 * table.selectRow(table.rows[0])
 *
 * // Read reactive selection state:
 * console.log(table.rows[0].selected) // true
 * ```
 */
export class RowState<TRow> {
	/**
	 * Reference to the original raw row object supplied to `TableState`.
	 *
	 * This value is never copied or mutated by the library. All reactive
	 * state lives on the `RowState` wrapper, not on the underlying data.
	 */
	readonly data: TRow;

	readonly id: TRow[keyof TRow];

	/**
	 * Whether this row is currently selected.
	 *
	 * Toggle via `TableState.selectRow`, set all at once with
	 * `TableState.selectAll`, or mutate directly when fine-grained
	 * control is needed.
	 *
	 * @default false
	 */
	selected = $state(false);

	constructor(data: TRow, id: TRow[keyof TRow]) {
		this.data = data;
		this.id = id;
	}
}
