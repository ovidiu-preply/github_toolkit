(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.getSelectedOwners = (root) =>
    Array.from(root.querySelectorAll(".gh-owner-filter__checkbox:checked")).map((input) => input.value);

  toolkit.updateNote = (text) => {
    const root = document.getElementById(toolkit.constants.ROOT_ID);
    if (!root) {
      return;
    }

    const note = root.querySelector(".gh-owner-filter__note");
    if (!note) {
      return;
    }

    note.textContent = text;
  };

  toolkit.updatePickerLabel = (root) => {
    const pickerToggle = root.querySelector(".gh-owner-filter__picker-toggle");
    if (!pickerToggle) {
      return;
    }

    const selectedOwners = toolkit.getSelectedOwners(root);
    const formatSelectedOwner = (value) =>
      value === toolkit.constants.NO_OWNER_FILTER_VALUE ? "No owner" : value;
    if (selectedOwners.length === 0) {
      pickerToggle.textContent = "All owners";
      return;
    }

    if (selectedOwners.length === 1) {
      pickerToggle.textContent = formatSelectedOwner(selectedOwners[0]);
      return;
    }

    pickerToggle.textContent = `${selectedOwners.length} owners selected`;
  };

  toolkit.buildRightSideControlsUi = () => {
    const root = document.createElement("div");
    root.id = toolkit.constants.RIGHT_CONTROLS_ID;
    root.className = "gh-owner-filter-right-controls";

    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "gh-owner-filter-right-controls__button";
    expandButton.textContent = "Expand all";
    expandButton.addEventListener("click", () => {
      const { changedCount } = toolkit.setAllRightSideFilesExpanded(true);
      toolkit.log("Expand all files clicked. Changed:", changedCount);
      toolkit.updateRightSideControlsState(root);
    });

    const collapseButton = document.createElement("button");
    collapseButton.type = "button";
    collapseButton.className = "gh-owner-filter-right-controls__button";
    collapseButton.textContent = "Collapse all";
    collapseButton.addEventListener("click", () => {
      const { changedCount } = toolkit.setAllRightSideFilesExpanded(false);
      toolkit.log("Collapse all files clicked. Changed:", changedCount);
      toolkit.updateRightSideControlsState(root);
    });

    root.appendChild(expandButton);
    root.appendChild(collapseButton);
    return root;
  };

  toolkit.updateRightSideControlsState = (root) => {
    if (!root) {
      return;
    }

    const buttons = root.querySelectorAll(".gh-owner-filter-right-controls__button");
    if (buttons.length !== 2) {
      return;
    }

    const [expandButton, collapseButton] = buttons;
    const fileBlocks = toolkit
      .getDiffFileBlocks()
      .filter((fileBlock) => !toolkit.isElementHiddenByFilter(fileBlock));
    let hasExpanded = false;
    let hasCollapsed = false;

    for (const fileBlock of fileBlocks) {
      const expanded = toolkit.isFileBlockExpanded(fileBlock);
      if (expanded === true) {
        hasExpanded = true;
      } else if (expanded === false) {
        hasCollapsed = true;
      }
    }

    expandButton.disabled = !hasCollapsed;
    collapseButton.disabled = !hasExpanded;
  };

  toolkit.buildFilterUi = () => {
    const root = document.createElement("div");
    root.id = toolkit.constants.ROOT_ID;
    root.className = "gh-owner-filter";

    const label = document.createElement("span");
    label.className = "gh-owner-filter__label";
    label.textContent = "Code owner:";

    const picker = document.createElement("div");
    picker.className = "gh-owner-filter__picker";
    picker.classList.add("is-open");

    const pickerToggle = document.createElement("button");
    pickerToggle.type = "button";
    pickerToggle.className = "gh-owner-filter__picker-toggle";
    pickerToggle.textContent = "All owners";
    pickerToggle.setAttribute("aria-expanded", "true");

    const pickerPanel = document.createElement("div");
    pickerPanel.className = "gh-owner-filter__panel";

    const checkboxList = document.createElement("div");
    checkboxList.className = "gh-owner-filter__checkbox-list";
    checkboxList.textContent = "No owners found yet.";

    pickerPanel.appendChild(checkboxList);
    picker.appendChild(pickerToggle);
    picker.appendChild(pickerPanel);

    const note = document.createElement("span");
    note.className = "gh-owner-filter__note";
    note.textContent = "Loading owners...";

    pickerToggle.addEventListener("click", () => {
      const isOpen = picker.classList.toggle("is-open");
      pickerToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    root.appendChild(label);
    root.appendChild(picker);
    root.appendChild(note);

    return root;
  };

  toolkit.updateOwnersUi = () => {
    const root = document.getElementById(toolkit.constants.ROOT_ID);
    if (!root) {
      return;
    }

    const checkboxList = root.querySelector(".gh-owner-filter__checkbox-list");
    const note = root.querySelector(".gh-owner-filter__note");
    if (!checkboxList || !note) {
      return;
    }

    const previousValues = new Set(toolkit.getSelectedOwners(root));
    const owners = toolkit.getOwnersFromPage();
    const ownerData = toolkit.state.ownerData;
    const ownerFileCounts = toolkit.getOwnerFileCounts();
    const noOwnerFileCount = toolkit.getNoOwnerFileCount();
    const ownerOptions = owners.map((owner) => ({
      value: owner,
      label: owner,
      filesCount: ownerFileCounts.get(owner)
    }));
    if (noOwnerFileCount > 0) {
      ownerOptions.push({
        value: toolkit.constants.NO_OWNER_FILTER_VALUE,
        label: "No owner",
        filesCount: noOwnerFileCount
      });
    }

    const ownerSignature = ownerOptions
      .map((option) => `${option.value}:${option.filesCount ?? "-"}`)
      .join("|");
    const existingOwnerCheckboxCount = root.querySelectorAll(".gh-owner-filter__checkbox").length;
    const needsOwnerListRebuild = ownerOptions.length > 0 && existingOwnerCheckboxCount === 0;
    const resolvedNoteText =
      ownerData.source === "codeowners"
        ? `Found ${owners.length} owner(s) from CODEOWNERS. Select multiple via checkboxes.`
        : `Found ${owners.length} owner(s). Select multiple via checkboxes.`;
    if (ownerSignature === toolkit.state.lastOwnerSignature && !needsOwnerListRebuild) {
      if (ownerData.status === "loading") {
        note.textContent = "Loading owners from CODEOWNERS...";
      } else if (owners.length > 0) {
        note.textContent = resolvedNoteText;
      }
      toolkit.updatePickerLabel(root);
      return;
    }

    toolkit.state.lastOwnerSignature = ownerSignature;
    toolkit.log("Owners discovered:", owners);

    checkboxList.innerHTML = "";

    if (ownerOptions.length === 0) {
      checkboxList.textContent = "No owners found yet.";
      toolkit.updatePickerLabel(root);
      note.textContent =
        ownerData.status === "loading"
          ? "Loading owners from CODEOWNERS..."
          : "No owners found yet.";
      return;
    }

    for (const option of ownerOptions) {
      const row = document.createElement("label");
      row.className = "gh-owner-filter__checkbox-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "gh-owner-filter__checkbox";
      input.value = option.value;
      input.checked = previousValues.has(option.value);
      input.addEventListener("change", () => {
        toolkit.updatePickerLabel(root);
        toolkit.applyCurrentSelection?.(root);
      });

      const text = document.createElement("span");
      text.textContent = Number.isInteger(option.filesCount)
        ? `${option.label} (${option.filesCount})`
        : option.label;

      row.appendChild(input);
      row.appendChild(text);
      checkboxList.appendChild(row);
    }

    toolkit.updatePickerLabel(root);
    note.textContent = resolvedNoteText;
  };

  toolkit.mountUi = () => {
    toolkit.log("Mount check running.");

    if (!toolkit.isPullRequestFilesView()) {
      const existing = document.getElementById(toolkit.constants.ROOT_ID);
      if (existing) {
        toolkit.log("Route no longer matches. Removing existing UI.");
        existing.remove();
      }
      return;
    }

    const sidebarTarget = toolkit.findSidebarMountTarget();
    const existing = document.getElementById(toolkit.constants.ROOT_ID);
    if (existing) {
      if (sidebarTarget && existing.parentElement === sidebarTarget.parent) {
        existing.classList.add("gh-owner-filter--sidebar");
        return;
      }

      if (!sidebarTarget && existing.parentElement) {
        return;
      }

      existing.remove();
    }

    const ui = toolkit.buildFilterUi();

    if (sidebarTarget) {
      ui.classList.add("gh-owner-filter--sidebar");
      sidebarTarget.parent.insertBefore(ui, sidebarTarget.before);
      toolkit.log("UI mounted in left files panel.");
      return;
    }

    const mountPoint = toolkit.findMountPoint();
    if (!mountPoint) {
      toolkit.log("No mount point found yet.");
      return;
    }

    mountPoint.appendChild(ui);
    toolkit.log("UI mounted using fallback header location.");
  };

  toolkit.mountRightSideControls = () => {
    const existing = document.getElementById(toolkit.constants.RIGHT_CONTROLS_ID);
    if (!toolkit.isPullRequestFilesView()) {
      existing?.remove();
      return;
    }

    const mountTarget = toolkit.findRightSideMountTarget();
    if (!mountTarget) {
      existing?.remove();
      return;
    }

    if (!existing) {
      const controls = toolkit.buildRightSideControlsUi();
      mountTarget.parent.insertBefore(controls, mountTarget.before);
      toolkit.updateRightSideControlsState(controls);
      return;
    }

    if (existing.parentElement !== mountTarget.parent || existing.nextElementSibling !== mountTarget.before) {
      existing.remove();
      mountTarget.parent.insertBefore(existing, mountTarget.before);
    }

    toolkit.updateRightSideControlsState(existing);
  };
})();
