import { describe, it, expect, beforeEach } from 'vitest';
import { TableState } from './table.svelte.js';
import type { ColumnDef } from './types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type Person = { name: string; age: number; joined: Date };

const people: Person[] = [
	{ name: 'Alice', age: 30, joined: new Date('2022-01-15') },
	{ name: 'Bob', age: 25, joined: new Date('2023-06-01') },
	{ name: 'Carol', age: 35, joined: new Date('2021-03-20') },
	{ name: 'Dave', age: 28, joined: new Date('2023-11-10') },
	{ name: 'Eve', age: 22, joined: new Date('2024-02-05') }
];

const columns: ColumnDef<Person>[] = [
	{ accessorKey: 'name', header: 'Name', sortable: true, filterable: true },
	{
		accessorKey: 'age',
		header: 'Age',
		sortable: true,
		filterable: true,
		filterType: 'number'
	},
	{
		accessorKey: 'joined',
		header: 'Joined',
		sortable: true,
		filterable: true,
		filterType: 'date'
	}
];

function makeTable(pageSize = 10) {
	return new TableState<Person>({ data: people, columns, pageSize });
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('TableState construction', () => {
	it('creates the correct number of columns', () => {
		const table = makeTable();
		expect(table.columns.length).toBe(3);
	});

	it('creates the correct number of rows', () => {
		const table = makeTable();
		expect(table.rows.length).toBe(5);
	});

	it('creates rows × columns cells', () => {
		const table = makeTable();
		expect(table.cells.length).toBe(15); // 5 rows × 3 columns
	});

	it('preserves column id and header', () => {
		const table = makeTable();
		expect(table.columns[0].id).toBe('name');
		expect(table.columns[0].header).toBe('Name');
	});

	it('sets provided pageSize', () => {
		const table = makeTable(20);
		expect(table.pageSize).toBe(20);
	});

	it('defaults pageSize to 10 when not provided', () => {
		const table = new TableState({ data: people, columns });
		expect(table.pageSize).toBe(10);
	});

	it('preserves raw data references on rows', () => {
		const table = makeTable();
		expect(table.rows[0].data).toBe(people[0]);
	});
});

// ---------------------------------------------------------------------------
// getCellsForRow
// ---------------------------------------------------------------------------

describe('getCellsForRow', () => {
	it('returns one cell per column for a given row', () => {
		const table = makeTable();
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells.length).toBe(3);
	});

	it('returns cells in column-definition order', () => {
		const table = makeTable();
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].column.id).toBe('name');
		expect(cells[1].column.id).toBe('age');
		expect(cells[2].column.id).toBe('joined');
	});

	it('returns correct cell values via the column accessor', () => {
		const table = makeTable();
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].value).toBe('Alice');
		expect(cells[1].value).toBe(30);
	});

	it('returns an empty array for an unknown row', () => {
		const table = makeTable();
		// Structurally compatible but not registered in the internal Map — should return []
		const unregistered = {
			data: people[0],
			selected: false
		} as unknown as import('./row.svelte.js').RowState<Person>;
		expect(table.getCellsForRow(unregistered)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Column visibility
// ---------------------------------------------------------------------------

describe('visibleColumns', () => {
	it('returns all columns by default', () => {
		const table = makeTable();
		expect(table.visibleColumns.length).toBe(3);
	});

	it('excludes a column when show is set to false', () => {
		const table = makeTable();
		table.columns[1].show = false;
		expect(table.visibleColumns.length).toBe(2);
		expect(table.visibleColumns.every((c) => c.id !== 'age')).toBe(true);
	});

	it('re-includes a column when show is set back to true', () => {
		const table = makeTable();
		table.columns[1].show = false;
		table.columns[1].show = true;
		expect(table.visibleColumns.length).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// visibleCells
// ---------------------------------------------------------------------------

describe('visibleCells', () => {
	it('returns (page rows) × (visible columns) cells', () => {
		const table = makeTable();
		// 5 rows on page 0, 3 visible columns → 15 cells
		expect(table.visibleCells.length).toBe(15);
	});

	it('reduces cell count when a column is hidden', () => {
		const table = makeTable();
		table.columns[0].show = false;
		// 5 rows × 2 visible columns = 10
		expect(table.visibleCells.length).toBe(10);
	});

	it('only includes cells from the current page', () => {
		const table = makeTable(2);
		// page 0: 2 rows × 3 columns = 6 cells
		expect(table.visibleCells.length).toBe(6);
		table.nextPage();
		// page 1: 2 rows × 3 columns = 6 cells
		expect(table.visibleCells.length).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

describe('filtering', () => {
	it('filteredRows contains all rows when no filter is active', () => {
		const table = makeTable();
		expect(table.filteredRows.length).toBe(5);
	});

	it('setting filter.value reduces filteredRows to matching rows', () => {
		const table = makeTable();
		table.columns[0].filter.value = 'ali';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.name).toBe('Alice');
	});

	it('column.isFiltered is true after setting a non-empty filter.value', () => {
		const table = makeTable();
		table.columns[0].filter.value = 'alice';
		expect(table.columns[0].isFiltered).toBe(true);
	});

	it('column.isFiltered is false when filter.value is empty string', () => {
		const table = makeTable();
		table.columns[0].filter.value = '';
		expect(table.columns[0].isFiltered).toBe(false);
	});

	it('column.isFiltered is false when filter.value is undefined', () => {
		const table = makeTable();
		table.columns[0].filter.value = undefined;
		expect(table.columns[0].isFiltered).toBe(false);
	});

	it('column.isFiltered is false for non-filterable columns', () => {
		const nonFilterable = new TableState({
			data: people,
			columns: [{ accessorKey: 'name', header: 'Name' }]
		});
		nonFilterable.columns[0].filter.value = 'Alice';
		expect(nonFilterable.columns[0].isFiltered).toBe(false);
	});

	it('column.isFiltered is false when filter.value is an empty range object', () => {
		const table = makeTable();
		table.columns[1].filter.value = {};
		expect(table.columns[1].isFiltered).toBe(false);
	});

	it('column.isFiltered is true when a range object has at least one bound set', () => {
		const table = makeTable();
		table.columns[1].filter.value = { min: 25 };
		expect(table.columns[1].isFiltered).toBe(true);
	});

	it('number range filter — min only keeps rows at or above min', () => {
		const table = makeTable();
		table.columns[1].filter.value = { min: 30 };
		const ages = table.filteredRows.map((r) => r.data.age);
		expect(ages.every((a) => a >= 30)).toBe(true);
	});

	it('number range filter — max only keeps rows at or below max', () => {
		const table = makeTable();
		table.columns[1].filter.value = { max: 28 };
		const ages = table.filteredRows.map((r) => r.data.age);
		expect(ages.every((a) => a <= 28)).toBe(true);
	});

	it('number range filter — both bounds keeps rows within the range', () => {
		const table = makeTable();
		table.columns[1].filter.value = { min: 25, max: 30 };
		const ages = table.filteredRows.map((r) => r.data.age);
		expect(ages.every((a) => a >= 25 && a <= 30)).toBe(true);
	});

	it('date range filter — min only keeps rows on or after the start date', () => {
		const table = makeTable();
		table.columns[2].filter.value = { min: new Date('2023-01-01') };
		const joined = table.filteredRows.map((r) => r.data.joined.getTime());
		expect(joined.every((t) => t >= new Date('2023-01-01').getTime())).toBe(true);
	});

	it('date range filter — both bounds keeps rows within the date range', () => {
		const table = makeTable();
		table.columns[2].filter.value = { min: '2022-01-01', max: '2023-06-30' };
		// Alice: 2022-01-15, Bob: 2023-06-01 → 2 rows
		expect(table.filteredRows.length).toBe(2);
	});

	it('clearFilters resets all column filter values', () => {
		const table = makeTable();
		table.columns[0].filter.value = 'alice';
		table.clearFilters();
		expect(table.filteredRows.length).toBe(5);
	});

	it('clearFilters resets pageIndex to 0', () => {
		const table = makeTable(2);
		table.nextPage();
		table.clearFilters();
		expect(table.pageIndex).toBe(0);
	});

	it('applies multiple column filters simultaneously', () => {
		const table = makeTable();
		// name contains 'a' (case-insensitive): Alice, Carol, Dave (3)
		table.columns[0].filter.value = 'a';
		// age >= 30: Alice (30), Carol (35)
		// intersect: Alice, Carol (2)
		table.columns[1].filter.value = { min: 30 };
		expect(table.filteredRows.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe('sorting', () => {
	it('sortedRows matches filteredRows order when no sort is active', () => {
		const table = makeTable();
		expect(table.sortedRows.map((r) => r.data.name)).toEqual(
			table.filteredRows.map((r) => r.data.name)
		);
	});

	it('toggleSort sets ascending direction on first call', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		expect(table.sortBy?.direction).toBe('ascending');
		expect(table.sortBy?.column).toBe(table.columns[0]);
	});

	it('toggleSort switches to descending on second call', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy?.direction).toBe('descending');
	});

	it('toggleSort clears sort on third call', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy).toBeNull();
	});

	it('toggleSort replaces sort when called on a different column', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[1]);
		expect(table.sortBy?.column).toBe(table.columns[1]);
		expect(table.sortBy?.direction).toBe('ascending');
	});

	it('toggleSort is a no-op for non-sortable columns', () => {
		const nonSortable = new TableState({
			data: people,
			columns: [{ accessorKey: 'name', header: 'Name' }]
		});
		nonSortable.toggleSort(nonSortable.columns[0]);
		expect(nonSortable.sortBy).toBeNull();
	});

	it('sorts rows ascending by name', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		const names = table.sortedRows.map((r) => r.data.name);
		expect(names).toEqual([...names].sort());
	});

	it('sorts rows descending by name', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		const names = table.sortedRows.map((r) => r.data.name);
		expect(names).toEqual([...names].sort().reverse());
	});

	it('sorts rows ascending by age (numeric)', () => {
		const table = makeTable();
		table.toggleSort(table.columns[1]);
		const ages = table.sortedRows.map((r) => r.data.age);
		expect(ages).toEqual([...ages].sort((a, b) => a - b));
	});
});

// ---------------------------------------------------------------------------
// getSortDirection
// ---------------------------------------------------------------------------

describe('getSortDirection', () => {
	it('returns "none" for all columns initially', () => {
		const table = makeTable();
		for (const col of table.columns) {
			expect(table.getSortDirection(col)).toBe('none');
		}
	});

	it('returns "ascending" for the active sort column', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		expect(table.getSortDirection(table.columns[0])).toBe('ascending');
	});

	it('returns "descending" after second toggle', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		expect(table.getSortDirection(table.columns[0])).toBe('descending');
	});

	it('returns "none" for non-active columns when another column is sorted', () => {
		const table = makeTable();
		table.toggleSort(table.columns[0]);
		expect(table.getSortDirection(table.columns[1])).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination', () => {
	it('pageCount is 1 when all rows fit on a single page', () => {
		const table = makeTable(10);
		expect(table.pageCount).toBe(1);
	});

	it('pageCount reflects filtered row count', () => {
		const table = makeTable(2);
		expect(table.pageCount).toBe(3); // ceil(5/2)
		table.columns[0].filter.value = 'alice';
		expect(table.pageCount).toBe(1);
	});

	it('pageCount is at least 1 even when no rows match', () => {
		const table = makeTable();
		table.columns[0].filter.value = 'zzz';
		expect(table.pageCount).toBe(1);
	});

	it('paginatedRows returns first page slice', () => {
		const table = makeTable(2);
		expect(table.paginatedRows.length).toBe(2);
		expect(table.paginatedRows[0].data.name).toBe('Alice');
	});

	it('nextPage advances pageIndex', () => {
		const table = makeTable(2);
		table.nextPage();
		expect(table.pageIndex).toBe(1);
		expect(table.paginatedRows[0].data.name).toBe('Carol');
	});

	it('nextPage does not advance past the last page', () => {
		const table = makeTable(2);
		table.nextPage();
		table.nextPage();
		table.nextPage(); // already at last page
		expect(table.pageIndex).toBe(2);
	});

	it('prevPage decrements pageIndex', () => {
		const table = makeTable(2);
		table.nextPage();
		table.prevPage();
		expect(table.pageIndex).toBe(0);
	});

	it('prevPage does not go below 0', () => {
		const table = makeTable(2);
		table.prevPage();
		expect(table.pageIndex).toBe(0);
	});

	it('setPage navigates to the given page', () => {
		const table = makeTable(2);
		table.setPage(2);
		expect(table.pageIndex).toBe(2);
	});

	it('setPage clamps to the last page when index is too large', () => {
		const table = makeTable(2);
		table.setPage(999);
		expect(table.pageIndex).toBe(table.pageCount - 1);
	});

	it('setPage clamps to 0 when index is negative', () => {
		const table = makeTable(2);
		table.setPage(-5);
		expect(table.pageIndex).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe('selection', () => {
	it('no rows are selected initially', () => {
		const table = makeTable();
		expect(table.rows.every((r) => !r.selected)).toBe(true);
	});

	it('allSelected is false initially', () => {
		const table = makeTable();
		expect(table.allSelected).toBe(false);
	});

	it('someSelected is false initially', () => {
		const table = makeTable();
		expect(table.someSelected).toBe(false);
	});

	it('selectRow toggles a single row', () => {
		const table = makeTable();
		table.selectRow(table.rows[0]);
		expect(table.rows[0].selected).toBe(true);
		table.selectRow(table.rows[0]);
		expect(table.rows[0].selected).toBe(false);
	});

	it('someSelected is true when some but not all rows are selected', () => {
		const table = makeTable();
		table.selectRow(table.rows[0]);
		expect(table.someSelected).toBe(true);
		expect(table.allSelected).toBe(false);
	});

	it('selectAll(true) selects every row', () => {
		const table = makeTable();
		table.selectAll(true);
		expect(table.rows.every((r) => r.selected)).toBe(true);
	});

	it('allSelected is true when every row is selected', () => {
		const table = makeTable();
		table.selectAll(true);
		expect(table.allSelected).toBe(true);
	});

	it('someSelected is false when all rows are selected', () => {
		const table = makeTable();
		table.selectAll(true);
		expect(table.someSelected).toBe(false);
	});

	it('selectAll(false) deselects every row', () => {
		const table = makeTable();
		table.selectAll(true);
		table.selectAll(false);
		expect(table.rows.every((r) => !r.selected)).toBe(true);
	});

	it('allSelected is false for an empty table', () => {
		const table = new TableState({ data: [], columns });
		expect(table.allSelected).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Custom sortFn
// ---------------------------------------------------------------------------

describe('custom sortFn', () => {
	it('uses the custom comparator when provided', () => {
		// Sort by name length ascending
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					accessorKey: 'name',
					header: 'Name',
					sortable: true,
					sortFn: (a, b) => a.name.length - b.name.length
				}
			]
		});
		table.toggleSort(table.columns[0]);
		const names = table.sortedRows.map((r) => r.data.name);
		const lengths = names.map((n) => n.length);
		expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
	});
});

// ---------------------------------------------------------------------------
// Custom filterFn
// ---------------------------------------------------------------------------

describe('custom filterFn', () => {
	it('uses the custom filter function when provided', () => {
		// Filter rows where age is even
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					id: 'age',
					header: 'Age',
					accessorFn: (r) => r.age,
					filterable: true,
					filterFn: (cellValue) => Number(cellValue) % 2 === 0
				}
			]
		});
		// Any non-undefined filter.value activates the filter; the custom fn ignores the value
		table.columns[0].filter.value = true;
		const ages = table.filteredRows.map((r) => r.data.age);
		expect(ages.every((a) => a % 2 === 0)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// displayValue — cell formatter
// ---------------------------------------------------------------------------

describe('displayValue', () => {
	it('falls back to String(value) when no cell formatter is provided', () => {
		const table = makeTable();
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].displayValue).toBe('Alice');
		expect(cells[1].displayValue).toBe('30');
	});

	it('uses the cell formatter when provided', () => {
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					accessorKey: 'age',
					header: 'Age',
					cell: (value) => `${value} yrs`
				}
			]
		});
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].displayValue).toBe('30 yrs');
	});

	it('passes both the raw value and the row data to the formatter', () => {
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					id: 'fullName',
					header: 'Full Name',
					accessorFn: (r) => r,
					cell: (_, row) => {
						const p = row as Person;
						return `${p.name} (${p.age})`;
					}
				}
			]
		});
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].displayValue).toBe('Alice (30)');
	});

	it('falls back to empty string when value is null/undefined', () => {
		const table = new TableState<{ x: null }>({
			data: [{ x: null }],
			columns: [{ accessorKey: 'x', header: 'X' }]
		});
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].displayValue).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('search', () => {
	it('returns all rows when searchQuery is empty', () => {
		const table = makeTable();
		expect(table.filteredRows.length).toBe(5);
	});

	it('matches against the raw accessor value when no cellFn is present', () => {
		const table = makeTable();
		table.searchQuery = 'ali';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.name).toBe('Alice');
	});

	it('matches against displayValue when cellFn is present', () => {
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					accessorKey: 'age',
					header: 'Age',
					// cellFn formats as "30 yrs" etc.
					cell: (v) => `${v} yrs`
				}
			]
		});
		table.searchQuery = '25 yrs';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.age).toBe(25);
	});

	it('prefers displayValue over raw accessor when cellFn is present', () => {
		// Raw value is 25, cellFn emits "twenty-five" — only searching "twenty" should match
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					accessorKey: 'age',
					header: 'Age',
					cell: (v) => (v === 25 ? 'twenty-five' : String(v))
				}
			]
		});
		// "25" does NOT appear in the displayValue for Bob (it's "twenty-five")
		table.searchQuery = '25';
		expect(table.filteredRows.length).toBe(0);

		// "twenty" DOES appear in the displayValue
		table.searchQuery = 'twenty';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.age).toBe(25);
	});

	it('is case-insensitive by default', () => {
		const table = makeTable();
		table.searchQuery = 'ALICE';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.name).toBe('Alice');
	});

	it('matches across multiple columns — any match passes the row', () => {
		const table = makeTable();
		// "30" matches age column for Alice; no name column contains "30"
		table.searchQuery = '30';
		expect(table.filteredRows.some((r) => r.data.name === 'Alice')).toBe(true);
	});

	it('excludes columns with searchable: false', () => {
		const table = new TableState<Person>({
			data: people,
			columns: [
				{ accessorKey: 'name', header: 'Name', searchable: false },
				{ accessorKey: 'age', header: 'Age' }
			]
		});
		// "Alice" only appears in name column, which is not searchable
		table.searchQuery = 'Alice';
		expect(table.filteredRows.length).toBe(0);
	});

	it('uses a custom searchFn when provided', () => {
		const table = new TableState<Person>({
			data: people,
			columns: [
				{
					accessorKey: 'name',
					header: 'Name',
					// Only match rows where the name starts with the query
					searchFn: (_, display, _row, query) =>
						display.toLowerCase().startsWith(query.toLowerCase())
				}
			]
		});
		// "al" starts Alice's name; "lic" does not start it
		table.searchQuery = 'al';
		expect(table.filteredRows.length).toBe(1);
		expect(table.filteredRows[0].data.name).toBe('Alice');

		table.searchQuery = 'lic';
		expect(table.filteredRows.length).toBe(0);
	});

	it('passes raw value, displayValue, row data, and query to searchFn', () => {
		const calls: { value: unknown; display: string; row: Person; query: string }[] = [];
		const table = new TableState<Person>({
			data: [people[0]], // just Alice
			columns: [
				{
					accessorKey: 'age',
					header: 'Age',
					cell: (v) => `${v} yrs`,
					searchFn: (value, display, row, query) => {
						calls.push({ value, display, row: row as Person, query });
						return true;
					}
				}
			]
		});
		table.searchQuery = 'test';
		// Trigger derived access
		table.filteredRows;
		expect(calls.length).toBeGreaterThan(0);
		expect(calls[0].value).toBe(30);
		expect(calls[0].display).toBe('30 yrs');
		expect(calls[0].row.name).toBe('Alice');
		expect(calls[0].query).toBe('test');
	});

	it('ANDs with active column filters — both must pass', () => {
		// Use a two-column table (no Date) so String(value) for age is just a number string,
		// avoiding accidental search matches through Date.toString() day/month names.
		const table = new TableState<Person>({
			data: people,
			columns: [
				{ accessorKey: 'name', header: 'Name', filterable: true },
				{ accessorKey: 'age', header: 'Age', filterable: true, filterType: 'number' }
			]
		});
		// Filter: age >= 28 → Alice(30), Carol(35), Dave(28) pass
		// Search 'e' → Alice("Alice" has 'e'), Dave("Dave" has 'e') pass; Carol("Carol"/"35") — no 'e'
		table.columns[1].filter.value = { min: 28 };
		table.searchQuery = 'e';
		const names = table.filteredRows.map((r) => r.data.name).sort();
		expect(names).toEqual(['Alice', 'Dave']);
	});

	it('clearFilters also clears searchQuery', () => {
		const table = makeTable();
		table.searchQuery = 'alice';
		table.columns[0].filter.value = 'x';
		table.clearFilters();
		expect(table.searchQuery).toBe('');
		expect(table.filteredRows.length).toBe(5);
	});

	it('resets to full row count when searchQuery is cleared', () => {
		const table = makeTable();
		table.searchQuery = 'Alice';
		expect(table.filteredRows.length).toBe(1);
		table.searchQuery = '';
		expect(table.filteredRows.length).toBe(5);
	});

	it('trims whitespace before matching', () => {
		const table = makeTable();
		table.searchQuery = '  alice  ';
		expect(table.filteredRows.length).toBe(1);
	});
});
