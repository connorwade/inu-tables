/**
 * A lightweight wrapper around a single raw row object, used as the item type
 * in `TableModel.visibleRows` so that templates can key `{#each}` blocks by a
 * stable identity (`row.id`) and access the underlying data via `row.data`.
 *
 * Selection, cells, and all other row-level operations are accessed through
 * `TableModel` methods that accept the raw `TRow` data object — no need to
 * pass `RowState` back to the table.
 *
 * @typeParam TRow - The shape of the row's data object.
 */
export class RowState<TRow> {
	/** Reference to the original raw row object. Never cloned or mutated. */
	readonly data: TRow;

	/** Value of the `rowKey` field for this row. Used as the `{#each}` key. */
	readonly id: TRow[keyof TRow];

	constructor(data: TRow, id: TRow[keyof TRow]) {
		this.data = data;
		this.id = id;
	}
}
