import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { ServerTableState } from './server-table.svelte.js';
import type { ServerTableParams, ServerTableResult } from './server-types.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type Person = { name: string; age: number };

const people: Person[] = [
	{ name: 'Alice', age: 30 },
	{ name: 'Bob', age: 25 },
	{ name: 'Carol', age: 35 },
	{ name: 'Dave', age: 28 },
	{ name: 'Eve', age: 22 }
];

/**
 * A minimal in-process fetch function that applies the same params as the
 * real server would. Returns a resolved promise so async assertions are
 * straightforward without network latency.
 */
function makeFetch(dataset: Person[] = people) {
	return vi.fn(async (params: ServerTableParams): Promise<ServerTableResult<Person>> => {
		let data = [...dataset];

		// Filtering
		for (const [id, val] of Object.entries(params.filters)) {
			if (val === undefined || val === '') continue;
			if (id === 'name') {
				const q = String(val).toLowerCase();
				data = data.filter((r) => r.name.toLowerCase().includes(q));
			}
			if (id === 'age') {
				const min = Number(val);
				data = data.filter((r) => r.age >= min);
			}
		}

		// Global search — case-insensitive substring across name and age
		if (params.search) {
			const q = params.search.toLowerCase();
			data = data.filter((r) => r.name.toLowerCase().includes(q) || String(r.age).includes(q));
		}

		// Sorting
		if (params.sortBy) {
			const { id, direction } = params.sortBy;
			const mul = direction === 'ascending' ? 1 : -1;
			data.sort((a, b) => {
				const av = a[id as keyof Person];
				const bv = b[id as keyof Person];
				return (av < bv ? -1 : av > bv ? 1 : 0) * mul;
			});
		}

		const rowCount = data.length;
		const start = params.pageIndex * params.pageSize;
		return { rows: data.slice(start, start + params.pageSize), rowCount };
	});
}

// ---------------------------------------------------------------------------
// Helper — instantiates ServerTableState inside a detached reactive root so
// that $effect runs, and returns a cleanup function.
// ---------------------------------------------------------------------------

let cleanupFn: (() => void) | null = null;

function makeTable(fetch = makeFetch(), pageSize = 10): ServerTableState<Person> {
	let table!: ServerTableState<Person>;

	cleanupFn = $effect.root(() => {
		table = new ServerTableState<Person>({
			columns: [
				{ accessorKey: 'name', header: 'Name', sortable: true, filterable: true },
				{
					accessorKey: 'age',
					header: 'Age',
					sortable: true,
					filterable: true,
					filterType: 'number'
				}
			],
			fetch,
			pageSize
		});
	});

	return table;
}

afterEach(() => {
	cleanupFn?.();
	cleanupFn = null;
});

// Waits until loading is false (the current fetch has resolved).
async function settled(table: ServerTableState<Person>) {
	flushSync(); // trigger any pending reactive effects
	await vi.waitFor(() => expect(table.loading).toBe(false), { timeout: 2_000 });
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('ServerTableState construction', () => {
	it('creates the correct number of columns', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.columns.length).toBe(2);
	});

	it('fires an initial fetch on construction', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		await settled(table);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('populates rows after the initial fetch resolves', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.rows.length).toBe(5);
	});

	it('sets rowCount from the server response', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.rowCount).toBe(5);
	});

	it('sets loading=true while the fetch is in flight', async () => {
		let resolveP!: (r: ServerTableResult<Person>) => void;
		const slowFetch = vi.fn(
			() =>
				new Promise<ServerTableResult<Person>>((resolve) => {
					resolveP = resolve;
				})
		);

		const table = makeTable(slowFetch as typeof slowFetch);
		flushSync();

		// Loading should be true while the promise is pending
		expect(table.loading).toBe(true);

		// Resolve the fetch and confirm loading clears
		resolveP({ rows: [], rowCount: 0 });
		await vi.waitFor(() => expect(table.loading).toBe(false));
	});

	it('sets default pageSize to 10', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.pageSize).toBe(10);
	});

	it('respects a custom pageSize', async () => {
		const table = makeTable(makeFetch(), 20);
		await settled(table);
		expect(table.pageSize).toBe(20);
	});

	it('builds cells for each row', async () => {
		const table = makeTable();
		await settled(table);
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells.length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// getCellsForRow
// ---------------------------------------------------------------------------

describe('getCellsForRow', () => {
	it('returns cells in column-definition order', async () => {
		const table = makeTable();
		await settled(table);
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].column.id).toBe('name');
		expect(cells[1].column.id).toBe('age');
	});

	it('returns correct cell values via the column accessor', async () => {
		const table = makeTable();
		await settled(table);
		const cells = table.getCellsForRow(table.rows[0]);
		expect(cells[0].value).toBe('Alice');
		expect(cells[1].value).toBe(30);
	});

	it('returns an empty array for an unknown row', async () => {
		const table = makeTable();
		await settled(table);
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
	it('returns all columns by default', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.visibleColumns.length).toBe(2);
	});

	it('excludes a hidden column', async () => {
		const table = makeTable();
		await settled(table);
		table.columns[1].show = false;
		expect(table.visibleColumns.length).toBe(1);
		expect(table.visibleColumns[0].id).toBe('name');
	});
});

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

