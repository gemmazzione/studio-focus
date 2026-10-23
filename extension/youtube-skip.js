// Seconda difesa contro gli annunci di YouTube: nasconde i riquadri pubblicitari
// e, se un annuncio parte lo stesso, lo porta alla fine e preme "Salta".
(() => {
  const style = document.createElement("style");
  style.textContent = `
    ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer,
    ytd-display-ad-renderer, ytd-banner-promo-renderer, ytd-statement-banner-renderer,
    ytd-companion-slot-renderer, ytd-action-companion-ad-renderer, ytd-player-legacy-desktop-watch-ads-renderer,
    #masthead-ad, #player-ads, .ytp-ad-overlay-container, .ytp-ad-image-overlay,
    ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, ad-slot-renderer
    { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);

  function skip() {
    const player = document.querySelector(".html5-video-player");
    if (!player?.classList.contains("ad-showing")) return;
    const video = player.querySelector("video");
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
    document
      .querySelectorAll(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern")
      .forEach((b) => b.click());
  }
  new MutationObserver(skip).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
  });
  setInterval(skip, 500);
})();
