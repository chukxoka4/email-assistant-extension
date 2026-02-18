// Create the Context Menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "sendToGemini",
    title: "Send to Email Assistant",
    contexts: ["selection"]
  });
});

// Handle the click: send selected text only to the field that had focus (draft or prompt)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "sendToGemini" || !info.selectionText) return;
  chrome.storage.local.get(["lastRightClickTarget"], (result) => {
    const target = result.lastRightClickTarget || "draft";
    const key = target === "prompt" ? "promptText" : "draftText";
    chrome.storage.local.set({ [key]: info.selectionText });
    chrome.sidePanel.open({ windowId: tab.windowId });
  });
});

// Allow clicking the toolbar icon to open the panel
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});