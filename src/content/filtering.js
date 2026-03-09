(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.applyOwnerFilter = (selectedOwners) => {
    const selected = new Set(selectedOwners);
    const fileBlocks = toolkit.getDiffFileBlocks();
    let visibleCount = 0;

    for (const fileBlock of fileBlocks) {
      const diffContainer = toolkit.getDiffBlockWrapper(fileBlock);
      if (selected.size === 0) {
        toolkit.setElementHidden(diffContainer, false);
        toolkit.setElementHidden(fileBlock, false);
        visibleCount += 1;
        continue;
      }

      const fileOwners = toolkit.getOwnersForFileBlock(fileBlock);
      const isMatch = Array.from(fileOwners).some((owner) => selected.has(owner));
      toolkit.setElementHidden(diffContainer, !isMatch);
      toolkit.setElementHidden(fileBlock, !isMatch);
      if (isMatch) {
        visibleCount += 1;
      }
    }

    return { totalCount: fileBlocks.length, visibleCount };
  };

  toolkit.getVisibleRightSideEntries = () => {
    const dedupedByPath = new Map();
    const entries = toolkit
      .getDiffFileBlocks()
      .filter((fileBlock) => !toolkit.isElementHiddenByFilter(fileBlock))
      .map((fileBlock) => {
        const pathNode = fileBlock.querySelector("h3 code");
        const path = toolkit.normalizeFilePath(pathNode?.textContent || fileBlock.id);
        return {
          path,
          diffId: fileBlock.id
        };
      });

    for (const entry of entries) {
      if (entry.path && !dedupedByPath.has(entry.path)) {
        dedupedByPath.set(entry.path, entry);
      }
    }

    return Array.from(dedupedByPath.values());
  };

  toolkit.getVisibleRightSideFiles = () =>
    toolkit.getVisibleRightSideEntries().map((entry) => entry.path);

  toolkit.applyTreeViewFilter = (selectedOwners) => {
    const treeRoot = toolkit.getTreeRoot();
    if (!treeRoot) {
      return { visibleLeafCount: 0, totalLeafCount: 0 };
    }
    const hasActiveFilter = selectedOwners.length > 0;
    const visibleEntries = toolkit.getVisibleRightSideEntries();
    const visibleDiffIds = new Set(visibleEntries.map((entry) => entry.diffId));
    const visiblePaths = new Set(visibleEntries.map((entry) => entry.path));

    const leafRows = toolkit.getTreeFileRows(treeRoot);

    for (const leafItem of leafRows) {
      const diffHref = toolkit.getTreeItemLinkToDiff(leafItem)?.getAttribute("href") || "";
      const diffId = diffHref.replace("#", "");
      const treePath = toolkit.normalizeFilePath(leafItem.id);
      const isVisible =
        !hasActiveFilter || visibleDiffIds.has(diffId) || visiblePaths.has(treePath);
      toolkit.setElementHidden(leafItem, !isVisible);
    }

    const folderRows = Array.from(treeRoot.querySelectorAll('li[role="treeitem"]')).filter(
      (item) => !item.classList.contains("DiffFileTree-module__file-tree-row__PCB1B")
    );

    for (const folderRow of folderRows) {
      if (!hasActiveFilter) {
        toolkit.setElementHidden(folderRow, false);
        continue;
      }

      const descendantFileRows = Array.from(
        folderRow.querySelectorAll('li[role="treeitem"].DiffFileTree-module__file-tree-row__PCB1B')
      );
      if (descendantFileRows.length === 0) {
        toolkit.setElementHidden(folderRow, false);
        continue;
      }

      const hasVisibleDescendant = descendantFileRows.some(
        (fileRow) => !toolkit.isElementHiddenByFilter(fileRow)
      );
      toolkit.setElementHidden(folderRow, !hasVisibleDescendant);
    }

    const visibleLeafCount = leafRows.filter((item) => !toolkit.isElementHiddenByFilter(item)).length;
    return { visibleLeafCount, totalLeafCount: leafRows.length };
  };

  toolkit.getVisibleTreeFiles = () => {
    const treeRoot = toolkit.getTreeRoot();
    if (!treeRoot) {
      return [];
    }

    const leafRows = toolkit.getTreeFileRows(treeRoot);

    return leafRows
      .filter((item) => !toolkit.isElementHiddenByFilter(item))
      .map((item) => {
        const link = toolkit.getTreeItemLinkToDiff(item);
        return toolkit.normalizeFilePath(link?.textContent || item.id || "");
      })
      .filter(Boolean);
  };

  toolkit.logVisibleFilesSnapshot = (selectedOwners) => {
    const rightVisibleFiles = toolkit.getVisibleRightSideFiles();
    const treeVisibleFiles = toolkit.getVisibleTreeFiles();

    console.groupCollapsed(
      `[gh-owner-filter] Apply selected=${selectedOwners.length} | right=${rightVisibleFiles.length} | tree=${treeVisibleFiles.length}`
    );
    console.log("[gh-owner-filter] Selected owners:", selectedOwners);
    console.log("[gh-owner-filter] Right side visible files:", rightVisibleFiles);
    console.log("[gh-owner-filter] Tree view visible files:", treeVisibleFiles);
    console.groupEnd();
  };
})();
