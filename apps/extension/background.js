// Open the side panel when the toolbar icon is clicked, so the copilot docks
// next to the live job page (no popup, no copy-paste, no window arranging).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("[offerben] setPanelBehavior failed:", err));
