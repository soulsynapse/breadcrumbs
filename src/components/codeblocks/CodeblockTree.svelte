<script lang="ts">
	import { Traverse } from "src/graph/traverse";
	import type { ICodeblock } from "src/interfaces/codeblocks";
	import type { BreadcrumbsError } from "src/interfaces/graph";
	import type BreadcrumbsPlugin from "src/main";
	import { active_file_store } from "src/stores/active_file";
	import FlatEdgeList from "../FlatEdgeList.svelte";
	import NestedEdgeList from "../NestedEdgeList.svelte";
	import { get_edge_sorter } from "src/graph/utils";

	export let plugin: BreadcrumbsPlugin;
	export let options: ICodeblock["Options"];
	export let errors: BreadcrumbsError[];

	const all_paths = $active_file_store
		? Traverse.all_paths(
				"depth_first",
				plugin.graph,
				$active_file_store.path,
				(e) =>
					e.attr.dir === options.dir &&
					(!options.dataview_from_paths ||
						options.dataview_from_paths.includes(e.target_id)) &&
					(!options.fields ||
						options.fields.includes(e.attr.field as string)),
			)
		: [];

	const sliced = all_paths.map((path) =>
		path.slice(options.depth[0], options.depth[1]),
	);

	const sort = get_edge_sorter(options.sort);
</script>

<div class="BC-codeblock-tree">
	{#if errors.length}
		<h3 class="text-red-500">Breadcrumbs Codeblock Errors</h3>

		<ul class="BC-codeblock-tree-errors">
			{#each errors as error}
				<li>
					<code>{error.message}</code>
				</li>
			{/each}
		</ul>
	{/if}

	{#if options.title}
		<h3 class="BC-codeblock-tree-title">
			{options.title}
		</h3>
	{/if}

	<div class="BC-codeblock-tree-items">
		{#if sliced.length}
			{#if !options.flat}
				<NestedEdgeList
					{sort}
					{plugin}
					nested_edges={Traverse.nest_all_paths(sliced)}
					show_node_options={plugin.settings.codeblocks
						.show_node_options}
				/>
			{:else}
				<FlatEdgeList
					{sort}
					{plugin}
					flat_edges={Traverse.flatten_all_paths(sliced)}
					show_node_options={plugin.settings.codeblocks
						.show_node_options}
				/>
			{/if}
		{/if}
	</div>
</div>
