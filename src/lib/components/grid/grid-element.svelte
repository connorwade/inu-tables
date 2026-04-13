<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let { children, ...restProps }: { children: Snippet } & SvelteHTMLElements['div'] = $props();
</script>

<div role="table" {...restProps}>
	{@render children()}
</div>
