(function () {
  "use strict";

  var config = window.WOOI_CORE.normalizeConfig(window.WOOI_CONFIG);
  var header = document.getElementById("site-header");
  var menuButton = document.querySelector(".menu-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  var dialog = document.getElementById("art-dialog");
  var toast = document.getElementById("toast");
  var toastTimer;
  var lastArtworkButton;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function notify(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2800);
  }

  function externalLink(link, url) {
    if (!url) return;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.hidden = false;
  }

  document.querySelectorAll("[data-contract-address]").forEach(function (node) {
    node.textContent = config.address || "Not announced yet";
  });
  document.querySelectorAll("[data-copy-contract]").forEach(function (button) {
    button.disabled = !config.address;
    button.addEventListener("click", async function () {
      if (!config.address) return;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(config.address);
        } else {
          var field = document.createElement("textarea");
          field.value = config.address;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.appendChild(field);
          field.select();
          var copied = document.execCommand("copy");
          field.remove();
          button.focus();
          if (!copied) throw new Error("Copy unavailable");
        }
        notify("WOOI contract address copied.");
      } catch (_) {
        notify("Please select and copy the full address.");
      }
    });
  });

  if (config.address) {
    document.querySelector("[data-launch-status]").textContent = "Contract announced";
    document.querySelector("[data-contract-help]").textContent = "Match this full Ethereum address before using a trading link.";
  }
  document.querySelectorAll("[data-buy-link]").forEach(function (link) {
    if (config.buy) {
      externalLink(link, config.buy);
      link.textContent = "Buy $WOOI ↗";
    }
  });
  document.querySelectorAll("[data-market-link]").forEach(function (link) {
    var key = link.getAttribute("data-market-link");
    externalLink(link, config[key]);
  });
  var socialCount = 0;
  document.querySelectorAll("[data-social-link]").forEach(function (link) {
    var key = link.getAttribute("data-social-link");
    if (config[key]) {
      externalLink(link, config[key]);
      socialCount++;
    }
  });
  document.querySelector("[data-community-pending]").hidden = socialCount > 0;
  var market = document.getElementById("market");
  market.hidden = !config.chart;
  var chartShell = document.querySelector("[data-chart-shell]");
  chartShell.hidden = !config.embed;
  var loadChart = document.querySelector("[data-load-chart]");
  loadChart.addEventListener("click", function () {
    if (!config.embed || chartShell.querySelector("iframe")) return;
    var iframe = document.createElement("iframe");
    iframe.title = "WOOI Ethereum market chart from Dexscreener";
    iframe.src = config.embed;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer";
    iframe.setAttribute("allowfullscreen", "");
    chartShell.replaceChildren(iframe);
  });

  function closeMenu() {
    mobileNav.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    header.classList.remove("menu-is-open");
  }
  menuButton.addEventListener("click", function () {
    var willOpen = mobileNav.hidden;
    mobileNav.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menuButton.setAttribute("aria-label", willOpen ? "Close navigation" : "Open navigation");
    header.classList.toggle("menu-is-open", willOpen);
  });
  mobileNav.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
  });
  window.addEventListener("resize", function () { if (window.innerWidth > 900) closeMenu(); }, { passive: true });
  document.addEventListener("click", function (event) {
    if (!mobileNav.hidden && !header.contains(event.target)) closeMenu();
  });

  var art = {
    entry: { file: "story-01-entry", title: "Into Wildwood", alt: "Curtis and Prue entering an unfamiliar woodland" },
    crossing: { file: "story-02-crossing", title: "Crossing Together", alt: "Prue and Curtis helping one another cross a fallen tree" },
    contribution: { file: "story-03-contribution", title: "The Outsider Contributes", alt: "Curtis and Septima helping free another captive" },
    "fan-art": { file: "story-04-fan-art", title: "Human Admiration, Different Tools", alt: "A human fan creating AI-assisted artwork inspired by Wildwood" },
    humor: { file: "supporting-humor", title: "Big Fan. Awkward Tools.", alt: "A sheepish fan beside AI-assisted Wildwood artwork" }
  };
  document.querySelectorAll("[data-art]").forEach(function (button) {
    button.addEventListener("click", function () {
      var item = art[button.getAttribute("data-art")];
      if (!item || typeof dialog.showModal !== "function") return;
      lastArtworkButton = button;
      document.getElementById("dialog-title").textContent = item.title;
      var image = document.getElementById("dialog-image");
      image.src = "assets/web/" + item.file + "-1600.jpg";
      image.alt = item.alt;
      var download = document.getElementById("dialog-download");
      download.href = image.getAttribute("src");
      download.download = "WOOI-" + item.file + ".jpg";
      dialog.showModal();
      document.body.classList.add("dialog-open");
    });
  });
  dialog.querySelector(".dialog-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      var bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  dialog.addEventListener("close", function () {
    document.body.classList.remove("dialog-open");
    if (lastArtworkButton) lastArtworkButton.focus({ preventScroll: true });
  });

  var scrollPending = false;
  function scrollState() {
    var top = window.scrollY;
    var total = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle("is-scrolled", top > 40);
    document.querySelector(".reading-progress").style.transform = "scaleX(" + (total > 0 ? Math.min(1, top / total) : 0) + ")";
    scrollPending = false;
  }
  window.addEventListener("scroll", function () {
    if (!scrollPending) { scrollPending = true; window.requestAnimationFrame(scrollState); }
  }, { passive: true });
  scrollState();

  if ("IntersectionObserver" in window && !reducedMotion) {
    var reveals = document.querySelectorAll(".reveal");
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px 35px 0px" });
    reveals.forEach(function (node) { revealObserver.observe(node); });
    window.setTimeout(function () {
      document.querySelectorAll(".reveal").forEach(function (node) { node.classList.add("is-visible"); });
    }, 4000);
  }
  if ("IntersectionObserver" in window) {
    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var current = entry.target.id;
        if (current === "crossing" || current === "contribution") current = "story";
        document.querySelectorAll("[data-nav]").forEach(function (link) {
          var active = link.getAttribute("data-nav") === current;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
        });
      });
    }, { threshold: 0.2, rootMargin: "-10% 0px -35% 0px" });
    ["story", "crossing", "contribution", "our-place", "token", "community"].forEach(function (id) {
      navObserver.observe(document.getElementById(id));
    });
  }
})();
