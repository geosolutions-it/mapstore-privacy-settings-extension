// Optional integrations, started only while the user consents to their category and stopped
// on refusal, withdrawal, expiry or a new policy version.
// Each one has a unique `id`, a `category` among the configured ones and a `start` function that
// returns a teardown function, which must stop everything started and remove what it stored.
//
// Example:
// {
//     id: "example-statistics",
//     category: "statistics",
//     start: function() {
//         var script = document.createElement("script");
//         script.src = "https://statistics.example.com/tracker.js";
//         document.head.appendChild(script);
//         return function() {
//             script.remove();
//         };
//     }
// }
var integrations = [];
