// Fake optional integrations for testing the consent lifecycle. Nothing is sent anywhere.
// While an integration runs it shows a badge in the top left corner, stores a localStorage key
// and a cookie, and is listed in window.PrivacyTestIntegrations. Its teardown removes all of them.

// The badges are listed in a panel that can be collapsed to its title, so that it does not
// cover the application. Collapsing only hides the badges: the integrations keep running.
var badgeList = function() {
    var list = document.getElementById("privacy-test-badges-list");
    if (list) return list;
    var container = document.createElement("div");
    container.id = "privacy-test-badges";
    container.style.cssText = "position:fixed;top:60px;left:10px;z-index:100000;opacity:0.85;display:flex;flex-direction:column;align-items:flex-start;gap:4px;font:bold 12px sans-serif";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.style.cssText = "cursor:pointer;background:#333;color:#fff;border:0;border-radius:3px;padding:2px 8px;font:bold 12px sans-serif";
    list = document.createElement("div");
    list.id = "privacy-test-badges-list";
    list.style.cssText = "pointer-events:none;display:flex;flex-direction:column;gap:4px";
    var setExpanded = function(expanded) {
        toggle.textContent = (expanded ? "▾" : "▸") + " privacy test";
        toggle.setAttribute("aria-expanded", String(expanded));
        list.style.display = expanded ? "flex" : "none";
    };
    toggle.onclick = function() { setExpanded(list.style.display === "none"); };
    setExpanded(true);
    container.appendChild(toggle);
    container.appendChild(list);
    document.body.appendChild(container);
    return list;
};
var testIntegration = function(category, color) {
    var key = "privacy-test." + category;
    return {
        id: "test-" + category,
        category: category,
        start: function() {
            var list = badgeList();
            var badge = document.createElement("div");
            badge.className = "privacy-test-badge";
            badge.setAttribute("data-category", category);
            badge.textContent = category + " running";
            badge.style.cssText = "background:" + color + ";color:#fff;padding:4px 8px;border-radius:3px";
            list.appendChild(badge);
            localStorage.setItem(key, String(Date.now()));
            document.cookie = "privacy_test_" + category + "=1; path=/; SameSite=Lax";
            window.PrivacyTestIntegrations = (window.PrivacyTestIntegrations || []).concat(category);
            console.info("[privacy test] started", category); // eslint-disable-line no-console
            return function() {
                badge.remove();
                if (!list.children.length && list.parentNode) list.parentNode.remove();
                localStorage.removeItem(key);
                document.cookie = "privacy_test_" + category + "=; path=/; max-age=0";
                window.PrivacyTestIntegrations = (window.PrivacyTestIntegrations || []).filter(function(id) { return id !== category; });
                console.info("[privacy test] stopped", category); // eslint-disable-line no-console
            };
        }
    };
};
var integrations = [
    testIntegration("functional", "#2e7d32"),
    testIntegration("statistics", "#1565c0"),
    testIntegration("marketing", "#e65100")
];
