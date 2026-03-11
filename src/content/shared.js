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
    return Boolean(toolkit.parsePullRequestRoute());
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
    const treeRoot = toolkit.getTreeRoot();
    const treeParent = treeRoot?.parentElement || null;
    const siblingAboveTree = treeRoot?.previousElementSibling || null;
    if (treeParent && siblingAboveTree?.querySelector?.("#diff-file-tree-filter, input[type='text']")) {
      return { parent: treeParent, before: siblingAboveTree };
    }

    const sidebarContainer =
      treeContainer?.closest("#pr-file-tree, .diff-sidebar") ||
      treeRoot?.closest("#pr-file-tree, .diff-sidebar") ||
      document.querySelector("#pr-file-tree, .diff-sidebar");
    const filterHost = sidebarContainer?.querySelector("#diff-file-tree-filter, diff-file-filter");
    if (filterHost?.parentElement) {
      return { parent: filterHost.parentElement, before: filterHost };
    }

    const filterInput =
      sidebarContainer?.querySelector("#file-tree-filter-field") ||
      sidebarContainer?.querySelector('input.prc-components-Input-IwWrt[type="text"]') ||
      sidebarContainer?.querySelector('input[type="text"][aria-label*="Filter changed files"]') ||
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

  toolkit.getDiffFileBlocks = () => {
    const blocks = [
      ...Array.from(document.querySelectorAll('div[id^="diff-"][role="region"]')),
      ...Array.from(document.querySelectorAll('div.file.js-file[id^="diff-"], div.js-file[id^="diff-"]'))
    ];
    return Array.from(new Set(blocks));
  };

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
    const match = window.location.pathname.match(
      /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(?:files|changes)\/?$/
    );
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

    const directDataPath = fileBlock.getAttribute("data-path");
    const pathNode =
      fileBlock.querySelector("h3 code") ||
      fileBlock.querySelector(".file-info a[title]") ||
      fileBlock.querySelector(".file-header a[title]") ||
      fileBlock.querySelector(".file-info a[data-path]") ||
      fileBlock.querySelector("[data-path]");
    const attributePath = pathNode?.getAttribute?.("data-path") || pathNode?.getAttribute?.("title");
    const rawPath = directDataPath || attributePath || pathNode?.textContent || fileBlock.id || "";
    const deEllipsized = rawPath.replace(/^\.\.\.\//, "");
    return toolkit.normalizeFilePath(deEllipsized);
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

    const header = fileBlock.querySelector('[class*="DiffFileHeader-module__diff-file-header"], .file-header');
    if (!header) {
      return null;
    }

    const modernButtons = Array.from(header.querySelectorAll('button[data-component="IconButton"]'));
    const modernToggle = modernButtons.find((button) =>
      Boolean(button.querySelector("svg.octicon-chevron-down, svg.octicon-chevron-right"))
    );
    if (modernToggle) {
      return modernToggle;
    }

    return header.querySelector("button.js-details-target, button[aria-label='Toggle diff contents']");
  };

  toolkit.isFileBlockExpanded = (fileBlock) => {
    const toggleButton = toolkit.getFileHeaderToggleButton(fileBlock);
    if (!toggleButton) {
      return null;
    }

    const ariaExpanded = toggleButton.getAttribute("aria-expanded");
    if (ariaExpanded === "true") {
      return true;
    }
    if (ariaExpanded === "false") {
      return false;
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

  toolkit.isTreeFileRow = (treeItem) => {
    if (!treeItem || !toolkit.getTreeItemLinkToDiff(treeItem)) {
      return false;
    }

    if (
      treeItem.classList.contains("DiffFileTree-module__file-tree-row__PCB1B") ||
      treeItem.classList.contains("ActionList-item--subItem")
    ) {
      return true;
    }

    return !treeItem.querySelector(":scope li[role='treeitem']");
  };

  toolkit.getTreeFileRows = (treeRoot) =>
    Array.from(treeRoot.querySelectorAll('li[role="treeitem"]')).filter((item) => toolkit.isTreeFileRow(item));
})();
