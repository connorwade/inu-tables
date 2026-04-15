<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<main>
	{@render children()}
</main>
