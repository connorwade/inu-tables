# Inu Tables

Data tables built for Svelte 5.

A headless, reactive table state library for Svelte 5. Inu Tables manages sorting, filtering, pagination, column visibility, and row selection as plain reactive classes — you own the markup entirely.

- **Headless** — no styles, no HTML generated. Render however you like.
- **Runes-native** — state is `$state`/`$derived`; bind directly in templates.
- **Client or server** — full client-side pipeline _or_ delegate everything to the server.
- **TypeScript-first** — all public APIs are fully typed; row shapes are generic.

---

## Installation

```bash
npm install inu-tables
# or
pnpm add inu-tables
```

Svelte 5 is a peer dependency.

---

## Quickstart — client-side table

### 1. Define your data shape and columns

```ts
// +page.svelte
import { TableState } from 'inu-tables';

type Person = {
	id: number;
	firstName: string;
	lastName: string;
	age: number;
	joined: Date;
};

const data: Person[] = [
	{ id: 1, firstName: 'Alice', lastName: 'Smith', age: 30, joined: new Date('2022-01-15') },
	{ id: 2, firstName: 'Bob', lastName: 'Jones', age: 25, joined: new Date('2023-06-01') },
	{ id: 3, firstName: 'Carol', lastName: 'Taylor', age: 35, joined: new Date('2021-11-30') }
];

const table = new TableState<Person>({
	data,
	columns: [
		{ accessorKey: 'firstName', header: 'First Name', sortable: true, filterable: true },
		{ accessorKey: 'lastName', header: 'Last Name', sortable: true, filterable: true },
		{ accessorKey: 'age', header: 'Age', sortable: true, filterable: true, filterType: 'number' },
		{
			accessorKey: 'joined',
			header: 'Joined',
			sortable: true,
			filterable: true,
			filterType: 'date'
		}
	],
	pageSize: 10
});
```

Use `accessorKey` to point at a key of your row type (column id defaults to the key name). For computed or combined fields, use `accessorFn` with an explicit `id` instead:

```ts
{
  id: 'fullName',
  header: 'Full Name',
  accessorFn: (r) => `${r.firstName} ${r.lastName}`,
  sortable: true,
}
```

### 2. Render the table

```svelte
<script lang="ts">
	// ... table setup from above ...

	// Keep page in sync when a filter changes
	$effect(() => {
		for (const col of table.columns) col.filterValue;
		table.setPage(0);
	});

	// Drive the indeterminate state of the select-all checkbox
	let selectAllEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (selectAllEl) selectAllEl.indeterminate = table.someSelected;
	});
</script>

<table>
	<thead>
		<!-- Sort headers -->
		<tr>
			<th>
				<input
					type="checkbox"
					bind:this={selectAllEl}
					checked={table.allSelected}
					onchange={(e) => table.selectAll((e.target as HTMLInputElement).checked)}
				/>
			</th>
			{#each table.visibleColumns as col (col.id)}
				<th aria-sort={table.getSortDirection(col)}>
					{#if col.sortable}
						<button onclick={() => table.toggleSort(col)}>{col.header}</button>
					{:else}
						{col.header}
					{/if}
				</th>
			{/each}
		</tr>
		<!-- Filter inputs -->
		<tr>
			<td></td>
			{#each table.visibleColumns as col (col.id)}
				<td>
					{#if col.filterable}
						<input
							type={col.filterType === 'number'
								? 'number'
								: col.filterType === 'date'
									? 'date'
									: 'text'}
							bind:value={col.filterValue as string}
							placeholder="Filter…"
						/>
					{/if}
				</td>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each table.paginatedRows as row (row)}
			<tr>
				<td>
					<input type="checkbox" checked={row.selected} onchange={() => table.selectRow(row)} />
				</td>
				{#each table.getCellsForRow(row).filter((c) => c.column.show) as cell (cell.column.id)}
					<td>{cell.value}</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<!-- Pagination -->
<button onclick={() => table.prevPage()} disabled={table.pageIndex === 0}>Prev</button>
<span>Page {table.pageIndex + 1} of {table.pageCount}</span>
<button onclick={() => table.nextPage()} disabled={table.pageIndex >= table.pageCount - 1}
	>Next</button
>
```

### 3. Column visibility toggles

`col.show` is plain `$state(true)` — bind to a checkbox to show/hide columns:

```svelte
{#each table.columns as col (col.id)}
	<label>
		<input type="checkbox" bind:checked={col.show} />
		{col.header}
	</label>
{/each}
```

---

## Quickstart — server-side table

Use `ServerTableState` when filtering, sorting, and pagination happen on the server. The state class fires a fetch automatically whenever any table parameter changes.

### 1. Write the server fetch function

With **SvelteKit remote functions** (recommended):

