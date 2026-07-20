logseq.ready(async () => {
  try {
    const stylesheetUrl = logseq.resolveResourceFullUrl("custom.css");
    const response = await fetch(stylesheetUrl);

    if (!response.ok) {
      throw new Error(`Unable to load theme stylesheet: ${response.status}`);
    }

    logseq.provideStyle(await response.text());
  } catch (error) {
    console.error("[logseq-transparent] Theme load failed", error);
    logseq.UI.showMsg("Logseq Transparent failed to load its stylesheet.", "error");
  }
});