describe('sorting', () => {
	it('toggleSort sets ascending direction on first call', async () => {
		const table = makeTable();
		await settled(table);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy?.direction).toBe('ascending');
		expect(table.sortBy?.column).toBe(table.columns[0]);
	});

	it('toggleSort switches to descending on second call', async () => {
		const table = makeTable();
		await settled(table);
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy?.direction).toBe('descending');
	});

	it('toggleSort clears sort on third call', async () => {
		const table = makeTable();
		await settled(table);
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy).toBeNull();
	});

	it('toggleSort is a no-op for non-sortable columns', async () => {
		let table!: ServerTableState<Person>;
		cleanupFn = $effect.root(() => {
			table = new ServerTableState<Person>({
				columns: [{ accessorKey: 'name', header: 'Name' }],
				fetch: makeFetch()
			});
		});
		await settled(table);
		table.toggleSort(table.columns[0]);
		expect(table.sortBy).toBeNull();
	});

	it('passes sortBy params to the fetch function', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		await settled(table);

		fetch.mockClear();
		table.toggleSort(table.columns[0]);
		await settled(table);

		expect(fetch).toHaveBeenCalledWith(
			expect.objectContaining({
				sortBy: { id: 'name', direction: 'ascending' }
			})
		);
	});

	it('sorts rows ascending by name via the fetch function', async () => {
		const table = makeTable();
		await settled(table);
		table.toggleSort(table.columns[0]);
		await settled(table);
		const names = table.rows.map((r) => r.data.name);
		expect(names).toEqual([...names].sort());
	});

	it('getSortDirection returns "none" initially', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.getSortDirection(table.columns[0])).toBe('none');
	});

	it('getSortDirection returns correct direction for the active column', async () => {
		const table = makeTable();
		await settled(table);
		table.toggleSort(table.columns[0]);
		expect(table.getSortDirection(table.columns[0])).toBe('ascending');
		expect(table.getSortDirection(table.columns[1])).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('filtering', () => {
	it('setFilter sets the column filter.value', async () => {
		const table = makeTable();
		await settled(table);
		table.setFilter(table.columns[0], 'alice');
		expect(table.columns[0].filter.value).toBe('alice');
	});

	it('setFilter resets pageIndex to 0', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		expect(table.pageIndex).toBe(1);
		table.setFilter(table.columns[0], 'a');
		expect(table.pageIndex).toBe(0);
	});

	it('setFilter triggers a fetch with filter params', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		await settled(table);

		fetch.mockClear();
		table.setFilter(table.columns[0], 'ali');
		await settled(table);

		expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ filters: { name: 'ali' } }));
	});

	it('filter results update rowCount and rows', async () => {
		const table = makeTable();
		await settled(table);
		table.setFilter(table.columns[0], 'ali');
		await settled(table);
		expect(table.rows.length).toBe(1);
		expect(table.rows[0].data.name).toBe('Alice');
		expect(table.rowCount).toBe(1);
	});

	it('clearFilters resets all filter.values', async () => {
		const table = makeTable();
		await settled(table);
		table.setFilter(table.columns[0], 'alice');
		table.clearFilters();
		expect(table.columns[0].filter.value).toBeUndefined();
	});

	it('clearFilters resets pageIndex to 0', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		table.clearFilters();
		expect(table.pageIndex).toBe(0);
	});

	it('clearFilters triggers a fetch returning all rows', async () => {
		const table = makeTable();
		await settled(table);
		table.setFilter(table.columns[0], 'ali');
		await settled(table);
		table.clearFilters();
		await settled(table);
		expect(table.rowCount).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('pagination', () => {
	it('pageCount is derived from rowCount and pageSize', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		expect(table.pageCount).toBe(3); // ceil(5/2)
	});

	it('pageCount is at least 1 even when rowCount is 0', async () => {
		const table = makeTable(makeFetch([]), 10);
		await settled(table);
		expect(table.pageCount).toBe(1);
	});

	it('nextPage increments pageIndex', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		expect(table.pageIndex).toBe(1);
	});

	it('nextPage does not advance past the last page', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		table.nextPage();
		table.nextPage();
		await settled(table);
		expect(table.pageIndex).toBe(2);
	});

	it('prevPage decrements pageIndex', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		table.prevPage();
		expect(table.pageIndex).toBe(0);
	});

	it('prevPage does not go below 0', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.prevPage();
		expect(table.pageIndex).toBe(0);
	});

	it('setPage navigates to the given page', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.setPage(2);
		expect(table.pageIndex).toBe(2);
	});

	it('setPage clamps to last page when index is too large', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.setPage(999);
		await settled(table);
		expect(table.pageIndex).toBe(table.pageCount - 1);
	});

	it('setPage clamps to 0 when index is negative', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.setPage(-5);
		expect(table.pageIndex).toBe(0);
	});

	it('page change triggers a fetch with the new pageIndex', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch, 2);
		await settled(table);

		fetch.mockClear();
		table.nextPage();
		await settled(table);

		expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 1 }));
	});

	it('returns the correct slice for page 1', async () => {
		const table = makeTable(makeFetch(), 2);
		await settled(table);
		table.nextPage();
		await settled(table);
		// Page 0 = Alice, Bob. Page 1 = Carol, Dave.
		expect(table.rows[0].data.name).toBe('Carol');
	});
});

