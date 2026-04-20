import { query } from '$app/server';
import { z } from 'zod';
import { makeData, type Person } from '../makeData.js';

// ---------------------------------------------------------------------------
// Simulated server database — generated once at module load, stable across
// requests (same as a real DB that doesn't change between calls).
// ---------------------------------------------------------------------------

const db: Person[] = makeData(10_000);

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type PersonPage = {
	rows: Person[];
	/** Total number of rows matching the current filters/search (before pagination). */
	rowCount: number;
};

// ---------------------------------------------------------------------------
// Zod schema for the query parameters
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
	filters: z.record(
		z.string(),
		z
			.union([
				z.string(),
				z.object({ min: z.number().optional(), max: z.number().optional() }),
				z.object({
					min: z.union([z.string(), z.instanceof(Date)]).optional(),
					max: z.union([z.string(), z.instanceof(Date)]).optional()
				})
			])
			.optional()
	),
	search: z.string().optional()
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
	async (params): Promise<PersonPage> => {
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
		if (filters['age']) {
			const range = filters['age'] as { min?: number; max?: number };
			if (range.min !== undefined && !isNaN(range.min))
				data = data.filter((r) => r.age >= range.min!);
			if (range.max !== undefined && !isNaN(range.max))
				data = data.filter((r) => r.age <= range.max!);
		}
		if (filters['visits']) {
			const range = filters['visits'] as { min?: number; max?: number };
			if (range.min !== undefined && !isNaN(range.min))
				data = data.filter((r) => r.visits >= range.min!);
			if (range.max !== undefined && !isNaN(range.max))
				data = data.filter((r) => r.visits <= range.max!);
		}
		if (filters['progress']) {
			const range = filters['progress'] as { min?: number; max?: number };
			if (range.min !== undefined && !isNaN(range.min))
				data = data.filter((r) => r.progress >= range.min!);
			if (range.max !== undefined && !isNaN(range.max))
				data = data.filter((r) => r.progress <= range.max!);
		}

		// --- Global search -------------------------------------------------------
		if (params.search) {
			const q = params.search.toLowerCase();
			data = data.filter(
				(r) =>
					r.firstName.toLowerCase().includes(q) ||
					r.lastName.toLowerCase().includes(q) ||
					r.status.toLowerCase().includes(q) ||
					String(r.age).includes(q) ||
					String(r.visits).includes(q) ||
					String(r.progress).includes(q)
			);
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
