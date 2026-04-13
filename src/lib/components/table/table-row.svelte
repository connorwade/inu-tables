<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let { children, ...restProps }: { children: Snippet } & SvelteHTMLElements['tr'] = $props();
</script>

<tr {...restProps}>
	{@render children()}
</tr>
