(() => {
  const toolkit = window.__ghPrToolkit;

  toolkit.extractOwnersFromText = (value) => {
    if (!value || !value.includes("Owned by")) {
      return [];
    }

    const owners = value.match(/@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/g);
    return owners || [];
  };

  toolkit.getOwnersFromPage = () => {
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
    container.style.background = "var(--bgColor-default, #ffffff)";
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
    const hoverUrl = badge.getAttribute("data-hovercard-url");
    if (!hoverUrl) {
      return;
    }

    const container = toolkit.ensureHovercardContainer();
    const rect = badge.getBoundingClientRect();
    container.style.left = `${window.scrollX + rect.left}px`;
    container.style.top = `${window.scrollY + rect.bottom + 6}px`;
    container.style.display = "block";
    container.innerHTML = '<div class="gh-owner-filter-hovercard__loading">Loading...</div>';

    try {
      const response = await fetch(hoverUrl, {
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

      const copyButton = fileBlock.querySelector(".octicon-copy")?.closest("button");

      if (!copyButton) {
        if (existingBadge) {
          existingBadge.remove();
        }
        continue;
      }

      const badge = existingBadge || document.createElement("a");
      badge.className = "gh-owner-filter__file-owner-badge Link--secondary js-hovercard-link";
      badge.textContent = badgeText;
      badge.removeAttribute("title");

      const hoverMeta = toolkit.ownerHandleToHovercardMeta(owners[0]);
      if (hoverMeta) {
        badge.classList.remove("gh-owner-filter__file-owner-badge--no-owner");
        badge.href = hoverMeta.href;
        badge.setAttribute("data-hovercard-type", hoverMeta.hoverType);
        badge.setAttribute("data-hovercard-url", hoverMeta.hoverUrl);
        badge.setAttribute("data-octo-click", "hovercard-link-click");
        badge.setAttribute("data-octo-dimensions", "link_type:self");
        badge.setAttribute("target", "_blank");
        badge.setAttribute("rel", "noopener noreferrer");
      } else {
        badge.classList.add("gh-owner-filter__file-owner-badge--no-owner");
        badge.removeAttribute("href");
        badge.removeAttribute("data-hovercard-type");
        badge.removeAttribute("data-hovercard-url");
        badge.removeAttribute("data-octo-click");
        badge.removeAttribute("data-octo-dimensions");
      }

      toolkit.bindBadgeHoverHandlers(badge);

      if (!existingBadge) {
        copyButton.insertAdjacentElement("afterend", badge);
      }
    }
  };
})();
