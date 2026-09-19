document.addEventListener("DOMContentLoaded", () => {
  const log = document.querySelector(".chat-log");
  if (log) log.scrollTop = log.scrollHeight;

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      if (!confirm(form.dataset.confirm)) e.preventDefault();
    });
  });
});
