// Fake optional integrations for testing the consent lifecycle. Nothing is sent anywhere.
// While an integration runs it shows a badge in the top left corner, stores a localStorage key
// and a cookie, and is listed in window.PrivacyTestIntegrations. Its teardown removes all of them.
var testIntegration = function(category, color) {
    var key = "privacy-test." + category;
    return {
        id: "test-" + category,
        category: category,
        start: function() {
            var container = document.getElementById("privacy-test-badges");
            if (!container) {
                container = document.createElement("div");
                container.id = "privacy-test-badges";
                container.style.cssText = "position:fixed;top:60px;left:10px;z-index:100000;pointer-events:none;opacity:0.85;display:flex;flex-direction:column;gap:4px;font:bold 12px sans-serif";
                document.body.appendChild(container);
            }
            var badge = document.createElement("div");
            badge.className = "privacy-test-badge";
            badge.setAttribute("data-category", category);
            badge.textContent = category + " running";
            badge.style.cssText = "background:" + color + ";color:#fff;padding:4px 8px;border-radius:3px;display:flex;align-items:center;gap:6px";
            // Hiding a badge does not stop the integration: only the teardown does.
            var close = document.createElement("button");
            close.type = "button";
            close.textContent = "×";
            close.title = "Hide badge";
            close.setAttribute("aria-label", "Hide " + category + " badge");
            close.style.cssText = "pointer-events:auto;cursor:pointer;background:none;border:0;color:#fff;font:bold 14px sans-serif;padding:0;line-height:1";
            close.onclick = function() { badge.remove(); };
            badge.appendChild(close);
            container.appendChild(badge);
            localStorage.setItem(key, String(Date.now()));
            document.cookie = "privacy_test_" + category + "=1; path=/; SameSite=Lax";
            window.PrivacyTestIntegrations = (window.PrivacyTestIntegrations || []).concat(category);
            console.info("[privacy test] started", category); // eslint-disable-line no-console
            return function() {
                badge.remove();
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
