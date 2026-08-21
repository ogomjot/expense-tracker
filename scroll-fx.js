(function initMoneyBadgeScroll() {
  const badges = document.querySelectorAll(".money-spin");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!badges.length || reduceMotion.matches) return;

  const scrollDistancePerRotation = 1000;
  let frameRequested = false;

  function updateBadgeRotation() {
    const degrees = (window.scrollY / scrollDistancePerRotation) * 360;
    badges.forEach((badge) => {
      badge.style.transform = `rotate(${degrees}deg)`;
    });
    frameRequested = false;
  }

  function requestBadgeRotation() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateBadgeRotation);
  }

  window.addEventListener("scroll", requestBadgeRotation, { passive: true });
  requestBadgeRotation();
})();
