(function () {
  const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
  let scheduledFrame = null;

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function findHashTarget(hash) {
    if (!hash || !hash.startsWith("#") || hash.length === 1) return null;

    try {
      return document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
  }

  function directHeading(target) {
    if (target.matches(HEADING_SELECTOR)) return target;
    if (!target.matches("section")) return null;
    return target.querySelector(":scope > " + HEADING_SELECTOR);
  }

  function visualTarget(target) {
    if (!target) return null;

    // Tutorial step fragments address state, but the useful visual destination
    // is the complete activity rather than the currently visible step text.
    if (target.matches(".tutorial-step")) {
      return target.closest(".callout") || target;
    }

    return directHeading(target) || target;
  }

  function rootFontSize() {
    const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(size) ? size : 16;
  }

  function headerHeight() {
    const header = document.querySelector("header.fixed-top");
    return header ? header.clientHeight : 0;
  }

  function targetGap(target, destination, options) {
    if (options && Number.isFinite(options.gap)) return options.gap;

    // A heading benefits from a line of breathing room. A bordered object such
    // as a callout or figure should put its actual top edge at the content edge.
    return directHeading(target) === destination ? rootFontSize() : 0;
  }

  function scrollTarget(target, options) {
    const destination = visualTarget(target);
    if (!destination || !destination.isConnected || typeof window.scrollTo !== "function") {
      return false;
    }

    const top = (Number(window.scrollY) || 0) +
      destination.getBoundingClientRect().top -
      headerHeight() -
      targetGap(target, destination, options);

    window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
    return true;
  }

  function scrollHash(hash, options) {
    return scrollTarget(findHashTarget(hash), options);
  }

  function scheduleTarget(target, options) {
    if (scheduledFrame !== null) window.cancelAnimationFrame(scheduledFrame);
    scheduledFrame = window.requestAnimationFrame(function () {
      scheduledFrame = null;
      scrollTarget(target, options);
    });
  }

  function scheduleHash(hash, options) {
    if (scheduledFrame !== null) window.cancelAnimationFrame(scheduledFrame);
    scheduledFrame = window.requestAnimationFrame(function () {
      scheduledFrame = null;
      scrollHash(hash, options);
    });
  }

  function isPlainPrimaryClick(event) {
    return !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey;
  }

  function sameDocumentHash(link) {
    if (!link || !link.getAttribute("href") || link.hasAttribute("download")) return null;
    if (link.target && link.target !== "_self") return null;
    if (link.hasAttribute("data-bs-toggle")) return null;

    let url;
    try {
      url = new URL(link.href, document.baseURI);
    } catch {
      return null;
    }

    if (
      url.origin !== window.location.origin ||
      url.pathname !== window.location.pathname ||
      url.search !== window.location.search ||
      !url.hash ||
      url.hash === "#"
    ) {
      return null;
    }

    return findHashTarget(url.hash) ? url.hash : null;
  }

  function handleDocumentClick(event) {
    if (!isPlainPrimaryClick(event)) return;
    const link = event.target && event.target.closest
      ? event.target.closest("a[href]")
      : null;
    const hash = sameDocumentHash(link);
    if (hash) scheduleHash(hash);
  }

  function alignCurrentHash() {
    if (window.location.hash) scheduleHash(window.location.hash);
  }

  window.bcAnchorNavigation = {
    findHashTarget,
    scrollTarget,
    scrollHash,
    scheduleTarget,
    scheduleHash
  };

  window.addEventListener("hashchange", alignCurrentHash);
  window.addEventListener("load", alignCurrentHash);
  onReady(function () {
    document.addEventListener("click", handleDocumentClick);
    alignCurrentHash();
  });
})();
