// Runs on claude.ai/settings/usage: reads the page text once it has rendered and hands it to the extension.
(async () => {
  const { parseUsagePage } = await import(chrome.runtime.getURL('parse.js'));
  let sent = false;
  const tryRead = () => {
    if (sent) return;
    const reading = parseUsagePage(document.body.innerText.split('\n'));
    if (reading.weekly || reading.fable) {
      sent = true;
      chrome.runtime.sendMessage({ type: 'page-usage', reading });
    }
  };
  tryRead();
  const observer = new MutationObserver(tryRead);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 20_000);
})();
