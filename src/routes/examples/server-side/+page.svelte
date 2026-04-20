<script lang="ts">
	import { NumberColumnFilter } from '$lib/index.js';
	import TableModel from '$lib/table-model.svelte.js';
	import { GlobalSearchState, PaginationState, SortingState } from '$lib/state.svelte.js';
	import { getPersons } from './data.remote.js';
	import type { PersonPage } from './data.remote.js';
	import type { Person } from '../makeData.js';

	const sorting = new SortingState<Person>();
	const globalSearch = new GlobalSearchState<Person>();
	const pagination = new PaginationState({ pageSize: 10 });

	const table = new TableModel<Person>({
		data: () => result.rows,
		columns: [
			{ accessorKey: 'firstName', header: 'First Name', sortable: true, filterable: true },
			{ accessorKey: 'lastName', header: 'Last Name', sortable: true, filterable: true },
			{ accessorKey: 'age', header: 'Age', sortable: true, filterable: true, filterType: 'number' },
			{
				accessorKey: 'visits',
				header: 'Visits',
				sortable: true,
				filterable: true,
				filterType: 'number'
			},
			{ accessorKey: 'status', header: 'Status', sortable: true, filterable: true },
			{
				accessorKey: 'progress',
				header: 'Progress',
				sortable: true,
				filterable: true,
				filterType: 'number'
			}
		],
		rowKey: 'id',
		state: { sorting, pagination, globalSearch, rowCount: () => result.rowCount },
		options: {
			manualSorting: true,
			manualPagination: true,
			manualSearch: true,
			manualFiltering: true
		}
	});

	const { columnVisibility } = table;

	const result: PersonPage = $derived(
		await getPersons({
			pageIndex: pagination.pageIndex,
			pageSize: pagination.pageSize,
			sortBy:
				sorting.column && sorting.direction
					? { id: sorting.column.id, direction: sorting.direction }
					: null,
			filters: Object.fromEntries(
				table.columns.filter((c) => c.filterable).map((c) => [c.id, c.filter.value])
			),
			search: globalSearch.searchQuery.trim() || undefined
		})
	);

	function getSortIndicator(col: (typeof table.columns)[number]): string {
		const dir = sorting.getSortDirection(col);
		if (dir === 'ascending') return '↑';
		if (dir === 'descending') return '↓';
		return '↕';
	}

	function getStatusClass(status: string): string {
		if (status === 'relationship') return 'bg-blue-100 text-blue-800';
		if (status === 'complicated') return 'bg-yellow-100 text-yellow-800';
		return 'bg-green-100 text-green-800';
	}

	function clearFilters() {
		table.columns.forEach((col) => col.filter.reset());
		globalSearch.searchQuery = '';
		pagination.pageIndex = 0;
	}

	const anyFiltered = $derived(
		table.columns.some((c) => c.isFiltered) || globalSearch.searchQuery.trim() !== ''
	);
</script>

