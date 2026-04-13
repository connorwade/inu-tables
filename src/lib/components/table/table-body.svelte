<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let { children, ...restProps }: { children: Snippet } & SvelteHTMLElements['tbody'] = $props();
</script>

<tbody {...restProps}>
	{@render children()}
</tbody>
