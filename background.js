chrome.action.onClicked.addListener(function (tab) {
  chrome.tabs.query({ currentWindow: true }, function (tabs) {
    const tabsToClose = tabs.filter(
      (t) => !t.pinned && t.groupId === -1
    );
    if (tabsToClose.length > 0) {
      chrome.tabs.remove(tabsToClose.map((t) => t.id));
    }
  });
}); 