(function () {
  var MOBILE_QUERY = "(max-width: 991.98px)";

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function closeDropdown(button) {
    if (!button || !window.bootstrap || !window.bootstrap.Dropdown) return;
    var instance = window.bootstrap.Dropdown.getInstance(button);
    if (instance) {
      instance.hide();
      // Dispose so the data API rebuilds the dropdown with the display
      // setting that matches the new container.
      instance.dispose();
    }
  }

  onReady(function () {
    var navbarTools = document.querySelector(
      "#quarto-header .quarto-navbar-tools"
    );
    var sidebar = document.getElementById("quarto-sidebar");
    if (!navbarTools || !sidebar) return;

    var menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className =
      "bc-settings-button quarto-navigation-tool bc-nav-menu-toggle";
    menuButton.setAttribute("data-bs-toggle", "collapse");
    menuButton.setAttribute("data-bs-target", ".quarto-sidebar-collapse-item");
    menuButton.setAttribute("aria-controls", "quarto-sidebar");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Chapter menu");
    menuButton.title = "Menu";
    menuButton.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
    navbarTools.appendChild(menuButton);

    var drawerTools = document.createElement("div");
    drawerTools.className = "bc-drawer-tools";
    sidebar.prepend(drawerTools);

    if (document.getElementById("quarto-search")) {
      var searchButton = document.createElement("button");
      searchButton.type = "button";
      searchButton.className = "bc-settings-button";
      searchButton.setAttribute("aria-label", "Search");
      searchButton.title = "Search";
      searchButton.innerHTML =
        '<i class="bi bi-search" aria-hidden="true"></i>';
      searchButton.addEventListener("click", function () {
        if (window.quartoOpenSearch) window.quartoOpenSearch();
      });
      drawerTools.appendChild(searchButton);
    }

    var media = window.matchMedia(MOBILE_QUERY);

    function placeSettings() {
      var settings = document.querySelector(".bc-settings");
      if (!settings) return false;
      var button = settings.querySelector(".bc-settings-button");

      if (media.matches) {
        if (settings.parentElement !== drawerTools) {
          closeDropdown(button);
          drawerTools.prepend(settings);
          // Skip Popper inside the drawer: the menu lays out in flow.
          if (button) button.setAttribute("data-bs-display", "static");
        }
      } else if (settings.parentElement !== navbarTools) {
        closeDropdown(button);
        navbarTools.insertBefore(settings, menuButton);
        if (button) button.removeAttribute("data-bs-display");
      }
      return true;
    }

    // The settings widget is injected by interactive-runtime.js; wait for it
    // if this script happens to run first.
    if (!placeSettings()) {
      var observer = new MutationObserver(function () {
        if (placeSettings()) observer.disconnect();
      });
      observer.observe(navbarTools, { childList: true });
    }

    if (media.addEventListener) {
      media.addEventListener("change", placeSettings);
    } else {
      media.addListener(placeSettings);
    }
  });
})();
