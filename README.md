# Inu Tables

Data-table primitives built for Svelte 5.

Inu Tables is currently focused on low-level reactive building blocks: column entities, row/cell wrappers, filters, and shared types.

## Installation

```bash
pnpm add inu-tables
# or
npm install inu-tables
```

Svelte 5 is a peer dependency.

## Current public API

`inu-tables` currently exports the following symbols from the package root:

```ts
import {
	TableModel,
	PaginationState,
	SortingState,
	GlobalSearchState,
	RowSelectionState,
	ColumnVisibilityState,
	ColumnFilterState,
	ColumnState,
	RowState,
	CellState,
	ColumnFilter,
	TextColumnFilter,
	NumberColumnFilter,
	DateColumnFilter
} from 'inu-tables';

import type {
	ResolvedCell,
	RowFilter,
	SortDirection,
	FilterFn,
	SortFn,
	SearchFn,
	NumberRange,
	DateRange,
	ColumnDef,
	ColumnDefWithKey,
	ColumnDefWithFn,
	TableOptions
} from 'inu-tables';
```

`TableState`, `ServerTableState`, `ServerTableParams`, and `ServerTableResult` are not part of the current published API.

## Table model and state

### TableModel<TRow>

Reactive table engine used by the examples in this repository.

Constructor:

```ts
new TableModel<TRow>({
	data,
	columns,
	rowKey,
	state?,
	options?
});
```

Common members:

- `columns`
- `rowFilters`
- `sorting`
- `globalSearch`
- `columnVisibility`
- `pagination`
- `rowSelection`
- `filteredRows`
- `visibleRows`
- `rowCount`
- `pageCount`
- `selectedRows`
- `allSelected`
- `someSelected`
- `getCells(row)`
- `getKey(row)`

### State classes

- `PaginationState`
- `SortingState<TRow>`
- `GlobalSearchState<TRow>`
- `RowSelectionState<TRow>`
- `ColumnVisibilityState<TRow>`
- `ColumnFilterState<TFilterValue>`

## Classes

### ColumnState<TRow>

Represents a single column definition plus reactive column state.

Constructor:

```ts
new ColumnState<TRow>(def: ColumnDef<TRow>);
```

Key members:

- `id: string`
- `header: string`
- `accessor: (row: TRow) => unknown`
- `sortable: boolean`
- `sortFn: SortFn<TRow> | undefined`
- `filterable: boolean`
- `filter: ColumnFilter<any>`
- `cellFn: ((value: unknown, row: TRow) => string) | undefined`
- `searchable: boolean`
- `searchFn: SearchFn<TRow> | undefined`
- `show` (`$state<boolean>`, default `true`)
- `isFiltered` (`$derived<boolean>`)

Example:

```ts
type Person = { id: number; firstName: string; age: number };

const nameCol = new ColumnState<Person>({
	accessorKey: 'firstName',
	header: 'First name',
	sortable: true,
	filterable: true
});

nameCol.filter.value = 'ali';
```

### RowState<TRow>

Lightweight wrapper for a raw row object.

Constructor:

```ts
new RowState<TRow>(data: TRow, id: TRow[keyof TRow]);
```

Members:

- `data: TRow`
- `id: TRow[keyof TRow]`

### CellState<TRow>

Represents one row/column intersection.

Constructor:

```ts
new CellState<TRow>(row: RowState<TRow>, column: ColumnState<TRow>);
```

Members:

- `row: RowState<TRow>`
- `column: ColumnState<TRow>`
- `value: unknown`
- `displayValue: string`

## Filter classes

### ColumnFilter<TFilterValue = unknown>

Generic reactive filter wrapper.

Constructor:

```ts
new ColumnFilter<TFilterValue>({
	fn,
	reset?,
	initialValue?
});
```

Members:

- `value` (`$state<TFilterValue | undefined>`)
- `active` (`$derived<boolean>`)
- `fn: FilterFn`
- `reset: () => void`

### TextColumnFilter

Case-insensitive contains match.

- `value` type: `string | undefined`
- active when `value` is non-empty

### NumberColumnFilter

Inclusive numeric range match.

- `value` type: `{ min?: number; max?: number }`
- active when `min` or `max` is set to a finite number

### DateColumnFilter

Inclusive day-level date range match (UTC normalization).

- `value` type: `{ min?: Date | string; max?: Date | string }`
- active when `min` or `max` resolves to a valid date

Example:

```ts
const numeric = new NumberColumnFilter();
numeric.value = { min: 10, max: 25 };

const dates = new DateColumnFilter();
dates.value = { min: '2026-01-01', max: '2026-12-31' };
```

## Types

### ColumnDef<TRow>

Union of:

- `ColumnDefWithKey<TRow>`: `{ accessorKey, header, ... }`
- `ColumnDefWithFn<TRow>`: `{ id, accessorFn, header, ... }`

Common options:

- `header: string`
- `sortable?: boolean`
- `sortFn?: SortFn<TRow>`
- `filterable?: boolean`
- `filterType?: 'text' | 'number' | 'date'`
- `filterFn?: FilterFn`
- `cell?: (value: unknown, row: TRow) => string`
- `searchable?: boolean`
- `searchFn?: SearchFn<TRow>`

### Other exported types

- `ResolvedCell<TRow>`: `{ column, value, displayValue }`
- `RowFilter<TRow>`: `(row: TRow) => boolean`
- `SortDirection`: `'ascending' | 'descending'`
- `FilterFn`: `(cellValue: unknown, filterValue: unknown) => boolean`
- `SortFn<TRow>`: `(a: TRow, b: TRow) => number`
- `SearchFn<TRow>`: `(value, displayValue, row, query) => boolean`
- `NumberRange`: `{ min?: number; max?: number }`
- `DateRange`: `{ min?: Date | string; max?: Date | string }`
- `TableOptions<TRow>`: currently exported for compatibility

## Repository notes

The examples in `src/routes/examples` now import `TableModel` and state classes from the package root just like consumers can.

## License

MIT
