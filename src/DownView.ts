import { ItemView, WorkspaceLeaf } from "obsidian";
import { DOWN_VIEW } from "./constants";
import type BCPlugin from "./main";
import Down from "./Components/Down.svelte";
import { addFeatherIcon } from "obsidian-community-lib";

export default class DownView extends ItemView {
  private plugin: BCPlugin;
  private view: Down;

  constructor(leaf: WorkspaceLeaf, plugin: BCPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  async onload(): Promise<void> {
    super.onload();
    this.app.workspace.onLayoutReady(async () => {
      await this.draw();
    });
  }

  getViewType() {
    return DOWN_VIEW;
  }
  getDisplayText() {
    return "Breadcrumbs Down";
  }

  icon = addFeatherIcon("corner-right-down") as string;

  async onOpen(): Promise<void> {}

  onClose(): Promise<void> {
    if (this.view) {
      this.view.$destroy();
    }
    return Promise.resolve();
  }

  async draw(): Promise<void> {
    this.contentEl.empty();

    this.view = new Down({
      target: this.contentEl,
      props: { plugin: this.plugin, view: this },
    });
  }
}