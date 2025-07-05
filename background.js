chrome.action.onClicked.addListener(function handleActionClick(tab) {
  chrome.tabs.query({ currentWindow: true }, function handleTabsQuery(tabs) {
    const tabsToClose = tabs.filter(
      (t) => !t.pinned && t.groupId === -1 && t.id !== tab.id
    )
    if (tabsToClose.length > 0) {
      chrome.tabs.remove(tabsToClose.map((t) => t.id))
    }
  })
})
