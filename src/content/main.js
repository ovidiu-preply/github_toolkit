(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.applyCurrentSelection = (root) => {
    toolkit.state.activeOwnerFilter = toolkit.getSelectedOwners(root);
    const { totalCount, visibleCount } = toolkit.applyOwnerFilter(toolkit.state.activeOwnerFilter);
    toolkit.applyTreeViewFilter(toolkit.state.activeOwnerFilter);
    if (toolkit.state.activeOwnerFilter.length === 0) {
      toolkit.updateNote(`Showing all files (${visibleCount}/${totalCount}).`);
      toolkit.logVisibleFilesSnapshot(toolkit.state.activeOwnerFilter);
      return;
    }

    toolkit.updateNote(
      `Showing ${visibleCount}/${totalCount} files for ${toolkit.state.activeOwnerFilter.length} selected owner(s).`
    );
    toolkit.logVisibleFilesSnapshot(toolkit.state.activeOwnerFilter);
  };

  toolkit.tick = () => {
    if (window.location.pathname !== toolkit.state.lastPathname) {
      toolkit.state.lastPathname = window.location.pathname;
      toolkit.state.lastOwnerSignature = "";
      toolkit.state.activeOwnerFilter = [];
      toolkit.applyOwnerFilter([]);
      toolkit.applyTreeViewFilter([]);
      toolkit.log("Route changed:", toolkit.state.lastPathname);
    }

    toolkit.mountUi();
    toolkit.updateOwnersUi();
    toolkit.updateFileOwnerBadges();
    if (toolkit.state.activeOwnerFilter.length > 0) {
      const { totalCount, visibleCount } = toolkit.applyOwnerFilter(toolkit.state.activeOwnerFilter);
      toolkit.applyTreeViewFilter(toolkit.state.activeOwnerFilter);
      toolkit.updateNote(
        `Showing ${visibleCount}/${totalCount} files for ${toolkit.state.activeOwnerFilter.length} selected owner(s).`
      );
    } else {
      toolkit.applyTreeViewFilter([]);
    }
  };

  toolkit.log("Content script loaded at:", window.location.href);
  toolkit.tick();
  setInterval(toolkit.tick, 1000);
})();
