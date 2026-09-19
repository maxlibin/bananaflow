(function () {
  try {
    // Theme only applies inside the authenticated app shell. Public/marketing
    // pages render in light mode and don't expose a theme toggle, so we must
    // not flip <html> dark just because the user toggled it once on /dashboard.
    var APP_ROUTE_PREFIXES = [
      "/dashboard",
      "/board",
      "/billing",
      "/library",
      "/storage",
      "/schedule",
      "/admin",
      "/onboarding",
    ];
    var path = location.pathname;
    var isAppRoute = APP_ROUTE_PREFIXES.some(function (p) {
      return path === p || path.indexOf(p + "/") === 0;
    });
    if (!isAppRoute) {
      document.documentElement.classList.remove("dark");
      return;
    }

    var stored = localStorage.getItem("banana-theme");
    var sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved =
      stored === "dark"
        ? "dark"
        : stored === "light"
          ? "light"
          : sysDark
            ? "dark"
            : "light";

    var cookieMatch = document.cookie.match(/(?:^|;\s*)banana-theme=([^;]+)/);
    var cookieValue = cookieMatch ? cookieMatch[1] : null;
    if (cookieValue !== resolved) {
      document.cookie =
        "banana-theme=" +
        resolved +
        "; path=/; max-age=" +
        60 * 60 * 24 * 365 +
        "; samesite=lax";
    }

    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
