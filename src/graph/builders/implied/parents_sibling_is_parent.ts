import type { ImpliedEdgeBuilder } from "src/interfaces/graph";

export const _add_implied_edges_parents_sibling_is_parent: ImpliedEdgeBuilder =
	(graph, plugin) => {
		plugin.settings.hierarchies.forEach((hierarchy, hierarchy_i) => {
			if (!hierarchy.implied_relationships.parents_sibling_is_parent) {
				return;
			}

			graph.forEachNode((source_id) => {
				graph
					.get_dir_chains_path(
						source_id,
						["up", "same"],
						(edge) =>
							edge.attr.hierarchy_i === hierarchy_i &&
							edge.attr.explicit &&
							// Don't include the current source_id in the path
							edge.target_id !== source_id,
					)
					.forEach((path) => {
						graph.addDirectedEdge(
							source_id,
							path.last()!.target_id,
							{
								dir: "up",
								hierarchy_i,
								explicit: false,
								implied_kind: "parents_sibling_is_parent",
								field: hierarchy.dirs["up"].at(0) ?? null,
							},
						);
					});
			});
		});

		return {};
	};
