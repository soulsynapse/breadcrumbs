import { Notice, Setting } from "obsidian";
import type BCPlugin from "../main";
import { splitAndTrim } from "../Utils/generalUtils";
import { getFields } from "../Utils/HierUtils";
import { fragWithHTML, subDetails } from "./BreadcrumbsSettingTab";

export function addHierarchyNoteSettings(
  plugin: BCPlugin,
  alternativeHierarchyDetails: HTMLDetailsElement
) {
  const { settings } = plugin;
  const hierarchyNoteDetails = subDetails(
    "Hierarchy Notes",
    alternativeHierarchyDetails
  );

  new Setting(hierarchyNoteDetails)
    .setName("Hierarchy Note(s)")
    .setDesc(
      fragWithHTML(
        "A comma-separated list of notes used to create external Breadcrumb structures.<br>You can also point to a <i>folder</i> of hierarchy notes by entering <code>folderName/</code> (ending with a <code>/</code>).<br>Hierarchy note names and folders of hierarchy notes can both be entered in the same comma-separated list."
      )
    )
    .addText((text) => {
      text
        .setPlaceholder("Hierarchy Note(s)")
        .setValue(settings.hierarchyNotes.join(", "));

      text.inputEl.onblur = async () => {
        const splits = splitAndTrim(text.getValue());

        settings.hierarchyNotes = splits;
        await plugin.saveSettings();
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
}