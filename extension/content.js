// Runs on claude.ai's Usage and Billing settings pages: reads the page text once it has rendered
// and hands the numbers (or the renewal date) to the extension.
(async () => {
  const { parseUsagePage, parseBillingPage } = await import(chrome.runtime.getURL('parse.js'));
  const billing = location.pathname.startsWith('/settings/billing');
  let sent = false;
  const tryRead = () => {
    if (sent) return;
    const text = document.body.innerText;
    if (billing) {
      const renewal = parseBillingPage(text);
      if (renewal) {
        sent = true;
        chrome.runtime.sendMessage({ type: 'page-billing', renewal });
      }
      return;
    }
    const reading = parseUsagePage(text.split('\n'));
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
