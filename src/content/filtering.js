(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.applyOwnerFilter = (selectedOwners, includeTestFiles = toolkit.state.includeTestFiles) => {
    const selected = new Set(selectedOwners);
    const includesNoOwner = selected.has(toolkit.constants.NO_OWNER_FILTER_VALUE);
    const fileBlocks = toolkit.getDiffFileBlocks();
    let visibleCount = 0;

    for (const fileBlock of fileBlocks) {
      const diffContainer = toolkit.getDiffBlockWrapper(fileBlock);
      const filePath = toolkit.getFilePathFromFileBlock(fileBlock);
      const isTestPath = toolkit.isTestFilePath(filePath);
      const isAllowedByTestFilter = includeTestFiles || !isTestPath;
      const fileOwners = toolkit.getOwnersForFileBlock(fileBlock);
      const hasSelectedOwner = Array.from(fileOwners).some((owner) => selected.has(owner));
      const isNoOwnerMatch = includesNoOwner && fileOwners.size === 0;
      const isOwnerMatch = selected.size === 0 || hasSelectedOwner || isNoOwnerMatch;
      const isMatch = isOwnerMatch && isAllowedByTestFilter;
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
        const path = toolkit.getFilePathFromFileBlock(fileBlock);
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

  toolkit.applyTreeViewFilter = (selectedOwners, includeTestFiles = toolkit.state.includeTestFiles) => {
    const treeRoot = toolkit.getTreeRoot();
    if (!treeRoot) {
      return { visibleLeafCount: 0, totalLeafCount: 0 };
    }
    const hasActiveFilter = selectedOwners.length > 0 || !includeTestFiles;
    const selectedSet = new Set(selectedOwners);
    const includesNoOwner = selectedSet.has(toolkit.constants.NO_OWNER_FILTER_VALUE);
    const ownerData = toolkit.state.ownerData;
    const visibleEntries = toolkit.getVisibleRightSideEntries();
    const visibleDiffIds = new Set(visibleEntries.map((entry) => entry.diffId));
    const visiblePaths = new Set(visibleEntries.map((entry) => entry.path));
    const matchedPathsByData = new Set();

    if (hasActiveFilter && ownerData.status === "ready" && ownerData.source === "codeowners") {
      for (const [path, owners] of Object.entries(ownerData.ownersByPath || {})) {
        if (!Array.isArray(owners)) {
          continue;
        }

        const normalizedPath = toolkit.normalizeFilePath(path);
        const isAllowedByTestFilter = includeTestFiles || !toolkit.isTestFilePath(normalizedPath);
        if (
          isAllowedByTestFilter &&
          (owners.some((owner) => selectedSet.has(owner)) || (includesNoOwner && owners.length === 0))
        ) {
          matchedPathsByData.add(normalizedPath);
        }
      }
    }

    const leafRows = toolkit.getTreeFileRows(treeRoot);

    for (const leafItem of leafRows) {
      const diffHref = toolkit.getTreeItemLinkToDiff(leafItem)?.getAttribute("href") || "";
      const diffId = diffHref.replace("#", "");
      const treePath = toolkit.normalizeFilePath(leafItem.id);
      const isAllowedByTestFilter = includeTestFiles || !toolkit.isTestFilePath(treePath);
      const isVisible =
        isAllowedByTestFilter &&
        (!hasActiveFilter ||
          visibleDiffIds.has(diffId) ||
          visiblePaths.has(treePath) ||
          matchedPathsByData.has(treePath));
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

  toolkit.logVisibleFilesSnapshot = (selectedOwners, includeTestFiles = toolkit.state.includeTestFiles) => {
    const rightVisibleFiles = toolkit.getVisibleRightSideFiles();
    const treeVisibleFiles = toolkit.getVisibleTreeFiles();

    console.groupCollapsed(
      `[gh-owner-filter] Apply selected=${selectedOwners.length} | includeTest=${includeTestFiles} | right=${rightVisibleFiles.length} | tree=${treeVisibleFiles.length}`
    );
    console.log("[gh-owner-filter] Selected owners:", selectedOwners);
    console.log("[gh-owner-filter] Include test files:", includeTestFiles);
    console.log("[gh-owner-filter] Right side visible files:", rightVisibleFiles);
    console.log("[gh-owner-filter] Tree view visible files:", treeVisibleFiles);
    console.groupEnd();
  };
})();
