(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.extractOwnersFromText = (value) => {
    if (!value || !value.includes("Owned by")) {
      return [];
    }

    const owners = value.match(/@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/g);
    return owners || [];
  };

  toolkit.fetchGithubCodeownersData = async (owner, repo, pullNumber) => {
    const endpoint = `/${owner}/${repo}/pull/${pullNumber}/page_data/codeowners`;
    const response = await fetch(endpoint, {
      credentials: "same-origin",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch codeowners page data: ${response.status}`);
    }

    return response.json();
  };

  toolkit.getEmbeddedDiffSummaryPaths = () => {
    const embeddedDataNode = document.querySelector('script[data-target="react-app.embeddedData"]');
    if (!embeddedDataNode?.textContent) {
      return [];
    }

    try {
      const embeddedData = JSON.parse(embeddedDataNode.textContent);
      const summaries = embeddedData?.payload?.pullRequestsChangesRoute?.diffSummaries;
      if (!Array.isArray(summaries)) {
        return [];
      }

      const paths = new Set();
      for (const summary of summaries) {
        const normalizedPath = toolkit.normalizeFilePath(summary?.path || "");
        if (normalizedPath) {
          paths.add(normalizedPath);
        }
      }

      return Array.from(paths);
    } catch (_error) {
      return [];
    }
  };

  toolkit.buildOwnersFromCodeownersPayload = (payload, allChangedPaths) => {
    const ownersByPath = {};
    const ownerSet = new Set();
    const ownershipByPath = payload?.ownershipByPath;
    const normalizedAllChangedPaths = Array.isArray(allChangedPaths)
      ? allChangedPaths.map((path) => toolkit.normalizeFilePath(path)).filter(Boolean)
      : [];

    for (const path of normalizedAllChangedPaths) {
      ownersByPath[path] = [];
    }

    if (ownershipByPath && typeof ownershipByPath === "object") {
      for (const [rawPath, ownership] of Object.entries(ownershipByPath)) {
        const normalizedPath = toolkit.normalizeFilePath(rawPath);
        if (!normalizedPath) {
          continue;
        }

        const owners = Array.isArray(ownership?.owners)
          ? ownership.owners.filter((owner) => typeof owner === "string" && owner.startsWith("@"))
          : [];
        ownersByPath[normalizedPath] = owners;
        for (const owner of owners) {
          ownerSet.add(owner);
        }
      }
    }

    return {
      ownersByPath,
      allOwners: Array.from(ownerSet).sort((a, b) => a.localeCompare(b))
    };
  };

  toolkit.refreshOwnerData = async () => {
    const route = toolkit.parsePullRequestRoute();
    if (!route) {
      toolkit.state.ownerData = {
        status: "idle",
        routeKey: "",
        source: "none",
        allOwners: [],
        ownersByPath: {}
      };
      return;
    }

    const routeKey = `${route.owner}/${route.repo}#${route.pullNumber}`;
    const currentState = toolkit.state.ownerData;
    if (
      currentState.routeKey === routeKey &&
      (currentState.status === "loading" || currentState.status === "ready")
    ) {
      return;
    }

    toolkit.state.ownerData = {
      status: "loading",
      routeKey,
      source: "none",
      allOwners: [],
      ownersByPath: {}
    };

    try {
      const [payload, allChangedPaths] = await Promise.all([
        toolkit.fetchGithubCodeownersData(route.owner, route.repo, route.pullNumber),
        Promise.resolve(toolkit.getEmbeddedDiffSummaryPaths())
      ]);
      if (!payload?.isEnabled) {
        toolkit.state.ownerData = {
          status: "error",
          routeKey,
          source: "none",
          allOwners: [],
          ownersByPath: {}
        };
        return;
      }

      const computed = toolkit.buildOwnersFromCodeownersPayload(payload, allChangedPaths);
      toolkit.state.ownerData = {
        status: "ready",
        routeKey,
        source: "codeowners",
        allOwners: computed.allOwners,
        ownersByPath: computed.ownersByPath
      };
    } catch (error) {
      toolkit.log("Owner data refresh failed:", error);
      toolkit.state.ownerData = {
        status: "error",
        routeKey,
        source: "none",
        allOwners: [],
        ownersByPath: {}
      };
    }
  };

  toolkit.getOwnersForPathFromData = (path) => {
    const normalized = toolkit.normalizeFilePath(path);
    if (!normalized) {
      return [];
    }

    const ownerData = toolkit.state.ownerData;
    const owners = ownerData.ownersByPath?.[normalized];
    return Array.isArray(owners) ? owners : [];
  };

  toolkit.pathExistsInOwnerData = (path) => {
    const normalized = toolkit.normalizeFilePath(path);
    if (!normalized) {
      return false;
    }

    const ownerData = toolkit.state.ownerData;
    return Boolean(ownerData.ownersByPath && Object.hasOwn(ownerData.ownersByPath, normalized));
  };

  toolkit.getOwnerFileCounts = () => {
    const ownerCounts = new Map();
    const ownerData = toolkit.state.ownerData;

    if (ownerData.status === "ready" && ownerData.source === "codeowners") {
      for (const owners of Object.values(ownerData.ownersByPath || {})) {
        if (!Array.isArray(owners)) {
          continue;
        }

        for (const owner of owners) {
          ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
        }
      }
      return ownerCounts;
    }

    for (const fileBlock of toolkit.getDiffFileBlocks()) {
      const ownersForFile = toolkit.getOwnersForFileBlock(fileBlock);
      for (const owner of ownersForFile) {
        ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
      }
    }

    return ownerCounts;
  };

  toolkit.getNoOwnerFileCount = () => {
    const ownerData = toolkit.state.ownerData;
    if (ownerData.status === "ready" && ownerData.source === "codeowners") {
      let noOwnerCount = 0;
      for (const owners of Object.values(ownerData.ownersByPath || {})) {
        if (Array.isArray(owners) && owners.length === 0) {
          noOwnerCount += 1;
        }
      }
      return noOwnerCount;
    }

    let noOwnerCount = 0;
    for (const fileBlock of toolkit.getDiffFileBlocks()) {
      if (toolkit.getOwnersForFileBlock(fileBlock).size === 0) {
        noOwnerCount += 1;
      }
    }
    return noOwnerCount;
  };

  toolkit.getOwnersFromPage = () => {
    const ownerData = toolkit.state.ownerData;
    if (ownerData.status === "ready" && ownerData.source === "codeowners") {
      return ownerData.allOwners;
    }

    const owners = new Set();
    const candidateElements = document.querySelectorAll(
      '[aria-label*="Owned by"], [title*="Owned by"], span.prc-TooltipV2-Tooltip-tLeuB'
    );

    for (const element of candidateElements) {
      const textValues = [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent
      ];

      for (const textValue of textValues) {
        const foundOwners = toolkit.extractOwnersFromText(textValue);
        for (const owner of foundOwners) {
          owners.add(owner);
        }
      }
    }

    return Array.from(owners).sort((a, b) => a.localeCompare(b));
  };

  toolkit.getOwnersForFileBlock = (fileBlock) => {
    const pathFromHeader = toolkit.getFilePathFromFileBlock(fileBlock);
    const ownersFromData = toolkit.getOwnersForPathFromData(pathFromHeader);
    if (toolkit.pathExistsInOwnerData(pathFromHeader)) {
      return new Set(ownersFromData);
    }

    const owners = new Set();
    const candidateElements = fileBlock.querySelectorAll(
      '[aria-label*="Owned by"], [title*="Owned by"], span.prc-TooltipV2-Tooltip-tLeuB'
    );

    for (const element of candidateElements) {
      const textValues = [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent
      ];

      for (const textValue of textValues) {
        const foundOwners = toolkit.extractOwnersFromText(textValue);
        for (const owner of foundOwners) {
          owners.add(owner);
        }
      }
    }

    return owners;
  };

  toolkit.buildOwnerBadgeText = (owners) => {
    if (owners.length === 0) {
      return "No owner";
    }

    if (owners.length === 1) {
      return owners[0];
    }

    return `${owners[0]} +${owners.length - 1}`;
  };

  toolkit.ownerHandleToHovercardMeta = (handle) => {
    if (!handle || !handle.startsWith("@")) {
      return null;
    }

    const normalized = handle.slice(1);
    const [orgOrUser, team] = normalized.split("/");
    if (!orgOrUser) {
      return null;
    }

    if (team) {
      return {
        href: `/orgs/${orgOrUser}/teams/${team}`,
        hoverType: "team",
        hoverUrl: `/orgs/${orgOrUser}/teams/${team}/hovercard`
      };
    }

    return {
      href: `/${orgOrUser}`,
      hoverType: "user",
      hoverUrl: `/users/${orgOrUser}/hovercard`
    };
  };

  toolkit.ensureHovercardContainer = () => {
    let container = document.getElementById(toolkit.constants.HOVERCARD_ID);
    if (container) {
      return container;
    }

    container = document.createElement("div");
    container.id = toolkit.constants.HOVERCARD_ID;
    container.className = "gh-owner-filter-hovercard";
    container.style.border = "1px solid var(--borderColor-default, #d0d7de)";
    container.style.borderRadius = "8px";
    container.style.background = "var(--bgColor-default, #f6f8fa)";
    container.style.boxShadow = "0 8px 24px rgba(140, 149, 159, 0.2)";
    container.style.overflow = "hidden";
    container.addEventListener("mouseenter", () => {
      if (toolkit.state.hovercardHideTimer) {
        clearTimeout(toolkit.state.hovercardHideTimer);
        toolkit.state.hovercardHideTimer = null;
      }
    });
    container.addEventListener("mouseleave", () => {
      toolkit.hideOwnerHovercard();
    });
    document.body.appendChild(container);
    return container;
  };

  toolkit.hideOwnerHovercard = () => {
    const container = document.getElementById(toolkit.constants.HOVERCARD_ID);
    if (!container) {
      return;
    }

    container.style.display = "none";
    container.innerHTML = "";
  };

  toolkit.showOwnerHovercardForBadge = async (badge) => {
    const ownerHandlesRaw = badge.getAttribute("data-owner-handles");
    const ownerHandles = ownerHandlesRaw
      ? ownerHandlesRaw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
    const fallbackHoverUrl = badge.getAttribute("data-hovercard-url");
    if (ownerHandles.length === 0 && !fallbackHoverUrl) {
      return;
    }

    const container = toolkit.ensureHovercardContainer();
    const rect = badge.getBoundingClientRect();
    container.style.left = `${window.scrollX + rect.left}px`;
    container.style.top = `${window.scrollY + rect.bottom + 6}px`;
    container.style.display = "block";
    container.innerHTML = '<div class="gh-owner-filter-hovercard__loading">Loading...</div>';

    try {
      if (ownerHandles.length === 0 && fallbackHoverUrl) {
        const response = await fetch(fallbackHoverUrl, {
          credentials: "same-origin",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "text/html, */*; q=0.01"
          }
        });
        if (!response.ok) {
          throw new Error(`Hovercard fetch failed with ${response.status}`);
        }

        const html = await response.text();
        container.innerHTML = html;
        return;
      }

      const ownerCardsHtml = await Promise.all(
        ownerHandles.map(async (handle) => {
          const hoverMeta = toolkit.ownerHandleToHovercardMeta(handle);
          if (!hoverMeta?.hoverUrl) {
            return "";
          }

          const response = await fetch(hoverMeta.hoverUrl, {
            credentials: "same-origin",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              Accept: "text/html, */*; q=0.01"
            }
          });
          if (!response.ok) {
            return "";
          }

          return response.text();
        })
      );

      const renderedCards = ownerCardsHtml.filter(Boolean);
      if (renderedCards.length === 0) {
        container.innerHTML = '<div class="gh-owner-filter-hovercard__loading">Could not load.</div>';
        return;
      }

      container.innerHTML = renderedCards
        .map((cardHtml) => `<div class="gh-owner-filter-hovercard__card">${cardHtml}</div>`)
        .join("");
    } catch (error) {
      toolkit.log("Hovercard load failed:", error);
      container.innerHTML = '<div class="gh-owner-filter-hovercard__loading">Could not load.</div>';
    }
  };

  toolkit.bindBadgeHoverHandlers = (badge) => {
    if (badge.dataset.hoverBound === "true") {
      return;
    }

    badge.dataset.hoverBound = "true";

    badge.addEventListener("mouseenter", () => {
      if (toolkit.state.hovercardHideTimer) {
        clearTimeout(toolkit.state.hovercardHideTimer);
        toolkit.state.hovercardHideTimer = null;
      }
      void toolkit.showOwnerHovercardForBadge(badge);
    });

    badge.addEventListener("mouseleave", () => {
      toolkit.state.hovercardHideTimer = setTimeout(() => {
        toolkit.hideOwnerHovercard();
      }, 120);
    });
  };

  toolkit.updateFileOwnerBadges = () => {
    const fileBlocks = toolkit.getDiffFileBlocks();

    for (const fileBlock of fileBlocks) {
      const owners = Array.from(toolkit.getOwnersForFileBlock(fileBlock)).sort((a, b) =>
        a.localeCompare(b)
      );
      const badgeText = toolkit.buildOwnerBadgeText(owners);
      const existingBadge = fileBlock.querySelector(".gh-owner-filter__file-owner-badge");

      const copyIcon = fileBlock.querySelector(".octicon-copy");
      const badgeAnchor =
        copyIcon?.closest("button, clipboard-copy, a, span") ||
        fileBlock.querySelector(".file-info a[title]") ||
        fileBlock.querySelector("h3 code");

      if (!badgeAnchor) {
        if (existingBadge) {
          existingBadge.remove();
        }
        continue;
      }

      const badge = existingBadge || document.createElement("span");
      badge.className = "gh-owner-filter__file-owner-badge Link--secondary";
      badge.textContent = badgeText;
      badge.removeAttribute("title");

      const hoverMeta = toolkit.ownerHandleToHovercardMeta(owners[0]);
      const ownerHandlesValue = owners.join(",");
      if (ownerHandlesValue) {
        badge.setAttribute("data-owner-handles", ownerHandlesValue);
      } else {
        badge.removeAttribute("data-owner-handles");
      }
      if (hoverMeta) {
        badge.classList.remove("gh-owner-filter__file-owner-badge--no-owner");
        badge.setAttribute("data-hovercard-type", hoverMeta.hoverType);
        badge.setAttribute("data-hovercard-url", hoverMeta.hoverUrl);
        badge.removeAttribute("data-octo-click");
        badge.removeAttribute("data-octo-dimensions");
      } else {
        badge.classList.add("gh-owner-filter__file-owner-badge--no-owner");
        badge.removeAttribute("data-hovercard-type");
        badge.removeAttribute("data-hovercard-url");
        badge.removeAttribute("data-octo-click");
        badge.removeAttribute("data-octo-dimensions");
      }

      toolkit.bindBadgeHoverHandlers(badge);

      if (!existingBadge) {
        badgeAnchor.insertAdjacentElement("afterend", badge);
      }
    }
  };
})();
