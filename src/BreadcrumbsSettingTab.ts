import log from "loglevel";
import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import { isInVault, openView } from "obsidian-community-lib";
import KoFi from "./Components/KoFi.svelte";
import UserHierarchies from "./Components/UserHierarchies.svelte";
import {
  ALLUNLINKED,
  DIRECTIONS,
  MATRIX_VIEW,
  REAlCLOSED,
  RELATIONS,
  VISTYPES,
} from "./constants";
import type { DebugLevel, Relations, visTypes } from "./interfaces";
import type BCPlugin from "./main";
import MatrixView from "./MatrixView";
import { getFields, splitAndTrim } from "./sharedFunctions";

export class BCSettingTab extends PluginSettingTab {
  plugin: BCPlugin;

  constructor(app: App, plugin: BCPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { plugin, containerEl } = this;
    const { settings } = plugin;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Settings for Breadcrumbs plugin" });

    const fieldDetails: HTMLDetailsElement = containerEl.createEl("details", {
      cls: "field-details",
    });
    fieldDetails.createEl("summary", { text: "Hierarchies" });

    fieldDetails.createEl("p", {
      text: "Here you can set up different hierarchies you use in your vault. To add a new hierarchy, click the plus button. Then, fill in the field names of your hierachy into the 3 boxes that appear. The ↑ field is for parent relations, the → field is for siblings, and ↓ is for child relations.",
    });
    fieldDetails.createEl("p", {
      text: "For each direction (up, same, down), you can enter multiple field names in a comma seperated list. For example: `parent, broader, upper`",
    });

    new UserHierarchies({
      target: fieldDetails,
      props: { plugin },
    });

    const hierarchyNoteDetails: HTMLDetailsElement =
      containerEl.createEl("details");
    hierarchyNoteDetails.createEl("summary", { text: "Hierarchy Notes" });

    new Setting(hierarchyNoteDetails)
      .setName("Hierarchy Note(s)")
      .setDesc("A list of notes used to create external Breadcrumb structures.")
      .addText((text) => {
        text
          .setPlaceholder("Hierarchy Note(s)")
          .setValue(settings.hierarchyNotes.join(", "));

        text.inputEl.onblur = async () => {
          const splits = splitAndTrim(text.getValue());
          if (splits[0] === undefined) {
            settings.hierarchyNotes = splits;
            await plugin.saveSettings();
          } else if (splits.every((note) => isInVault(this.app, note))) {
            settings.hierarchyNotes = splits;
            await plugin.saveSettings();
          } else {
            new Notice("Atleast one of the notes is not in your vault");
          }
        };
      });

    new Setting(hierarchyNoteDetails)
      .setName("Hierarchy Note Up Field Name")
      .setDesc(
        "Using the breadcrumbs generated by the hierarchy note, which ↑ type should they count as? This has to be one of the ↑ types of one of your existing hierarchies. If you want it to be something else, you can make a new hierarchy just for it."
      )
      .addText((text) => {
        let finalValue: string = settings.HNUpField;
        text.setPlaceholder("").setValue(settings.HNUpField);

        text.inputEl.onblur = async () => {
          finalValue = text.getValue();
          if (finalValue === "") {
            settings.HNUpField = finalValue;
            await plugin.saveSettings();
          } else {
            const upFields = getFields(settings.userHiers, "up");
            if (upFields.includes(finalValue)) {
              settings.HNUpField = finalValue;
              await plugin.saveSettings();
            } else {
              new Notice(
                "The field name must be one of the exisitng ↓ fields in your hierarchies."
              );
            }
          }
        };
      });

    const generalDetails: HTMLDetailsElement = containerEl.createEl("details");
    generalDetails.createEl("summary", { text: "General Options" });

    new Setting(generalDetails)
      .setName("CSV Breadcrumb Paths")
      .setDesc("The file path of a csv files with breadcrumbs information.")
      .addText((text) => {
        text.setValue(settings.CSVPaths);
        text.inputEl.onblur = async () => {
          settings.CSVPaths = text.inputEl.value;
          await plugin.saveSettings();
        };
      });

    new Setting(generalDetails)
      .setName("Enable Field Suggestor")
      .setDesc(
        'Alot of Breadcrumbs features require a metadata (or inline Dataview) field to work. For example, `BC-folder-note`. The Field Suggestor will show an autocomplete menu with all available Breadcrumbs field options when the content you type matches the regex /^BC-.*$/. Basically, just type "BC-" at the start of a line to trigger it.'
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.fieldSuggestor).onChange(async (value) => {
          settings.fieldSuggestor = value;
          await plugin.saveSettings();
        })
      );

