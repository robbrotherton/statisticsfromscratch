(function () {
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function stripDuplicateIds(element) {
    element.querySelectorAll("[id]").forEach((node) => {
      node.removeAttribute("id");
    });
  }

  function syncActiveLinks(sourceToc, sidebarToc) {
    const sourceList = sourceToc.querySelector(":scope > ul");
    if (!sourceList) return;

    const activeHrefs = new Set(
      Array.from(sourceToc.querySelectorAll("a.nav-link.active"))
        .map((link) => {
          let item = link.closest("li");

          // Promote hidden nested headings to their visible level-2 section.
          while (item && item.parentElement !== sourceList) {
            item = item.parentElement && item.parentElement.closest("li");
          }

          const sectionLink = item && item.querySelector(":scope > a.nav-link");
          return sectionLink && sectionLink.getAttribute("href");
        })
        .filter(Boolean)
    );

    sidebarToc.querySelectorAll("a").forEach((link) => {
      link.classList.toggle("active", activeHrefs.has(link.getAttribute("href")));
    });
  }

  const anchorNavigation = window.sfsAnchorNavigation;
  const findHashTarget = anchorNavigation.findHashTarget;
  const scrollTargetBelowNavbar = anchorNavigation.scrollTarget;

  function scrollToSidebarTarget(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const link = event.currentTarget;
    const hash = link.getAttribute("data-scroll-target");
    const target = findHashTarget(hash);
    if (!target) return;

    event.preventDefault();

    if (window.location.hash !== hash) {
      window.history.pushState({ sidebarToc: true }, "", hash);
    }

    scrollTargetBelowNavbar(target);
  }

  function enhanceSidebarToc() {
    const sidebar = document.querySelector("#quarto-sidebar");
    const activeChapter = sidebar && sidebar.querySelector("a.sidebar-link.active");
    const sourceToc = document.querySelector("#TOC");
    const sourceList = sourceToc && sourceToc.querySelector(":scope > ul");

    if (!sidebar || !activeChapter || !sourceToc || !sourceList) return;

    const activeItem = activeChapter.closest("li.sidebar-item");
    if (!activeItem || activeItem.querySelector(":scope > .sidebar-page-toc")) return;

    const sidebarToc = document.createElement("ul");
    sidebarToc.className = "sidebar-page-toc list-unstyled";
    sidebarToc.setAttribute("aria-label", "This chapter");
    sidebarToc.innerHTML = sourceList.innerHTML;
    stripDuplicateIds(sidebarToc);
    sidebarToc.querySelectorAll("a[data-scroll-target]").forEach((link) => {
      link.addEventListener("click", scrollToSidebarTarget);
    });

    activeItem.append(sidebarToc);
    syncActiveLinks(sourceToc, sidebarToc);
    document.body.classList.add("sidebar-toc-enabled");

    const observer = new MutationObserver(() => {
      syncActiveLinks(sourceToc, sidebarToc);
    });

    sourceToc.querySelectorAll("a.nav-link").forEach((link) => {
      observer.observe(link, { attributes: true, attributeFilter: ["class"] });
    });
  }

  window.addEventListener("popstate", (event) => {
    if (!event.state || event.state.sidebarToc !== true) return;

    window.requestAnimationFrame(() => {
      const target = findHashTarget(window.location.hash);
      if (target) scrollTargetBelowNavbar(target);
    });
  });

  onReady(enhanceSidebarToc);
})();