```ts
// data.remote.ts
import { query } from '$app/server'
import type { ServerTableParams, ServerTableResult } from 'inu-tables'

type Person = { id: number; firstName: string; age: number }

const db: Person[] = /* your data source */[]

export const getPersons = query(
  /* optional Zod schema for params */,
  async (params: ServerTableParams): Promise<ServerTableResult<Person>> => {
    let data = db

    // Filter
    if (params.filters['firstName']) {
      const q = String(params.filters['firstName']).toLowerCase()
      data = data.filter(r => r.firstName.toLowerCase().includes(q))
    }
    if (params.filters['age']) {
      const min = Number(params.filters['age'])
      data = data.filter(r => r.age >= min)
    }

    // Sort
    if (params.sortBy) {
      const { id, direction } = params.sortBy
      const mul = direction === 'ascending' ? 1 : -1
      data = [...data].sort((a, b) => {
        const av = a[id as keyof Person]
        const bv = b[id as keyof Person]
        return (av < bv ? -1 : av > bv ? 1 : 0) * mul
      })
    }

    // Paginate
    const rowCount = data.length
    const start = params.pageIndex * params.pageSize
    return { rows: data.slice(start, start + params.pageSize), rowCount }
  }
)
```

Any `(params: ServerTableParams) => Promise<ServerTableResult<TRow>>` function works — REST endpoints, tRPC procedures, SvelteKit load functions, etc.

### 2. Create the table state

```ts
// +page.svelte
import { ServerTableState } from 'inu-tables';
import { getPersons } from './data.remote.ts';

const table = new ServerTableState<Person>({
	fetch: getPersons,
	columns: [
		{ accessorKey: 'firstName', header: 'First Name', sortable: true, filterable: true },
		{ accessorKey: 'age', header: 'Age', sortable: true, filterable: true, filterType: 'number' }
	],
	pageSize: 20
});
```

An initial fetch fires automatically when the component mounts.

### 3. Render with loading and error states

`ServerTableState` exposes `loading` and `error` alongside the same sort/filter/pagination API as `TableState`:

```svelte
{#if table.error}
  <p>Error: {table.error.message}</p>
{/if}

{#if table.loading}
  <p>Loading…</p>
{/if}

<table>
  <thead>
    <tr>
      {#each table.visibleColumns as col (col.id)}
        <th aria-sort={table.getSortDirection(col)}>
          <button onclick={() => table.toggleSort(col)}>{col.header}</button>
        </th>
      {/each}
    </tr>
    <tr>
      {#each table.visibleColumns as col (col.id)}
        <td>
          {#if col.filterable}
            <input
              bind:value={col.filterValue as string}
              oninput={() => table.setFilter(col, col.filterValue)}
              placeholder="Filter…"
            />
          {/if}
        </td>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each table.rows as row (row)}
      <tr>
        {#each table.getCellsForRow(row).filter(c => c.column.show) as cell (cell.column.id)}
          <td>{cell.value}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<button onclick={() => table.prevPage()}>Prev</button>
<span>Page {table.pageIndex + 1} of {table.pageCount} — {table.rowCount} results</span>
<button onclick={() => table.nextPage()}>Next</button>
```

Use `table.setFilter(col, value)` instead of setting `col.filterValue` directly — it also resets `pageIndex` to `0`, which is almost always the right behaviour for server-side filtering.

---

## API reference

### `TableState<TRow>`

Client-side table. All filtering, sorting, and pagination run in the browser.

| Member                  | Type                                    | Description                                       |
| ----------------------- | --------------------------------------- | ------------------------------------------------- |
| `columns`               | `ColumnState<TRow>[]`                   | All columns, definition order.                    |
| `rows`                  | `RowState<TRow>[]`                      | All rows, data order.                             |
| `cells`                 | `CellState<TRow>[]`                     | All cells, row-major order.                       |
| `sortBy`                | `{ column, direction } \| null`         | Active sort, or `null`.                           |
| `pageIndex`             | `number`                                | Current zero-based page.                          |
| `pageSize`              | `number`                                | Rows per page (default `10`).                     |
| `filteredRows`          | `RowState<TRow>[]`                      | Rows passing all active filters.                  |
| `sortedRows`            | `RowState<TRow>[]`                      | Filtered rows after sort.                         |
| `paginatedRows`         | `RowState<TRow>[]`                      | Current page slice.                               |
| `pageCount`             | `number`                                | Total pages (min `1`).                            |
| `visibleColumns`        | `ColumnState<TRow>[]`                   | Columns where `show` is `true`.                   |
| `visibleCells`          | `CellState<TRow>[]`                     | Cells for visible columns on current page.        |
| `allSelected`           | `boolean`                               | `true` when every row is selected.                |
| `someSelected`          | `boolean`                               | `true` when some but not all rows are selected.   |
| `toggleSort(col)`       | `void`                                  | Cycle sort: none → ascending → descending → none. |
| `getSortDirection(col)` | `'ascending' \| 'descending' \| 'none'` | `aria-sort`-compatible value.                     |
| `clearFilters()`        | `void`                                  | Clear all column filters, reset page to `0`.      |
| `selectRow(row)`        | `void`                                  | Toggle a single row's selection.                  |
| `selectAll(selected)`   | `void`                                  | Select or deselect all rows.                      |
| `nextPage()`            | `void`                                  | Advance one page (no-op at last page).            |
| `prevPage()`            | `void`                                  | Go back one page (no-op at first page).           |
| `setPage(index)`        | `void`                                  | Navigate to a page, clamped to valid range.       |
| `getCellsForRow(row)`   | `CellState<TRow>[]`                     | O(1) cell lookup for a row.                       |

