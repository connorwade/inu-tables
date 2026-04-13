<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let { children, ...restProps }: { children: Snippet } & SvelteHTMLElements['td'] = $props();
</script>

<td {...restProps}>
	{@render children()}
</td>