<div class="max-w-full p-6">
	<h1 class="mb-1 text-2xl font-bold text-gray-800">Server-Side Table Demo</h1>
	<p class="mb-4 text-sm text-gray-500 italic">
		All filtering, sorting and pagination happen on the server.
	</p>

	<!-- Column Visibility Toggles -->
	<div class="mb-4 flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
		<span class="self-center text-sm font-semibold text-gray-600">Columns:</span>
		{#each table.columns as col (col.id)}
			<label class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
				<input
					type="checkbox"
					bind:checked={col.show}
					class="rounded border-gray-300 text-blue-600"
				/>
				{col.header}
			</label>
		{/each}
	</div>

	<!-- Active Filter Badge -->
	{#if anyFiltered}
		<div class="mb-3 flex items-center gap-3">
			<span class="text-sm text-gray-600">
				Showing <strong>{result.rowCount}</strong> matching rows
			</span>
			<button
				onclick={clearFilters}
				class="cursor-pointer rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
			>
				Clear filters & search
			</button>
		</div>
	{/if}

	<!-- Search -->
	<div class="mb-3 flex items-center gap-2">
		<input
			type="search"
			placeholder="Search all columns…"
			bind:value={globalSearch.searchQuery}
			oninput={() => (pagination.pageIndex = 0)}
			class="w-full max-w-xs rounded border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none"
		/>
		{#if globalSearch.searchQuery}
			<span class="text-sm text-gray-500">
				{result.rowCount} result{result.rowCount === 1 ? '' : 's'}
			</span>
		{/if}
	</div>

	<svelte:boundary>
		{#snippet pending()}
			<div
				class="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
			>
				<div class="flex flex-col items-center gap-2">
					<svg
						class="h-8 w-8 animate-spin text-blue-500"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						></path>
					</svg>
					<span class="text-sm font-medium text-gray-500">Loading…</span>
				</div>
			</div>
		{/snippet}

		{#snippet failed(error, reset)}
			<div
				class="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3"
			>
				<div class="flex items-center gap-2 text-sm text-red-800">
					<span class="font-semibold">Error:</span>
					<span>{error instanceof Error ? error.message : String(error)}</span>
				</div>
				<button
					onclick={() => {
						clearFilters();
						sorting.column = null;
						sorting.direction = null;
						reset();
					}}
					class="cursor-pointer rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
				>
					Retry
				</button>
			</div>
		{/snippet}

		<div class={['transition-opacity', $effect.pending() && 'opacity-40']}>
			<div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
				<table class="w-full border-collapse text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="w-10 border-b border-gray-200 px-3 py-2 text-center">
								<input
									type="checkbox"
									checked={table.allSelected}
									indeterminate={table.someSelected}
									onchange={() => (table.allSelected ? table.deselectAll() : table.selectAll())}
									class="cursor-pointer rounded border-gray-300 text-blue-600"
								/>
							</th>
							{#each columnVisibility!.visibleColumns as col (col.id)}
								<th
									class="border-b border-gray-200 px-4 py-2 text-left font-semibold whitespace-nowrap text-gray-700"
									aria-sort={sorting.getSortDirection(col)}
								>
									{#if col.sortable}
										<button
											onclick={() => {
												sorting.toggleSort(col);
												pagination.pageIndex = 0;
											}}
											class="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-semibold text-gray-700 hover:text-blue-600"
										>
											{col.header}
											<span class="text-xs text-gray-400">{getSortIndicator(col)}</span>
										</button>
									{:else}
										{col.header}
									{/if}
								</th>
							{/each}
						</tr>
						<tr class="bg-white">
							<td class="border-b border-gray-200 px-3 py-1"></td>
							{#each columnVisibility!.visibleColumns as col (col.id)}
								<td class="border-b border-gray-200 px-4 py-1">
									{#if col.filterable}
										{#if col.filter instanceof NumberColumnFilter}
											<div class="flex gap-1">
												<input
													type="number"
													placeholder="min"
													class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
													bind:value={(col.filter as NumberColumnFilter).value!.min}
													oninput={() => (pagination.pageIndex = 0)}
												/>
												<input
													type="number"
													placeholder="max"
													class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
													bind:value={(col.filter as NumberColumnFilter).value!.max}
													oninput={() => (pagination.pageIndex = 0)}
												/>
											</div>
										{:else if col.id === 'status'}
											<select
												bind:value={col.filter.value as string}
												onchange={() => (pagination.pageIndex = 0)}
												class="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
											>
												<option value="">All</option>
												<option value="relationship">Relationship</option>
												<option value="complicated">Complicated</option>
												<option value="single">Single</option>
											</select>
										{:else}
											<input
												type="text"
												placeholder="Filter…"
												bind:value={col.filter.value as string}
												oninput={() => (pagination.pageIndex = 0)}
												class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
											/>
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each table.visibleRows as row, i (row.id)}
							<tr
								class={[
									'border-b border-gray-100 transition-colors',
									table.isSelected(row.data)
										? 'bg-blue-50'
										: i % 2 === 0
											? 'bg-white hover:bg-gray-50'
											: 'bg-gray-50/50 hover:bg-gray-100/50'
								]}
							>
								<td class="px-3 py-2 text-center">
									<input
										type="checkbox"
										checked={table.isSelected(row.data)}
										onchange={() => table.toggleSelected(row.data)}
										class="cursor-pointer rounded border-gray-300 text-blue-600"
									/>
								</td>
								{#each table.getCells(row.data).filter((cell) => cell.column.show) as cell (cell.column.id)}
									<td class="px-4 py-2 text-gray-700">
										{#if cell.column.id === 'progress'}
											<div class="flex items-center gap-2">
												<div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
													<div
														class="h-2 rounded-full bg-blue-500 transition-all"
														style="width: {Number(cell.value)}%"
													></div>
												</div>
												<span class="w-8 text-right text-xs text-gray-500"
													>{Number(cell.value)}%</span
												>
											</div>
										{:else if cell.column.id === 'status'}
											<span
												class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusClass(String(cell.value))}"
											>
												{String(cell.value)}
											</span>
										{:else}
											{cell.displayValue}
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</svelte:boundary>

	<!-- Pagination -->
	<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<label class="flex items-center gap-1.5">
				Rows per page:
				<select
					bind:value={pagination.pageSize}
					onchange={() => (pagination.pageIndex = 0)}
					class="ml-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none"
				>
					{#each [5, 10, 20, 50] as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={() => pagination.pageIndex--}
				disabled={pagination.pageIndex === 0}
				class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				← Prev
			</button>

			<span class="px-2 text-sm text-gray-600">
				Page <strong>{pagination.pageIndex + 1}</strong> of
				<strong>{table.pageCount}</strong>
				&nbsp;|&nbsp;
				<strong>{result.rowCount}</strong> results
			</span>

			<button
				onclick={() => pagination.pageIndex++}
				disabled={pagination.pageIndex >= table.pageCount - 1}
				class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Next →
			</button>
		</div>
	</div>
</div>
