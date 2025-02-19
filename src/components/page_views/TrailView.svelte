<script lang="ts">
	import { Traverse } from "src/graph/traverse";
	import type BreadcrumbsPlugin from "src/main";
	import { active_file_store } from "src/stores/active_file";
	import TrailViewGrid from "./TrailViewGrid.svelte";
	import TrailViewPath from "./TrailViewPath.svelte";

	export let plugin: BreadcrumbsPlugin;

	const all_paths =
		$active_file_store &&
		// Even tho we ensure the graph is built before the views are registered,
		// Existing views still try render before the graph is built.
		plugin.graph.hasNode($active_file_store.path)
			? plugin.settings.hierarchies
					.map((_hierarchy, i) =>
						Traverse.all_paths(
							"depth_first",
							plugin.graph,
							$active_file_store!.path,
							(edge) =>
								edge.attr.dir === "up" &&
								// Here, we ensure an edge is only considered part of a path if it is from the same hierarchy as the previous edges
								edge.attr.hierarchy_i === i,
						),
					)
					.flat()
					// This basic sorting can break the continuity of the grid-areas.
					// A better solution would sort the rows to maximise run length.
					.sort((a, b) => b.length - a.length)
			: [];

	$: selected_paths =
		plugin.settings.views.page.trail.selection === "all"
			? all_paths
			: plugin.settings.views.page.trail.selection === "shortest"
				? all_paths.slice(-1)
				: [[]];

	$: MAX_DEPTH = Math.max(0, ...selected_paths.map((p) => p.length));

	$: depth = Math.min(
		MAX_DEPTH,
		plugin.settings.views.page.trail.default_depth,
	);

	$: sliced_paths = selected_paths.map((path) => path.slice(0, depth));
</script>

<div>
	{#key sliced_paths}
		{#if sliced_paths.length}
			<div class="mb-1.5 flex justify-between gap-3">
				<select
					bind:value={plugin.settings.views.page.trail.format}
					on:change={async () => await plugin.saveSettings()}
				>
					{#each ["grid", "path"] as format}
						<option value={format}> {format} </option>
					{/each}
				</select>

				<select
					bind:value={plugin.settings.views.page.trail.selection}
					on:change={async () => await plugin.saveSettings()}
				>
					{#each ["all", "shortest"] as s}
						<option value={s}> {s} </option>
					{/each}
				</select>

				<div class="flex items-center gap-2">
					<button
						title="Decrease depth"
						disabled={depth <= 1}
						on:click={() => (depth = Math.max(1, depth - 1))}
					>
						-
					</button>

					<code title="depth">{depth}</code>

					<button
						title="Increase depth"
						disabled={depth >= MAX_DEPTH}
						on:click={() =>
							(depth = Math.min(MAX_DEPTH, depth + 1))}
					>
						+
					</button>
				</div>
			</div>

			{#if plugin.settings.views.page.trail.format === "grid"}
				<TrailViewGrid {plugin} all_paths={sliced_paths} />
			{:else if plugin.settings.views.page.trail.format === "path"}
				<TrailViewPath {plugin} all_paths={sliced_paths} />
			{/if}
		{:else}
			<p class="BC-trail-view-no-path">
				{plugin.settings.views.page.trail.no_path_message}
			</p>
		{/if}
	{/key}
</div>
