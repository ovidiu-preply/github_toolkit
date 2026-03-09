(() => {
  const toolkit = (window.__ghPrToolkit = window.__ghPrToolkit || {});

  toolkit.constants = {
    ROOT_ID: "gh-owner-filter-root",
    RIGHT_CONTROLS_ID: "gh-owner-filter-right-controls",
    HOVERCARD_ID: "gh-owner-filter-hovercard",
    TEST_FILES_FILTER_ID: "gh-owner-filter-test-files-toggle",
    NO_OWNER_FILTER_VALUE: "__GH_OWNER_FILTER_NO_OWNER__",
    DEBUG: false
  };

  toolkit.state = {
    lastOwnerSignature: "",
    lastPathname: "",
    activeOwnerFilter: [],
    includeTestFiles: true,
    hovercardHideTimer: null,
    ownerData: {
      status: "idle",
      routeKey: "",
      source: "none",
      allOwners: [],
      ownersByPath: {}
    }
  };

  toolkit.log = (...args) => {
    if (!toolkit.constants.DEBUG) {
      return;
    }
    console.log("[gh-owner-filter]", ...args);
  };

  toolkit.isPullRequestFilesView = () => {
    const path = window.location.pathname;
    return /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/(?:files|changes))?\/?$/.test(path);
  };

  toolkit.findMountPoint = () =>
    document.querySelector(".gh-header-actions") ||
    document.querySelector(".pr-toolbar") ||
    document.querySelector(".gh-header-meta") ||
    document.body;

  toolkit.findSidebarMountTarget = () => {
    const filterRowById = document.getElementById("diff-file-tree-filter");
    if (filterRowById?.parentElement) {
      return { parent: filterRowById.parentElement, before: filterRowById };
    }

    const treeContainer =
      document.querySelector('div[class*="PullRequestFileTree-module__FileTreeScrollable"]') ||
      document.querySelector('div[class*="PullRequestFileTree"]');
    if (!treeContainer) {
      return null;
    }

    const treeRoot = treeContainer.querySelector('ul[role="tree"]');
    if (!treeRoot) {
      return null;
    }

    const treeParent = treeRoot.parentElement;
    if (!treeParent) {
      return null;
    }

    const siblingAboveTree = treeRoot.previousElementSibling;
    if (siblingAboveTree?.querySelector?.("#diff-file-tree-filter, input[type='text']")) {
      return { parent: treeParent, before: siblingAboveTree };
    }

    const sidebarContainer = treeContainer.closest("#pr-file-tree") || treeContainer.parentElement;
    const filterHost = sidebarContainer?.querySelector("#diff-file-tree-filter");
    if (filterHost?.parentElement) {
      return { parent: filterHost.parentElement, before: filterHost };
    }

    const filterInput =
      sidebarContainer?.querySelector('input.prc-components-Input-IwWrt[type="text"]') ||
      sidebarContainer?.querySelector('input[type="text"]');
    if (!filterInput) {
      return null;
    }

    const filterRow = filterInput.closest("div");
    if (!filterRow || !filterRow.parentElement) {
      return null;
    }

    return { parent: filterRow.parentElement, before: filterRow };
  };

  toolkit.getDiffFileBlocks = () => Array.from(document.querySelectorAll('div[id^="diff-"][role="region"]'));

  toolkit.findRightSideMountTarget = () => {
    const fileBlock = toolkit.getDiffFileBlocks().find((block) => toolkit.isActuallyVisible(block));
    if (!fileBlock) {
      return null;
    }

    const wrapper = toolkit.getDiffBlockWrapper(fileBlock);
    const parent = wrapper.parentElement;
    if (!parent) {
      return null;
    }

    return { parent, before: wrapper };
  };

  toolkit.setElementHidden = (element, hidden) => {
    element.classList.toggle("gh-owner-filter--hidden", hidden);
    if (hidden) {
      element.style.setProperty("display", "none", "important");
    } else {
      element.style.removeProperty("display");
    }
  };

  toolkit.isElementHiddenByFilter = (element) => {
    if (!element) {
      return true;
    }

    const computedDisplay = window.getComputedStyle(element).display;
    return (
      element.classList.contains("gh-owner-filter--hidden") ||
      element.style.display === "none" ||
      computedDisplay === "none"
    );
  };

  toolkit.isActuallyVisible = (element) => {
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return element.getClientRects().length > 0;
  };

  toolkit.normalizeFilePath = (value) => {
    if (!value) {
      return "";
    }

    return value
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
      .trim()
      .replace(/^\/+/, "");
  };

  toolkit.parsePullRequestRoute = () => {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(?:files|changes))?\/?$/);
    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2],
      pullNumber: match[3]
    };
  };

  toolkit.getDiffBlockWrapper = (fileBlock) => {
    const parent = fileBlock.parentElement;
    if (!parent) {
      return fileBlock;
    }

    if (parent.children.length === 1 && parent.firstElementChild === fileBlock) {
      return parent;
    }

    return fileBlock;
  };

  toolkit.getFilePathFromFileBlock = (fileBlock) => {
    if (!fileBlock) {
      return "";
    }

    const pathNode = fileBlock.querySelector("h3 code");
    return toolkit.normalizeFilePath(pathNode?.textContent || fileBlock.id || "");
  };

  toolkit.isTestFilePath = (filePath) => /test/i.test(toolkit.normalizeFilePath(filePath));

  toolkit.getAllChangedFilePaths = () => {
    const uniquePaths = new Set();
    for (const fileBlock of toolkit.getDiffFileBlocks()) {
      const path = toolkit.getFilePathFromFileBlock(fileBlock);
      if (path) {
        uniquePaths.add(path);
      }
    }
    return Array.from(uniquePaths);
  };

  toolkit.getFileHeaderToggleButton = (fileBlock) => {
    if (!fileBlock) {
      return null;
    }

    const header = fileBlock.querySelector('[class*="DiffFileHeader-module__diff-file-header"]');
    if (!header) {
      return null;
    }

    const buttons = Array.from(header.querySelectorAll('button[data-component="IconButton"]'));
    return (
      buttons.find((button) =>
        Boolean(button.querySelector("svg.octicon-chevron-down, svg.octicon-chevron-right"))
      ) || null
    );
  };

  toolkit.isFileBlockExpanded = (fileBlock) => {
    const toggleButton = toolkit.getFileHeaderToggleButton(fileBlock);
    if (!toggleButton) {
      return null;
    }

    if (toggleButton.querySelector("svg.octicon-chevron-down")) {
      return true;
    }

    if (toggleButton.querySelector("svg.octicon-chevron-right")) {
      return false;
    }

    return null;
  };

  toolkit.setAllRightSideFilesExpanded = (expand) => {
    const fileBlocks = toolkit
      .getDiffFileBlocks()
      .filter((fileBlock) => !toolkit.isElementHiddenByFilter(fileBlock));
    let changedCount = 0;
    let actionableCount = 0;

    for (const fileBlock of fileBlocks) {
      const expanded = toolkit.isFileBlockExpanded(fileBlock);
      const toggleButton = toolkit.getFileHeaderToggleButton(fileBlock);
      if (expanded === null || !toggleButton) {
        continue;
      }

      actionableCount += 1;
      const shouldClick = expand ? !expanded : expanded;
      if (!shouldClick) {
        continue;
      }

      toggleButton.click();
      changedCount += 1;
    }

    return { changedCount, actionableCount };
  };

  toolkit.getTreeRoot = () => {
    const roots = Array.from(
      document.querySelectorAll(
        'div[class*="PullRequestFileTree"] ul[role="tree"], ul[role="tree"][aria-label*="File"], ul[role="tree"]'
      )
    );

    if (roots.length === 0) {
      return null;
    }

    const visibleRoot = roots.find((root) => toolkit.isActuallyVisible(root));
    return visibleRoot || roots[0];
  };

  toolkit.getTreeItemLinkToDiff = (treeItem) => treeItem.querySelector('a[href^="#diff-"]');

  toolkit.getTreeFileRows = (treeRoot) =>
    Array.from(treeRoot.querySelectorAll('li[role="treeitem"].DiffFileTree-module__file-tree-row__PCB1B')).filter(
      (item) => Boolean(toolkit.getTreeItemLinkToDiff(item))
    );
})();