    new Setting(generalDetails)
      .setName("Refresh Index on Note Change")
      .setDesc(
        "Refresh the Breadcrumbs index data everytime you change notes. This is how Breadcrumbs used to work, making it responsive to changes immediately after changing notes. However, this can be very slow on large vaults, so it is off by default."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.refreshOnNoteChange)
          .onChange(async (value) => {
            settings.refreshOnNoteChange = value;
            await plugin.saveSettings();
          })
      );

    new Setting(generalDetails)
      .setName("Fields used for Alternative note names (Aliases)")
      .setDesc(
        "A comma-separated list of fields you use to specify note name aliases. These fields will be checked, in order, and be used to display an alternate note title in both the list/matrix view, and trail/grid view. This field will probably be `alias` or `aliases`, but it can be anything, like `title`, for example."
      )
      .addText((text) => {
        text.setValue(settings.altLinkFields.join(", "));
        text.inputEl.onblur = async () => {
          settings.altLinkFields = splitAndTrim(text.getValue());
          await plugin.saveSettings();
        };
      });

    new Setting(generalDetails)
      .setName("Use yaml or inline fields for hierarchy data")
      .setDesc(
        "If enabled, Breadcrumbs will make it's hierarchy using yaml fields, and inline fields (if you have Dataview enabled). If this is disabled, it will only use Juggl links for it's metadata (See below)."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.useAllMetadata).onChange(async (value) => {
          settings.useAllMetadata = value;
          await plugin.saveSettings();
          await plugin.refreshIndex();
        })
      );

    new Setting(generalDetails)
      .setName("Use Juggl link syntax without having Juggl installed.")
      .setDesc(
        "Should Breadcrumbs look for [Juggl links](https://juggl.io/Link+Types) even if you don't have Juggl installed? If you do have Juggl installed, it will always look for Juggl links."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.parseJugglLinksWithoutJuggl)
          .onChange(async (value) => {
            settings.parseJugglLinksWithoutJuggl = value;
            await plugin.saveSettings();
          })
      );

    if (this.app.plugins.plugins.dataview !== undefined) {
      new Setting(generalDetails)
        .setName("Dataview Wait Time")
        .setDesc(
          'Enter an integer number of seconds to wait for the Dataview Index to load. The larger your vault, the longer it will take. If you see an error in the console saying "Cannot destructure currGraphs of undefined", try making this time longer. If you don\'t get that error, you can make this time shorter to make the Breadcrumbs load faster. The default is 5 seconds.'
        )
        .addText((text) =>
          text
            .setPlaceholder("Seconds")
            .setValue((settings.dvWaitTime / 1000).toString())
            .onChange(async (value) => {
              const num = Number(value);

              if (num > 0) {
                settings.dvWaitTime = num * 1000;
                await plugin.saveSettings();
              } else {
                new Notice("The interval must be a non-negative number");
              }
            })
        );
    }

    // new Setting(generalDetails)
    //   .setName("Refresh Interval")
    //   .setDesc(
    //     "Enter an integer number of seconds to wait before Breadcrumbs auto-refreshes its data. This would update the matrix view and the trail if either are affected. (Set to 0 to disable autorefreshing)"
    //   )
    //   .addText((text) =>
    //     text
    //       .setPlaceholder("Seconds")
    //       .setValue(settings.refreshIntervalTime.toString())
    //       .onChange(async (value) => {
    //         clearInterval(plugin.refreshIntervalID);
    //         const num = Number(value);

    //         if (num > 0) {
    //           settings.refreshIntervalTime = num;
    //           await plugin.saveSettings();

    //           plugin.refreshIntervalID = window.setInterval(async () => {
    //             plugin.mainG = await plugin.initGraphs();
    //             if (settings.showTrail) {
    //               await plugin.drawTrail();
    //             }
    //             const activeMatrix = plugin.getActiveTYPEView(MATRIX_VIEW);
    //             if (activeMatrix) {
    //               await activeMatrix.draw();
    //             }
    //           }, num * 1000);
    //           plugin.registerInterval(plugin.refreshIntervalID);
    //         } else if (num === 0) {
    //           settings.refreshIntervalTime = num;
    //           await plugin.saveSettings();
    //           clearInterval(plugin.refreshIntervalID);
    //         } else {
    //           new Notice("The interval must be a non-negative number");
    //         }
    //       })
    //   );

    const MLViewDetails: HTMLDetailsElement = containerEl.createEl("details");
    MLViewDetails.createEl("summary", { text: "Matrix/List View" });

    new Setting(MLViewDetails)
      .setName("Show Matrix or List view by default")
      .setDesc(
        "When Obsidian first loads, which view should it show? On = Matrix, Off = List"
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.defaultView).onChange(async (value) => {
          settings.defaultView = value;
          await plugin.saveSettings();
        })
      );

    // TODO I don't think this setting works anymore. I removed it's functionality when adding multiple hierarchies
    new Setting(MLViewDetails)
      .setName("Show all field names or just relation types")
      .setDesc(
        "This changes the headers in matrix/list view. You can have the headers be the list of metadata fields for each relation type (e.g. `parent, broader, upper`). Or you can have them just be the name of the relation type, i.e. 'Parent', 'Sibling', 'Child'. On = show the full list of names."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showNameOrType).onChange(async (value) => {
          settings.showNameOrType = value;
          await plugin.saveSettings();
          await plugin.getActiveTYPEView(MATRIX_VIEW).draw();
        })
      );

    new Setting(MLViewDetails)
      .setName("Show Relationship Type")
      .setDesc(
        "Show whether a link is real or implied. A real link is one you explicitly put in a note. E.g. parent:: [[Note]]. An implied link is the reverse of a real link. For example, if A is the real parent of B, then B must be the implied child of A."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showRelationType).onChange(async (value) => {
          settings.showRelationType = value;
          await plugin.saveSettings();
          await plugin.getActiveTYPEView(MATRIX_VIEW).draw();
        })
      );

    new Setting(MLViewDetails)
      .setName("Sort Alphabetically Ascending/Descending")
      .setDesc(
        "Sort square items alphabetically in Ascending (on) or Descending (off) order."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.alphaSortAsc).onChange(async (value) => {
          settings.alphaSortAsc = value;
          await plugin.saveSettings();
          await plugin.getActiveTYPEView(MATRIX_VIEW).draw();
        })
      );

    new Setting(MLViewDetails)
      .setName("Filter Implied Siblings")
      .setDesc(
        "Implied siblings are: 1) notes with the same parent, or 2) notes that are real siblings. This setting only applies to type 1 implied siblings. If enabled, Breadcrumbs will filter type 1 implied siblings so that they not only share the same parent, but the parent relation has the exact same type. For example, the two real relations B --parent-> A, and C --parent-> A create an implied sibling between B and C (they have the same parent, A). The two real relations B --parent-> A, and C --up-> A create an implied sibling between B and C (they also have the same parent, A). But if this setting is turned on, the second implied sibling would not show, because the parent types are differnet (parent versus up)."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.filterImpliedSiblingsOfDifferentTypes)
          .onChange(async (value) => {
            settings.filterImpliedSiblingsOfDifferentTypes = value;
            await plugin.saveSettings();
            await plugin.getActiveTYPEView(MATRIX_VIEW).draw();
          })
      );

    new Setting(MLViewDetails)
      .setName("Open View in Right or Left side")
      .setDesc(
        "When loading the matrix view, should it open on the left or right side leaf? On = Right, Off = Left."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.rlLeaf).onChange(async (value) => {
          settings.rlLeaf = value;
          await plugin.saveSettings();
          await plugin.getActiveTYPEView(MATRIX_VIEW)?.onClose();
          await openView(
            this.app,
            MATRIX_VIEW,
            MatrixView,
            value ? "right" : "left"
          );
        })
      );

    const trailDetails: HTMLDetailsElement = containerEl.createEl("details");
    trailDetails.createEl("summary", { text: "Trail/Grid" });

    new Setting(trailDetails)
      .setName("Show Breadcrumbs")
      .setDesc("Show a set of different views at the top of the current note.")
      .addToggle((toggle) =>
        toggle.setValue(settings.showBCs).onChange(async (value) => {
          settings.showBCs = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    new Setting(trailDetails)
      .setName("Show Breadcrumbs in Edit/Live-Preview Mode")
      .setDesc(
        "It always shows in preview mode, but should it also show in the other two?\n\nKeep in mind that there is currently a limitation where the Breadcrumbs view will be stuck to the top of the note in edit/LP mode, even if you scroll down."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showBCsInEditLPMode)
          .onChange(async (value) => {
            settings.showBCsInEditLPMode = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    const limitTrailFieldsDiv = trailDetails.createDiv({
      cls: "limit-ML-fields",
    });
    limitTrailFieldsDiv.createEl("strong", {
      text: "Limit Trail View to only show certain fields",
    });

    const checkboxDiv = limitTrailFieldsDiv.createDiv({ cls: "checkboxes" });

    function drawLimitTrailCheckboxes(div: HTMLDivElement) {
      checkboxDiv.empty();
      const checkboxStates = settings.limitTrailCheckboxStates;

      settings.userHiers.forEach((userHier) => {
        userHier.up.forEach(async (field) => {
          if (field === "") return;
          // First sort out limitTrailCheckboxStates
          if (checkboxStates[field] === undefined) {
            checkboxStates[field] = true;
            await plugin.saveSettings();
          }
          const cbDiv = div.createDiv();
          const checkedQ = checkboxStates[field];
          const cb = cbDiv.createEl("input", {
            type: "checkbox",
            attr: { id: field },
          });
          cb.checked = checkedQ;
          cbDiv.createEl("label", {
            text: field,
            attr: { for: field },
          });

          cb.addEventListener("change", async () => {
            checkboxStates[field] = cb.checked;
            await plugin.saveSettings();
            console.log(settings.limitTrailCheckboxStates);
          });
        });
      });
    }

    drawLimitTrailCheckboxes(checkboxDiv);

    // new Setting(trailDetails)
    //   .setName("Field name to hide trail")
    //   .setDesc(
    //     "A note-specific toggle to hide the Trail View. By default, it is `hide-trail`. So, to hide the trail on a specific note, add the field to that note's yaml, like so: `hide-trail: {{anything}}`."
    //   )
    //   .addText((text) => {
    //     text.setValue(settings.hideTrailField);
    //     text.inputEl.onblur = async () => {
    //       settings.hideTrailField = text.getValue();
    //       await plugin.saveSettings();
    //     };
    //   });

    new Setting(trailDetails)
      .setName("Views to show")
      .setDesc(
        "Choose which of the views to show at the top of the note.\nTrail, Grid, and/or the Next-Previous view."
      )
      .addToggle((toggle) => {
        toggle
          .setTooltip("Show Trail view")
          .setValue(settings.showTrail)
          .onChange(async (value) => {
            settings.showTrail = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          });
      })
      .addToggle((toggle) => {
        toggle
          .setTooltip("Show Grid view")
          .setValue(settings.showGrid)
          .onChange(async (value) => {
            settings.showGrid = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          });
      })
      .addToggle((toggle) => {
        toggle
          .setTooltip("Show Next/Previous view")
          .setValue(settings.showPrevNext)
          .onChange(async (value) => {
            settings.showPrevNext = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          });
      });

    new Setting(trailDetails)
      .setName("Grid view dots")
      .setDesc(
        "If the grid view is visible, shows dots based on the file size of each cell."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.gridDots).onChange(async (value) => {
          settings.gridDots = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    const dotsColour = trailDetails.createDiv();
    dotsColour.createEl("h4", {
      text: "Dots colour",
    });
    const dotsColourPicker = dotsColour.createEl("input", {
      type: "color",
    });

    dotsColourPicker.value = settings.dotsColour;
    dotsColourPicker.addEventListener("change", async () => {
      settings.dotsColour = dotsColourPicker.value;
      await plugin.saveSettings();
    });

    new Setting(trailDetails)
      .setName("Grid view heatmap")
      .setDesc(
        "If the grid view is visible, change the background colour of squares based on the number of children leaving that note."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.gridHeatmap).onChange(async (value) => {
          settings.gridHeatmap = value;
          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    const heatmapColour = trailDetails.createDiv();
    heatmapColour.createEl("h4", {
      text: "Heat map colour",
    });
    const heatmapColourPicker = heatmapColour.createEl("input", {
      type: "color",
    });

    heatmapColourPicker.value = settings.heatmapColour;
    heatmapColourPicker.addEventListener("change", async () => {
      settings.heatmapColour = heatmapColourPicker.value;
      await plugin.saveSettings();
    });

    new Setting(trailDetails)
      .setName("Index Note(s)")
      .setDesc(
        "The note that all of your other notes lead back to. The parent of all your parent notes. Just enter the name. So if your index note is `000 Home.md`, enter `000 Home`. You can also have multiple index notes (comma-separated list). The breadcrumb trail will show the shortest path back to any one of the index notes listed. You can now leave this field empty, meaning the trail will show a path going as far up the parent-tree as possible."
      )
      .addText((text) => {
        text
          .setPlaceholder("Index Note")
          .setValue(settings.indexNotes.join(", "));

        text.inputEl.onblur = async () => {
          const splits = splitAndTrim(text.getValue());
          if (
            splits[0] === undefined ||
            splits.every((index) => isInVault(this.app, index))
          ) {
            settings.indexNotes = splits;
            await plugin.saveSettings();
          } else {
            new Notice(`Atleast one of the notes is not in your vault`);
          }
        };
      });

    new Setting(trailDetails)
      .setName("Shows all paths if none to index note are found")
      .setDesc(
        "If you have an index notes chosen, but the trail view has no paths going up to those index notes, should it show all paths instead?"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showAllPathsIfNoneToIndexNote)
          .onChange(async (value) => {
            settings.showAllPathsIfNoneToIndexNote = value;

            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    new Setting(trailDetails)
      .setName("Default: All or Shortest")
      .setDesc(
        "If multiple paths are found going up the parent tree, should all of them be shown by default, or only the shortest? On = all, off = shortest"
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showAll).onChange(async (value) => {
          settings.showAll = value;

          await plugin.saveSettings();
          await plugin.drawTrail();
        })
      );

    new Setting(trailDetails)
      .setName("Breadcrumb trail seperator")
      .setDesc(
        "The character to show between crumbs in the breadcrumb trail. The default is '→'"
      )
      .addText((text) =>
        text
          .setPlaceholder("→")
          .setValue(settings.trailSeperator)
          .onChange(async (value) => {
            settings.trailSeperator = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    new Setting(trailDetails)
      .setName("No path found message")
      .setDesc(
        "The text to display when no path to the index note was found, or when the current note has no parent (this happens if you haven't chosen an index note)"
      )
      .addText((text) =>
        text
          .setPlaceholder(`No path to index note was found`)
          .setValue(settings.noPathMessage)
          .onChange(async (value) => {
            settings.noPathMessage = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    new Setting(trailDetails)
      .setName("Respect Readable Line Length")
      .setDesc(
        "Should the breadcrumbs trail adjust its width to the readable line length, or use as much space as possible? On = use readable line length."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.respectReadableLineLength)
          .onChange(async (value) => {
            settings.respectReadableLineLength = value;
            await plugin.saveSettings();
            await plugin.drawTrail();
          })
      );

    const writeBCsToFileDetails: HTMLDetailsElement =
      containerEl.createEl("details");
    writeBCsToFileDetails.createEl("summary", {
      text: "Write Breadcrumbs to File",
    });

    const limitWriteBCDiv = writeBCsToFileDetails.createDiv({
      cls: "limit-ML-fields",
    });
    limitWriteBCDiv.createEl("strong", {
      text: "Limit to only write certain fields to files",
    });

    const limitWriteBCCheckboxDiv = limitWriteBCDiv.createDiv({
      cls: "checkboxes",
    });

    function drawLimitWriteBCCheckboxes(div: HTMLDivElement) {
      limitWriteBCCheckboxDiv.empty();
      const checkboxStates = settings.limitWriteBCCheckboxStates;

      settings.userHiers.forEach((userHier) => {
        DIRECTIONS.forEach((dir) => {
          userHier[dir]?.forEach(async (field) => {
            if (field === "") return;
            // First sort out limitWriteBCCheckboxStates
            if (checkboxStates[field] === undefined) {
              checkboxStates[field] = true;
              await plugin.saveSettings();
            }
            const cbDiv = div.createDiv();
            const checkedQ = checkboxStates[field];
            const cb = cbDiv.createEl("input", {
              type: "checkbox",
              attr: { id: field },
            });
            cb.checked = checkedQ;
            const label = cbDiv.createEl("label", {
              text: field,
              attr: { for: field },
            });

            cb.addEventListener("change", async (event) => {
              checkboxStates[field] = cb.checked;
              await plugin.saveSettings();
              console.log(settings.limitWriteBCCheckboxStates);
            });
          });
        });
      });
    }

    drawLimitWriteBCCheckboxes(limitWriteBCCheckboxDiv);

    new Setting(writeBCsToFileDetails)
      .setName("Write BCs to file Inline")
      .setDesc(
        "When writing BCs to file, should they be written inline (using Dataview syntax), or into the YAML of the note?"
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.writeBCsInline).onChange(async (value) => {
          settings.writeBCsInline = value;
          await plugin.saveSettings();
        })
      );

    new Setting(writeBCsToFileDetails)
      .setName("Show the `Write Breadcrumbs to ALL Files` command")
      .setDesc(
        "This command attempts to update ALL files with implied breadcrumbs pointing to them. So, it is not shown by default (even though it has 3 confirmation boxes to ensure you want to run it"
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.showWriteAllBCsCmd).onChange(async (value) => {
          settings.showWriteAllBCsCmd = value;
          await plugin.saveSettings();
        })
      );

    const visModalDetails: HTMLDetailsElement = containerEl.createEl("details");
    visModalDetails.createEl("summary", { text: "Visualisation Modal" });

    new Setting(visModalDetails)
      .setName("Default Visualisation Type")
      .setDesc("Which visualisation to show by defualt")
      .addDropdown((cb: DropdownComponent) => {
        VISTYPES.forEach((option: visTypes) => {
          cb.addOption(option, option);
        });
        cb.setValue(settings.visGraph);

        cb.onChange(async (value: visTypes) => {
          settings.visGraph = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Relation")
      .setDesc("Which relation type to show first when opening the modal")
      .addDropdown((cb: DropdownComponent) => {
        RELATIONS.forEach((option: Relations) => {
          cb.addOption(option, option);
        });
        cb.setValue(settings.visRelation);

        cb.onChange(async (value: Relations) => {
          settings.visRelation = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Real/Closed")
      .setDesc("Show the real or closed graph by default")
      .addDropdown((cb: DropdownComponent) => {
        REAlCLOSED.forEach((option: string) => {
          cb.addOption(option, option);
        });
        cb.setValue(settings.visClosed);

        cb.onChange(async (value: string) => {
          settings.visClosed = value;
          await plugin.saveSettings();
        });
      });
    new Setting(visModalDetails)
      .setName("Default Unlinked")
      .setDesc("Show all nodes or only those which have links by default")
      .addDropdown((cb: DropdownComponent) => {
        ALLUNLINKED.forEach((option: string) => {
          cb.addOption(option, option);
        });
        cb.setValue(settings.visAll);

        cb.onChange(async (value: string) => {
          settings.visAll = value;
          await plugin.saveSettings();
        });
      });

    const createIndexDetails: HTMLDetailsElement =
      containerEl.createEl("details");
    createIndexDetails.createEl("summary", { text: "Create Index" });

    new Setting(createIndexDetails)
      .setName("Add wiklink brackets")
      .setDesc(
        "When creating an index, should it wrap the note name in wikilinks `[[]]` or not. On = yes, off = no."
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.wikilinkIndex).onChange(async (value) => {
          settings.wikilinkIndex = value;
          await plugin.saveSettings();
        })
      );

    new Setting(createIndexDetails)
      .setName("Show aliases of notes in index")
      .setDesc("Show the aliases of each note in brackets. On = yes, off = no.")
      .addToggle((toggle) =>
        toggle.setValue(settings.aliasesInIndex).onChange(async (value) => {
          settings.aliasesInIndex = value;
          await plugin.saveSettings();
        })
      );

    const debugDetails: HTMLDetailsElement = containerEl.createEl("details");
    debugDetails.createEl("summary", { text: "Debugging" });

    new Setting(debugDetails)
      .setName("Debug Mode")
      .setDesc(
        "Set the minimum level of debug messages to console log. If you choose `TRACE`, then everything will be logged. If you choose `ERROR`, then only the most necessary issues will be logged. `SILENT` will turn off all logs."
      )
      .addDropdown((dd) => {
        Object.keys(log.levels).forEach((key) => dd.addOption(key, key));
        dd.setValue(settings.debugMode).onChange(async (value: DebugLevel) => {
          log.setLevel(value);
          settings.debugMode = value;
          await plugin.saveSettings();
        });
      });

    debugDetails.createEl(
      "button",
      { text: "Console log `settings`" },
      (el) => {
        el.addEventListener("click", () => console.log(settings));
      }
    );

    new KoFi({ target: this.containerEl });
  }
}