// ---------------------------------------------------------------------------
// Selection (page-local)
// ---------------------------------------------------------------------------

describe('selection', () => {
	it('no rows are selected initially', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.rows.every((r) => !r.selected)).toBe(true);
	});

	it('allSelected is false initially', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.allSelected).toBe(false);
	});

	it('someSelected is false initially', async () => {
		const table = makeTable();
		await settled(table);
		expect(table.someSelected).toBe(false);
	});

	it('selectRow toggles a single row', async () => {
		const table = makeTable();
		await settled(table);
		table.selectRow(table.rows[0]);
		expect(table.rows[0].selected).toBe(true);
		table.selectRow(table.rows[0]);
		expect(table.rows[0].selected).toBe(false);
	});

	it('someSelected is true when some but not all rows are selected', async () => {
		const table = makeTable();
		await settled(table);
		table.selectRow(table.rows[0]);
		expect(table.someSelected).toBe(true);
		expect(table.allSelected).toBe(false);
	});

	it('selectAll(true) selects every row on the current page', async () => {
		const table = makeTable();
		await settled(table);
		table.selectAll(true);
		expect(table.rows.every((r) => r.selected)).toBe(true);
		expect(table.allSelected).toBe(true);
	});

	it('someSelected is false when all rows are selected', async () => {
		const table = makeTable();
		await settled(table);
		table.selectAll(true);
		expect(table.someSelected).toBe(false);
	});

	it('selectAll(false) deselects every row', async () => {
		const table = makeTable();
		await settled(table);
		table.selectAll(true);
		table.selectAll(false);
		expect(table.rows.every((r) => !r.selected)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
	it('sets error when the fetch rejects', async () => {
		const failFetch = vi.fn().mockRejectedValue(new Error('network error'));
		const table = makeTable(failFetch as unknown as ReturnType<typeof makeFetch>);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));
		expect(table.error).toBeInstanceOf(Error);
		expect(table.error?.message).toBe('network error');
	});

	it('sets loading to false after a failed fetch', async () => {
		const failFetch = vi.fn().mockRejectedValue(new Error('oops'));
		const table = makeTable(failFetch as unknown as ReturnType<typeof makeFetch>);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));
		expect(table.loading).toBe(false);
	});

	it('does not replace rows on a failed fetch', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		await settled(table);

		const originalRows = table.rows;

		fetch.mockRejectedValueOnce(new Error('transient error'));
		table.setFilter(table.columns[0], 'ali');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		// rows from the previous successful fetch should still be present
		expect(table.rows).toBe(originalRows);
	});

	it('clears error on a subsequent successful fetch', async () => {
		const fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('first call fails'))
			.mockResolvedValue({ rows: people, rowCount: people.length });

		const table = makeTable(fetch as unknown as ReturnType<typeof makeFetch>);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));
		expect(table.error).not.toBeNull();

		// Trigger another fetch — should succeed and clear the error
		table.setFilter(table.columns[0], 'a');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));
		expect(table.error).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Race condition — stale response discarding
