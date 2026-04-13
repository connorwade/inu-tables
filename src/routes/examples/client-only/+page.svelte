<script lang="ts">
	import { TableState } from '$lib/index.js';
	import { makeData, type Person } from '../makeData.js';

	const tableState = new TableState<Person>({
		data: makeData(1000),
		columns: [
			{
				accessorKey: 'firstName',
				header: 'First Name',
				sortable: true,
				filterable: true
			},
			{
				accessorKey: 'lastName',
				header: 'Last Name',
				sortable: true,
				filterable: true
			},
			{
				accessorKey: 'age',
				header: 'Age',
				sortable: true,
				filterable: true,
				filterType: 'number'
			},
			{
				accessorKey: 'visits',
				header: 'Visits',
				sortable: true,
				filterable: true,
				filterType: 'number'
			},
			{
				accessorKey: 'status',
				header: 'Status',
				sortable: true,
				filterable: true
			},
			{
				accessorKey: 'progress',
				header: 'Progress',
				sortable: true,
				filterable: true,
				filterType: 'number'
			}
		],
		pageSize: 10
	});

	let selectAllEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (selectAllEl) {
			selectAllEl.indeterminate = tableState.someSelected;
		}
	});

	$effect(() => {
		// Reset to first page whenever any filter changes
		for (const col of tableState.columns) col.filterValue;
		tableState.setPage(0);
	});

	function getSortIndicator(col: (typeof tableState.columns)[number]): string {
		const dir = tableState.getSortDirection(col);
		if (dir === 'ascending') return '↑';
		if (dir === 'descending') return '↓';
		return '↕';
	}

	function getStatusClass(status: string): string {
		if (status === 'relationship') return 'bg-blue-100 text-blue-800';
		if (status === 'complicated') return 'bg-yellow-100 text-yellow-800';
		return 'bg-green-100 text-green-800';
	}

	const anyFiltered = $derived(tableState.columns.some((c) => c.isFiltered));
</script>

<div class="max-w-full p-6">
	<h1 class="mb-4 text-2xl font-bold text-gray-800">Client-Only Table Demo</h1>

	<!-- Column Visibility Toggles -->
	<div class="mb-4 flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
		<span class="self-center text-sm font-semibold text-gray-600">Columns:</span>
		{#each tableState.columns as col (col.id)}
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
				Showing <strong>{tableState.filteredRows.length}</strong> of
				<strong>{tableState.rows.length}</strong> rows
			</span>
			<button
				onclick={() => tableState.clearFilters()}
				class="cursor-pointer rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
			>
				Clear filters
			</button>
		</div>
	{/if}

	<!-- Table -->
	<div class="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
		<table class="w-full border-collapse text-sm">
			<thead class="bg-gray-50">
				<!-- Column Headers -->
				<tr>
					<!-- Select All -->
					<th class="w-10 border-b border-gray-200 px-3 py-2 text-center">
						<input
							type="checkbox"
							bind:this={selectAllEl}
							checked={tableState.allSelected}
							onchange={(e) => tableState.selectAll((e.target as HTMLInputElement).checked)}
							class="cursor-pointer rounded border-gray-300 text-blue-600"
						/>
					</th>
					{#each tableState.visibleColumns as col (col.id)}
						<th
							class="border-b border-gray-200 px-4 py-2 text-left font-semibold whitespace-nowrap text-gray-700"
							aria-sort={tableState.getSortDirection(col)}
						>
							{#if col.sortable}
								<button
									onclick={() => tableState.toggleSort(col)}
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
					{#each tableState.visibleColumns as col (col.id)}
						<td class="border-b border-gray-200 px-4 py-1">
							{#if col.filterable}
								{#if col.filterType === 'number'}
									<input
										type="number"
										placeholder="min…"
										class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
										bind:value={col.filterValue as number}
									/>
								{:else}
									<input
										type="text"
										placeholder="Filter…"
										class="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
										bind:value={col.filterValue as string}
									/>
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each tableState.paginatedRows as row, i (row)}
					<tr
						class={[
							'border-b border-gray-100 transition-colors',
							row.selected
								? 'bg-blue-50'
								: i % 2 === 0
									? 'bg-white hover:bg-gray-50'
									: 'bg-gray-50/50 hover:bg-gray-100/50'
						].join(' ')}
					>
						<!-- Row Checkbox -->
						<td class="px-3 py-2 text-center">
							<input
								type="checkbox"
								checked={row.selected}
								onchange={() => tableState.selectRow(row)}
								class="cursor-pointer rounded border-gray-300 text-blue-600"
							/>
						</td>
						{#each tableState
							.getCellsForRow(row)
							.filter((cell) => cell.column.show) as cell (cell.column.id)}
							<td class="px-4 py-2 text-gray-700">
								{#if cell.column.id === 'progress'}
									<!-- Progress Bar -->
									<div class="flex items-center gap-2">
										<div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
											<div
												class="h-2 rounded-full bg-blue-500 transition-all"
												style="width: {Number(cell.value)}%"
											></div>
										</div>
										<span class="w-8 text-right text-xs text-gray-500">{Number(cell.value)}%</span>
									</div>
								{:else if cell.column.id === 'status'}
									<!-- Status Badge -->
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusClass(
											String(cell.value)
										)}"
									>
										{String(cell.value)}
									</span>
								{:else}
									{String(cell.value)}
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
					bind:value={tableState.pageSize}
					onchange={() => tableState.setPage(0)}
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
				onclick={() => tableState.prevPage()}
				disabled={tableState.pageIndex === 0}
				class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				← Prev
			</button>

			<span class="px-2 text-sm text-gray-600">
				Page <strong>{tableState.pageIndex + 1}</strong> of <strong>{tableState.pageCount}</strong>
				&nbsp;|&nbsp;
				<strong>{tableState.filteredRows.length}</strong> results
			</span>

			<button
				onclick={() => tableState.nextPage()}
				disabled={tableState.pageIndex >= tableState.pageCount - 1}
				class="cursor-pointer rounded border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
			>
				Next →
			</button>
		</div>
	</div>
</div>
