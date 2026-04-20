<script lang="ts">
	import { NumberColumnFilter } from '$lib/index.js';
	import TableModel from '$lib/table-model.svelte.js';
	import type { Person } from '../makeData.ts';
	import { getData } from './data.remote.ts';

	const table = new TableModel<Person>({
		data: await getData(10_000),
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
		rowKey: 'id'
	});

	const { sorting, pagination, globalSearch, columnVisibility } = table;

	function getSortIndicator(col: (typeof table.columns)[number]): string {
		const dir = sorting!.getSortDirection(col);
		if (dir === 'ascending') return '↑';
		if (dir === 'descending') return '↓';
		return '↕';
	}

	function getStatusClass(status: string): string {
		if (status === 'relationship') return 'bg-blue-100 text-blue-800';
		if (status === 'complicated') return 'bg-yellow-100 text-yellow-800';
		return 'bg-green-100 text-green-800';
	}

	const anyFiltered = $derived(
		table.columns.some((c) => c.isFiltered) || globalSearch!.searchQuery.trim() !== ''
	);
</script>

<svelte:boundary>
	{#snippet pending()}
		<div class="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
			<span class="text-sm text-gray-500">Loading data...</span>
		</div>
	{/snippet}
	<div class="max-w-full p-6">
		<h1 class="mb-4 text-2xl font-bold text-gray-800">Client-Only Table Demo</h1>

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
					Showing <strong>{table.filteredRows.length}</strong> of
					<strong>{table.rowCount}</strong> rows
				</span>
				<button
					onclick={() => {
						table.columns.forEach((col) => col.filter.reset());
						globalSearch!.searchQuery = '';
					}}
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
				bind:value={globalSearch!.searchQuery}
				class="w-full max-w-xs rounded border border-gray-200 bg-white px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none"
			/>
			{#if globalSearch!.searchQuery}
				<span class="text-sm text-gray-500">
					{table.filteredRows.length} result{table.filteredRows.length === 1 ? '' : 's'}
				</span>
			{/if}
		</div>

		<!-- Table -->
		<div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
			<table class="w-full border-collapse text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th class="w-10 border-b border-gray-200 px-3 py-2 text-center">
							<input
								type="checkbox"
								indeterminate={table.someSelected}
								checked={table.allSelected}
								onchange={() => (table.allSelected ? table.deselectAll() : table.selectAll())}
								class="cursor-pointer rounded border-gray-300 text-blue-600"
							/>
						</th>
						{#each columnVisibility!.visibleColumns as col (col.id)}
							<th
								class="border-b border-gray-200 px-4 py-2 text-left font-semibold whitespace-nowrap text-gray-700"
								aria-sort={sorting!.getSortDirection(col)}
							>
								{#if col.sortable}
									<button
										onclick={() => sorting!.toggleSort(col)}
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
					<!-- Filter Row -->
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
												min={0}
												max={(col.filter as NumberColumnFilter).value!.max}
												onchange={() => (pagination!.pageIndex = 0)}
											/>
											<input
												type="number"
												placeholder="max"
												class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
												bind:value={(col.filter as NumberColumnFilter).value!.max}
												min={(col.filter as NumberColumnFilter).value!.min}
												onchange={() => (pagination!.pageIndex = 0)}
											/>
										</div>
									{:else if col.id === 'status'}
										<select
											bind:value={col.filter.value as string}
											onchange={() => (pagination!.pageIndex = 0)}
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
											class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
											bind:value={col.filter.value as string}
											onchange={() => (pagination!.pageIndex = 0)}
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
							].join(' ')}
						>
							<td class="px-3 py-2 text-center">
								<input
									type="checkbox"
									checked={table.isSelected(row.data)}
									onchange={() => table.toggleSelected(row.data)}
									class="cursor-pointer rounded border-gray-300 text-blue-600"
								/>
							</td>
							{#each table
								.getCells(row.data)
								.filter((cell) => cell.column.show) as cell (cell.column.id)}
								<td class="px-4 py-2 text-gray-700">
									{#if cell.column.id === 'progress'}
										<div class="flex items-center gap-2">
											<div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
												<div
													class="h-2 rounded-full bg-blue-500 transition-all"
													style="width: {Number(cell.value)}%"
												></div>
											</div>
											<span class="w-8 text-right text-xs text-gray-500">{Number(cell.value)}%</span
											>
										</div>
									{:else if cell.column.id === 'status'}
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusClass(
												String(cell.value)
											)}"
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

		<!-- Pagination -->
		<div class="mt-4 flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-2 text-sm text-gray-600">
				<label class="flex items-center gap-1.5">
					Rows per page:
					<select
						bind:value={pagination!.pageSize}
						onchange={() => (pagination!.pageIndex = 0)}
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
					onclick={() => pagination!.pageIndex--}
					disabled={pagination!.pageIndex === 0}
					class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
				>
					← Prev
				</button>

				<span class="px-2 text-sm text-gray-600">
					Page <strong>{pagination!.pageIndex + 1}</strong> of
					<strong>{table.pageCount}</strong>
					&nbsp;|&nbsp;
					<strong>{table.filteredRows.length}</strong> results
				</span>

				<button
					onclick={() => pagination!.pageIndex++}
					disabled={pagination!.pageIndex >= table.pageCount - 1}
					class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Next →
				</button>
			</div>
		</div>
	</div>
</svelte:boundary>