### `ServerTableState<TRow>`

Server-side table. Identical API to `TableState` plus:

| Member                  | Type            | Description                                  |
| ----------------------- | --------------- | -------------------------------------------- |
| `loading`               | `boolean`       | `true` while a fetch is in flight.           |
| `error`                 | `Error \| null` | Error from the last failed fetch, or `null`. |
| `rowCount`              | `number`        | Total matching rows reported by the server.  |
| `setFilter(col, value)` | `void`          | Set a filter value _and_ reset page to `0`.  |

`rows` and `cells` contain only the current page (not the full dataset).

### `ColumnState<TRow>`

| Member        | Type                                   | Description                               |
| ------------- | -------------------------------------- | ----------------------------------------- |
| `id`          | `string`                               | Column identifier.                        |
| `header`      | `string`                               | Display label.                            |
| `accessor`    | `(row: TRow) => unknown`               | Value extractor.                          |
| `sortable`    | `boolean`                              | Whether this column can be sorted.        |
| `filterable`  | `boolean`                              | Whether this column can be filtered.      |
| `filterType`  | `'text' \| 'number' \| 'date'`         | Active filter strategy.                   |
| `show`        | `$state boolean`                       | Column visibility (bind to a checkbox).   |
| `filterValue` | `$state string \| number \| undefined` | Current filter value (bind to an input).  |
| `isFiltered`  | `$derived boolean`                     | `true` when a non-empty filter is active. |

### `RowState<TRow>`

| Member     | Type             | Description                   |
| ---------- | ---------------- | ----------------------------- |
| `data`     | `TRow`           | The original row data object. |
| `selected` | `$state boolean` | Selection state.              |

### `CellState<TRow>`

| Member   | Type                | Description                                        |
| -------- | ------------------- | -------------------------------------------------- |
| `row`    | `RowState<TRow>`    | The row this cell belongs to.                      |
| `column` | `ColumnState<TRow>` | The column this cell belongs to.                   |
| `value`  | `unknown`           | Computed cell value (`column.accessor(row.data)`). |

### Column definitions

Two variants, both extend a common base:

```ts
// Key variant — id defaults to accessorKey
{ accessorKey: 'age', header: 'Age', sortable: true }

// Function variant — id required
{ id: 'fullName', header: 'Full Name', accessorFn: (r) => `${r.first} ${r.last}` }
```

Common options:

| Option       | Type                                  | Default  | Description               |
| ------------ | ------------------------------------- | -------- | ------------------------- |
| `header`     | `string`                              | —        | Column label.             |
| `sortable`   | `boolean`                             | `false`  | Enable sorting.           |
| `sortFn`     | `(a, b) => number`                    | built-in | Custom sort comparator.   |
| `filterable` | `boolean`                             | `false`  | Enable filtering.         |
| `filterType` | `'text' \| 'number' \| 'date'`        | `'text'` | Built-in filter strategy. |
| `filterFn`   | `(cellValue, filterValue) => boolean` | built-in | Custom filter function.   |

### Built-in filter functions

| Function       | Behaviour                                                 |
| -------------- | --------------------------------------------------------- |
| `textFilter`   | Case-insensitive string containment.                      |
| `numberFilter` | Show rows where cell value `>=` filter value.             |
| `dateFilter`   | Show rows where cell date is on or after the filter date. |

All three treat `undefined`, `null`, and `''` as "no filter" (pass all rows). Import them directly if you need them outside of column definitions:

```ts
import { textFilter, numberFilter, dateFilter } from 'inu-tables';
```

### `ServerTableParams`

Passed to your fetch function on every state change:

```ts
interface ServerTableParams {
	pageIndex: number;
	pageSize: number;
	sortBy: { id: string; direction: 'ascending' | 'descending' } | null;
	filters: Record<string, string | number | undefined>;
}
```

### `ServerTableResult<TRow>`

What your fetch function must return:

```ts
interface ServerTableResult<TRow> {
	rows: TRow[]; // current page only, already filtered + sorted
	rowCount: number; // total matching rows (before pagination)
}
```

---

## License

MIT
