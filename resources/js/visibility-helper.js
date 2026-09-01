onVisible = function(element, callback, threshold = 1.0) {
  let fired = false;
  const fireOnce = (obs) => {
    if (fired) return;
    fired = true;
    callback();
    if (obs) obs.disconnect();
  };

  const obs = new IntersectionObserver(([entry], observer) => {
    if (entry.isIntersecting) {
      fireOnce(observer);
    }
  }, { threshold });

  obs.observe(element);

  // Handles elements that are already visible at initial page load.
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const isVisibleNow =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth;
    if (isVisibleNow) fireOnce(obs);
  });
}