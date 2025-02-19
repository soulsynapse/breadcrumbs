import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS } from "src/const/settings";
import { VIEW_IDS } from "src/const/views";
import { rebuild_graph } from "src/graph/builders";
import type { BreadcrumbsSettings } from "src/interfaces/settings";
import { BreadcrumbsSettingTab } from "src/settings/SettingsTab";
import { active_file_store } from "src/stores/active_file";
import { MatrixView } from "src/views/matrix";
import { get } from "svelte/store";
import { Codeblocks } from "./codeblocks";
import { freeze_implied_edges_to_note } from "./commands/freeze_edges";
import { PROD } from "./const";
import { dataview_plugin } from "./external/dataview";
import { BCGraph } from "./graph/MyMultiGraph";
import { stringify_edge } from "./graph/utils";
import { CreateListIndexModal } from "./modals/CreateListIndexModal";
import { migrate_old_settings } from "./settings/migration";
import { deep_merge_objects } from "./utils/objects";
import { redraw_page_views } from "./views/page";
import { TreeView } from "./views/tree";

export default class BreadcrumbsPlugin extends Plugin {
	settings!: BreadcrumbsSettings;
	graph = new BCGraph();

	async onload() {
		console.log("loading breadcrumbs");

		// Settings
		await this.loadSettings();

		/// Migrations
		await migrate_old_settings(this);

		this.addSettingTab(new BreadcrumbsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			console.log("onLayoutReady");

			await dataview_plugin.await_if_enabled(this);

			await this.refresh();

			// Events
			/// Workspace

			// NOTE: This is not needed, because layout-change is fired
			//   when a file is opened, and when switching editor modes
			// this.registerEvent(
			// 	this.app.workspace.on("file-open", async (file) => {
			// 		console.log("file-open");

			// 		active_file_store.set(file);

			// 		if (file) {
			// 			draw_page_views_on_active_note(this);
			// 		}
			// 	}),
			// );

			this.registerEvent(
				this.app.workspace.on("layout-change", () => {
					console.log("layout-change");

					this.refresh({
						rebuild_graph:
							this.settings.commands.rebuild_graph.trigger
								.layout_change,
					});
				}),
			);

			/// Vault
			this.registerEvent(
				this.app.vault.on("create", async (file) => {
					console.log("create", file.path);
					if (file instanceof TFile) {
						// This isn't perfect, but it stops any "node doesn't exist" errors
						// The user will have to refresh to add any relevant edges
						this.graph.safe_add_node(file.path, { resolved: true });

						await this.refresh({ rebuild_graph: false });
					}
				}),
			);

			this.registerEvent(
				this.app.vault.on("rename", async (file, old_path) => {
					console.log("rename", old_path, "->", file.path);
					if (file instanceof TFile) {
						this.graph.safe_rename_node(old_path, file.path);

						await this.refresh({ rebuild_graph: false });
					}
				}),
			);

			this.registerEvent(
				this.app.vault.on("delete", async (file) => {
					console.log("delete", file.path);
					if (file instanceof TFile) {
						// TODO: I think instead of dropping it, we should mark it as unresolved...
						//   Maybe.. it may depend on what added the node, and the edges in/out of it
						// Conveniently drops any relevant edges
						this.graph.dropNode(file.path);

						await this.refresh({ rebuild_graph: false });
					}
				}),
			);

			// Views
			this.registerView(
				VIEW_IDS.matrix,
				(leaf) => new MatrixView(leaf, this),
			);
			this.registerView(
				VIEW_IDS.tree,
				(leaf) => new TreeView(leaf, this),
			);

			// TODO: The codeblock doesn't rerender when changing notes
			// Codeblocks
			this.registerMarkdownCodeBlockProcessor(
				"breadcrumbs",
				Codeblocks.get_callback(this),
			);
		});

		// Commands
		this.addCommand({
			id: "breadcrumbs:rebuild-graph",
			name: "Rebuild graph",
			callback: async () => await this.refresh(),
		});

		Object.keys(VIEW_IDS).forEach((view_id) => {
			this.addCommand({
				id: `breadcrumbs:open-${view_id}-view`,
				name: `Open ${view_id} view`,
				callback: () =>
					this.activateView(
						VIEW_IDS[view_id as keyof typeof VIEW_IDS],
					),
			});
		});

		this.addCommand({
			id: "breadcrumbs:create-list-index",
			name: "Create list index",
			callback: () => {
				new CreateListIndexModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "breadcrumbs:freeze-implied-edges-to-note",
			name: "Freeze implied edges to note",
			callback: async () => {
				// TODO: Probably add an intermediate modal to specify options
				// The whole point is to make implied edges explicit
				// So once you freeze them, they'll be duplicated
				// So, in the options modal, you could temporarily enabled/disable certain implied_relations on the hierarchy
				// preventing duplicates for implied_relations that weren't properly enabled
				const active_file = get(active_file_store);
				if (!active_file) return;

				await freeze_implied_edges_to_note(
					this,
					active_file,
					this.settings.commands.freeze_implied_edges.default_options,
				);

				new Notice("Crumbs to note");
			},
		});

		if (!PROD) {
			this.addCommand({
				id: "breadcrumbs:test-command",
				name: "Test command",
				callback: () => {
					console.log("test command");

					console.log(
						this.graph
							.get_dir_chains_path(
								this.app.workspace.getActiveFile()?.path!,
								["up", "same"],
								(edge) => edge.attr.explicit,
							)
							.map((path) =>
								path.map((edge) => stringify_edge(edge)),
							),
					);
				},
			});
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = deep_merge_objects(
			(await this.loadData()) ?? {},
			DEFAULT_SETTINGS as any,
		);

		console.log("settings", this.settings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** rebuild_graph, then react by updating active_file_store and redrawing page_views.
	 * Optionally disable any of these steps.
	 */
	async refresh(options?: {
		rebuild_graph?: boolean;
		active_file_store?: boolean;
		redraw_page_views?: boolean;
	}) {
		console.log(
			"bc.refresh",
			["rebuild_graph", "active_file_store", "redraw_page_views"]
				.filter(
					(key) => options?.[key as keyof typeof options] !== false,
				)
				.join(", "),
		);

		// Rebuild the graph
		if (options?.rebuild_graph !== false) {
			const start_ms = Date.now();

			const notice = this.settings.commands.rebuild_graph.notify
				? new Notice("Rebuilding graph")
				: null;

			console.group("rebuild_graph");
			this.graph = await rebuild_graph(this);
			console.groupEnd();

			notice?.setMessage(`Rebuilt graph in ${Date.now() - start_ms}ms`);
		}

		// _Then_ react
		if (options?.active_file_store !== false) {
			active_file_store.refresh(this.app);
		}

		if (options?.redraw_page_views !== false) {
			console.group("redraw_page_views");
			redraw_page_views(this);
			console.groupEnd();
		}
	}

	// SOURCE: https://docs.obsidian.md/Plugins/User+interface/Views
	async activateView(view_id: string, options?: { side?: "left" | "right" }) {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(view_id);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf in the right sidebar for it.
			// Default is to open on the right
			leaf =
				options?.side === "left"
					? workspace.getLeftLeaf(false)
					: workspace.getRightLeaf(false);

			if (!leaf) {
				console.log("bc.activateView: no leaf found");
				return;
			}

			await leaf.setViewState({ type: view_id, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}
}
