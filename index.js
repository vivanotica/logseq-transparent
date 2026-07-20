logseq.ready(() => {
  // Theme CSS is loaded by the logseq.themes manifest registration.
}).catch((error) => {
  console.error("[logseq-transparent] Theme initialization failed", error);
});
