<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let { children, ...restProps }: { children: Snippet } & SvelteHTMLElements['thead'] = $props();
</script>

<thead {...restProps}>
	{@render children()}
</thead>
