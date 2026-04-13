<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	let {
		children,
		...restProps
	}: {
		children: Snippet;
	} & SvelteHTMLElements['th'] = $props();
</script>

<th {...restProps}>
	{@render children()}
</th>
