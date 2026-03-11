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

  toolkit.findNativeFileFilterPopup = () => {
    const globalMenus = Array.from(document.querySelectorAll('[role="menu"]'));
    const visibleFilterMenu = globalMenus.find((menu) => {
      if (!toolkit.isActuallyVisible(menu)) {
        return false;
      }

      const ariaLabel = (menu.getAttribute("aria-label") || "").toLowerCase();
      if (ariaLabel.includes("filter options")) {
        return true;
      }

      const menuText = (menu.textContent || "").toLowerCase();
      return menuText.includes("viewed files");
    });
    if (visibleFilterMenu) {
      return visibleFilterMenu;
    }

    const filterHost = document.getElementById("diff-file-tree-filter");
    if (!filterHost) {
      return null;
    }

    const popupCandidates = Array.from(
      filterHost.querySelectorAll(
        '[role="dialog"], [role="menu"], .SelectMenu-modal, [class*="ActionListWrap"], [class*="ActionList"]'
      )
    );
    return popupCandidates.find((element) => toolkit.isActuallyVisible(element)) || null;
  };

  toolkit.findNativeFileFilterPopupMountTarget = (popupRoot) => {
    if (!popupRoot) {
      return null;
    }

    return (
      popupRoot.querySelector(".SelectMenu-list") ||
      popupRoot.querySelector(".SelectMenu-modal") ||
      popupRoot.querySelector('[class*="ActionListWrap"]') ||
      popupRoot.querySelector('[class*="ActionList"]') ||
      popupRoot.querySelector('[role="menu"]') ||
      popupRoot
    );
  };

  toolkit.getTestFilesCount = () =>
    toolkit.getAllChangedFilePaths().filter((filePath) => toolkit.isTestFilePath(filePath)).length;

  toolkit.updateNativeTestFilesFilterRowContent = (row) => {
    if (!row) {
      return;
    }

    const count = toolkit.getTestFilesCount();
    const isLegacySelectMenuItem = row.classList.contains("SelectMenu-item");
    if (isLegacySelectMenuItem) {
      row.innerHTML = "";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "mr-2";
      checkbox.checked = toolkit.state.includeTestFiles;
      checkbox.setAttribute("aria-hidden", "true");
      checkbox.tabIndex = -1;
      row.appendChild(checkbox);

      const labelText = document.createElement("span");
      labelText.className = "text-normal";
      labelText.textContent = "Include test files";
      row.appendChild(labelText);

      row.append("\u00a0");

      const countText = document.createElement("span");
      countText.className = "text-normal js-file-type-count";
      countText.textContent = `(${count})`;
      row.appendChild(countText);
      return;
    }

    const labelElement =
      row.querySelector('[id$="--label"]') ||
      row.querySelector('[class*="ActionList-ItemLabel"]') ||
      row.querySelector('[class*="ItemLabel"]');
    if (labelElement) {
      labelElement.textContent = "Include test files";
    } else {
      row.textContent = "Include test files";
    }

    const trailingVisual =
      row.querySelector('[id$="--trailing-visual"]') ||
      row.querySelector('[class*="ActionList-TrailingVisual"]') ||
      row.querySelector('[class*="TrailingVisual"]');
    if (trailingVisual) {
      const counterLabel = trailingVisual.querySelector('[class*="CounterLabel"]');
      const counterHidden = trailingVisual.querySelector('[class*="VisuallyHidden"]');
      if (counterLabel) {
        counterLabel.textContent = String(count);
      } else {
        trailingVisual.textContent = String(count);
      }
      if (counterHidden) {
        counterHidden.textContent = ` (${count})`;
      }
    } else if (labelElement) {
      labelElement.textContent = `Include test files (${count})`;
    }
  };

  toolkit.buildNativeTestFilesFilterRow = (templateItem) => {
    const row = templateItem ? templateItem.cloneNode(true) : document.createElement("li");
    row.classList.add("gh-owner-filter__native-test-filter-row");
    const isLegacySelectMenuItem = row.classList.contains("SelectMenu-item");
    row.setAttribute("role", isLegacySelectMenuItem ? "menuitem" : "menuitemcheckbox");
    if (isLegacySelectMenuItem) {
      row.removeAttribute("aria-checked");
      row.removeAttribute("tabindex");
    } else {
      row.setAttribute("aria-checked", toolkit.state.includeTestFiles ? "true" : "false");
      row.tabIndex = 0;
    }
    row.removeAttribute("aria-keyshortcuts");
    row.removeAttribute("aria-labelledby");

    for (const elementWithId of row.querySelectorAll("[id]")) {
      elementWithId.removeAttribute("id");
    }
    toolkit.updateNativeTestFilesFilterRowContent(row);

    const applyState = () => {
      toolkit.state.includeTestFiles = !toolkit.state.includeTestFiles;
      if (!isLegacySelectMenuItem) {
        row.setAttribute("aria-checked", toolkit.state.includeTestFiles ? "true" : "false");
      }
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = toolkit.state.includeTestFiles;
      }
      toolkit.applyFiltersAndUpdateNote?.();
    };

    row.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyState();
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      applyState();
    });

    return row;
  };

  toolkit.mountNativeFileFilterControls = () => {
    if (!toolkit.isPullRequestFilesView()) {
      return;
    }

    const popupRoot = toolkit.findNativeFileFilterPopup();
    if (!popupRoot) {
      return;
    }

    const mountTarget = toolkit.findNativeFileFilterPopupMountTarget(popupRoot);
    if (!mountTarget) {
      return;
    }

    const menuItems = Array.from(
      popupRoot.querySelectorAll(
        '[role="menuitem"]:not(.gh-owner-filter__native-test-filter-row), [role="menuitemcheckbox"]:not(.gh-owner-filter__native-test-filter-row)'
      )
    );
    const viewedFilesItem = menuItems.find((item) => /viewed files/i.test(item.textContent || "")) || null;
    const menuCheckboxItems = menuItems.filter((item) => item.getAttribute("role") === "menuitemcheckbox");
    const badgeTemplateItem = menuCheckboxItems.find(
      (item) =>
        Boolean(
          item.querySelector(
            '[id$="--trailing-visual"], [class*="ActionList-TrailingVisual"], [class*="TrailingVisual"], .Counter, .CounterLabel'
          )
        )
    );
    const isLegacyPopup = Boolean(
      popupRoot.querySelector(".SelectMenu-list") || popupRoot.querySelector(".SelectMenu-modal")
    );
    const templateItem = isLegacyPopup
      ? viewedFilesItem || menuCheckboxItems[0] || null
      : badgeTemplateItem || menuCheckboxItems[0] || viewedFilesItem || null;
    const insertionParent = viewedFilesItem?.parentElement || templateItem?.parentElement || mountTarget;
    const existing = insertionParent.querySelector(".gh-owner-filter__native-test-filter-row");
    if (existing) {
      if (existing.classList.contains("SelectMenu-item")) {
        existing.removeAttribute("aria-checked");
      } else {
        existing.setAttribute("aria-checked", toolkit.state.includeTestFiles ? "true" : "false");
      }
      toolkit.updateNativeTestFilesFilterRowContent(existing);
      return;
    }

    const row = toolkit.buildNativeTestFilesFilterRow(templateItem);
    if (
      viewedFilesItem &&
      viewedFilesItem.parentElement &&
      viewedFilesItem.parentElement === insertionParent
    ) {
      viewedFilesItem.insertAdjacentElement("afterend", row);
      return;
    }

    insertionParent.appendChild(row);
  };

  toolkit.buildRightSideControlsUi = () => {
    const root = document.createElement("div");
    root.id = toolkit.constants.RIGHT_CONTROLS_ID;
    root.className = "gh-owner-filter-right-controls";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "gh-owner-filter-right-controls__button";
    toggleButton.textContent = "Expand / Collapse all";
    toggleButton.addEventListener("click", () => {
      const nextExpandedState = toolkit.getShouldExpandAllVisibleFiles();
      const { changedCount } = toolkit.setAllRightSideFilesExpanded(nextExpandedState);
      toolkit.log(
        `${nextExpandedState ? "Expand" : "Collapse"} all files clicked. Changed:`,
        changedCount
      );
      toolkit.updateRightSideControlsState(root);
    });

    root.appendChild(toggleButton);
    return root;
  };

  toolkit.getShouldExpandAllVisibleFiles = () => {
    const fileBlocks = toolkit
      .getDiffFileBlocks()
      .filter((fileBlock) => !toolkit.isElementHiddenByFilter(fileBlock));

    for (const fileBlock of fileBlocks) {
      if (toolkit.isFileBlockExpanded(fileBlock) === false) {
        return true;
      }
    }

    return false;
  };

  toolkit.updateRightSideControlsState = (root) => {
    if (!root) {
      return;
    }

    const toggleButton = root.querySelector(".gh-owner-filter-right-controls__button");
    if (!toggleButton) {
      return;
    }

    const fileBlocks = toolkit
      .getDiffFileBlocks()
      .filter((fileBlock) => !toolkit.isElementHiddenByFilter(fileBlock));
    toggleButton.disabled = fileBlocks.length === 0;
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