// ---------------------------------------------------------------------------

describe('race conditions', () => {
	it('discards a slow response superseded by a faster one', async () => {
		let resolveFirst!: (r: ServerTableResult<Person>) => void;
		let callCount = 0;

		const raceFetch = vi.fn(async (): Promise<ServerTableResult<Person>> => {
			callCount++;
			if (callCount === 1) {
				// First call hangs until resolved manually
				return new Promise<ServerTableResult<Person>>((resolve) => {
					resolveFirst = resolve;
				});
			}
			// Second call resolves immediately with real data
			return { rows: [{ name: 'Fast', age: 1 }], rowCount: 1 };
		});

		const table = makeTable(raceFetch as unknown as ReturnType<typeof makeFetch>);
		flushSync(); // triggers call 1 (slow)

		// Trigger call 2 (fast) before call 1 resolves
		table.setFilter(table.columns[0], 'x');
		flushSync();

		// Let call 2 resolve
		await vi.waitFor(() => expect(table.loading).toBe(false));

		// Now resolve the stale first call — its response should be discarded
		resolveFirst({ rows: [{ name: 'Stale', age: 99 }], rowCount: 1 });
		await new Promise((r) => setTimeout(r, 50)); // small settle window

		expect(table.rows[0]?.data.name).toBe('Fast');
	});
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('search', () => {
	it('setSearch sets searchQuery and resets pageIndex to 0', async () => {
		const table = makeTable();
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		table.pageIndex = 1;
		table.setSearch('alice');

		expect(table.searchQuery).toBe('alice');
		expect(table.pageIndex).toBe(0);
	});

	it('setSearch triggers a fetch with the search param included', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		fetch.mockClear();
		table.setSearch('Alice');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		expect(fetch).toHaveBeenCalledTimes(1);
		const params: ServerTableParams = fetch.mock.calls[0][0];
		expect(params.search).toBe('Alice');
	});

	it('updates rows based on search results from the server', async () => {
		const table = makeTable();
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		table.setSearch('alice');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		expect(table.rows.length).toBe(1);
		expect(table.rows[0].data.name).toBe('Alice');
		expect(table.rowCount).toBe(1);
	});

	it('sends search: undefined when searchQuery is empty', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		// First set a non-empty search so the state actually changes when we clear it
		table.setSearch('alice');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		// Now clear the search — this should trigger a fetch without a search param
		fetch.mockClear();
		table.setSearch('');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		expect(fetch).toHaveBeenCalledTimes(1);
		const params: ServerTableParams = fetch.mock.calls[0][0];
		expect(params.search).toBeUndefined();
	});

	it('clearFilters also clears searchQuery and triggers a full-data fetch', async () => {
		const fetch = makeFetch();
		const table = makeTable(fetch);
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		table.setSearch('alice');
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		expect(table.rowCount).toBe(1);

		fetch.mockClear();
		table.clearFilters();
		flushSync();
		await vi.waitFor(() => expect(table.loading).toBe(false));

		expect(table.searchQuery).toBe('');
		expect(table.rowCount).toBe(5);
		const params: ServerTableParams = fetch.mock.calls[0][0];
		expect(params.search).toBeUndefined();
	});
});
