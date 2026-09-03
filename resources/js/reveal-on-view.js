(function () {
  const DEFAULT_CLASS = "is-revealed";
  const DEFAULT_THRESHOLD = 0.6;

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  // Marks an element the first time it scrolls into view, so a figure that is
  // drawn in markup can play a CSS entrance the way the JavaScript figures use
  // onVisible(). Without the helper the class lands immediately, which leaves
  // the figure in its finished state rather than an unplayed one.
  function reveal(element) {
    const className = element.dataset.revealOnView || DEFAULT_CLASS;
    const threshold = Number(element.dataset.revealThreshold) || DEFAULT_THRESHOLD;
    const play = function () {
      element.classList.add(className);
    };

    if (typeof onVisible === "function") {
      onVisible(element, play, threshold);
    } else {
      play();
    }
  }

  onReady(function () {
    document.querySelectorAll("[data-reveal-on-view]").forEach(reveal);
  });
})();
