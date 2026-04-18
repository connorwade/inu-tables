import { query } from '$app/server';
import { z } from 'zod';
import { makeData } from '../makeData.ts';

export const getData = query(z.number(), async (i) => {
	return makeData(i);
});
