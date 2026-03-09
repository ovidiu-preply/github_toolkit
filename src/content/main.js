(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.applyFiltersAndUpdateNote = () => {
    const selectedOwners = toolkit.state.activeOwnerFilter;
    const includeTestFiles = toolkit.state.includeTestFiles;
    const { totalCount, visibleCount } = toolkit.applyOwnerFilter(selectedOwners, includeTestFiles);
    toolkit.applyTreeViewFilter(selectedOwners, includeTestFiles);
    const testFilesLabel = includeTestFiles ? "" : " excluding test files";
    if (selectedOwners.length === 0) {
      toolkit.updateNote(`Showing ${visibleCount}/${totalCount} files${testFilesLabel}.`);
      toolkit.logVisibleFilesSnapshot(selectedOwners, includeTestFiles);
      return;
    }

    toolkit.updateNote(
      `Showing ${visibleCount}/${totalCount} files for ${selectedOwners.length} selected owner(s)${testFilesLabel}.`
    );
    toolkit.logVisibleFilesSnapshot(selectedOwners, includeTestFiles);
  };

  toolkit.applyCurrentSelection = (root) => {
    toolkit.state.activeOwnerFilter = toolkit.getSelectedOwners(root);
    toolkit.applyFiltersAndUpdateNote();
  };

  toolkit.tick = () => {
    if (window.location.pathname !== toolkit.state.lastPathname) {
      toolkit.state.lastPathname = window.location.pathname;
      toolkit.state.lastOwnerSignature = "";
      toolkit.state.activeOwnerFilter = [];
      toolkit.state.includeTestFiles = true;
      toolkit.state.ownerData = {
        status: "idle",
        routeKey: "",
        source: "none",
        allOwners: [],
        ownersByPath: {}
      };
      toolkit.applyOwnerFilter([], true);
      toolkit.applyTreeViewFilter([], true);
      toolkit.log("Route changed:", toolkit.state.lastPathname);
    }

    void toolkit.refreshOwnerData();
    toolkit.mountUi();
    toolkit.mountNativeFileFilterControls();
    toolkit.mountRightSideControls();
    toolkit.updateOwnersUi();
    toolkit.updateFileOwnerBadges();
    toolkit.applyFiltersAndUpdateNote();
  };

  toolkit.log("Content script loaded at:", window.location.href);
  toolkit.tick();
  setInterval(toolkit.tick, 1000);
})();
