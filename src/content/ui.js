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
    if (selectedOwners.length === 0) {
      pickerToggle.textContent = "All owners";
      return;
    }

    if (selectedOwners.length === 1) {
      pickerToggle.textContent = selectedOwners[0];
      return;
    }

    pickerToggle.textContent = `${selectedOwners.length} owners selected`;
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
    const ownerSignature = owners.join("|");
    if (ownerSignature === toolkit.state.lastOwnerSignature) {
      toolkit.updatePickerLabel(root);
      return;
    }

    toolkit.state.lastOwnerSignature = ownerSignature;
    toolkit.log("Owners discovered:", owners);

    checkboxList.innerHTML = "";

    if (owners.length === 0) {
      checkboxList.textContent = "No owners found yet.";
      toolkit.updatePickerLabel(root);
      note.textContent = "No owners found yet.";
      return;
    }

    for (const owner of owners) {
      const row = document.createElement("label");
      row.className = "gh-owner-filter__checkbox-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "gh-owner-filter__checkbox";
      input.value = owner;
      input.checked = previousValues.has(owner);
      input.addEventListener("change", () => {
        toolkit.updatePickerLabel(root);
        toolkit.applyCurrentSelection?.(root);
      });

      const text = document.createElement("span");
      text.textContent = owner;

      row.appendChild(input);
      row.appendChild(text);
      checkboxList.appendChild(row);
    }

    toolkit.updatePickerLabel(root);
    note.textContent = `Found ${owners.length} owner(s). Select multiple via checkboxes.`;
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
})();
