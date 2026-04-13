import { query } from '$app/server';
import { z } from 'zod';
import { makeData, type Person } from '../makeData.js';
import type { ServerTableResult } from '$lib/server-types.js';

// ---------------------------------------------------------------------------
// Simulated server database — generated once at module load, stable across
// requests (same as a real DB that doesn't change between calls).
// ---------------------------------------------------------------------------

const db: Person[] = makeData(10_000);

// ---------------------------------------------------------------------------
// Zod schema mirroring ServerTableParams
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
	pageIndex: z.number().int().min(0),
	pageSize: z.number().int().min(1).max(200),
	sortBy: z
		.object({
			id: z.string(),
			direction: z.enum(['ascending', 'descending'])
		})
		.nullable(),
	filters: z.record(z.string(), z.union([z.string(), z.number()]).optional())
});

// ---------------------------------------------------------------------------
// Remote function
// ---------------------------------------------------------------------------

/**
 * Server-side data function for the server-side table demo.
 *
 * Applies filtering, sorting, and pagination entirely on the server and
 * returns only the requested page together with the total matching row count.
 */
export const getPersons = query(
	paramsSchema,
	async (params): Promise<ServerTableResult<Person>> => {
		let data = db as Person[];

		// --- Filtering -----------------------------------------------------------
		const { filters } = params;

		if (filters['firstName'] !== undefined && filters['firstName'] !== '') {
			const q = String(filters['firstName']).toLowerCase();
			data = data.filter((r) => r.firstName.toLowerCase().includes(q));
		}
		if (filters['lastName'] !== undefined && filters['lastName'] !== '') {
			const q = String(filters['lastName']).toLowerCase();
			data = data.filter((r) => r.lastName.toLowerCase().includes(q));
		}
		if (filters['status'] !== undefined && filters['status'] !== '') {
			const q = String(filters['status']).toLowerCase();
			data = data.filter((r) => r.status.toLowerCase().includes(q));
		}
		if (filters['age'] !== undefined && filters['age'] !== '') {
			const min = Number(filters['age']);
			if (!isNaN(min)) data = data.filter((r) => r.age >= min);
		}
		if (filters['visits'] !== undefined && filters['visits'] !== '') {
			const min = Number(filters['visits']);
			if (!isNaN(min)) data = data.filter((r) => r.visits >= min);
		}
		if (filters['progress'] !== undefined && filters['progress'] !== '') {
			const min = Number(filters['progress']);
			if (!isNaN(min)) data = data.filter((r) => r.progress >= min);
		}

		// --- Sorting -------------------------------------------------------------
		if (params.sortBy) {
			const { id, direction } = params.sortBy;
			const mul = direction === 'ascending' ? 1 : -1;

			data = [...data].sort((a, b) => {
				const av = a[id as keyof Person];
				const bv = b[id as keyof Person];
				if (av == null && bv == null) return 0;
				if (av == null) return 1;
				if (bv == null) return -1;
				return (av < bv ? -1 : av > bv ? 1 : 0) * mul;
			});
		}

		// --- Pagination ----------------------------------------------------------
		const rowCount = data.length;
		const start = params.pageIndex * params.pageSize;
		const rows = data.slice(start, start + params.pageSize);

		return { rows, rowCount };
	}
);
