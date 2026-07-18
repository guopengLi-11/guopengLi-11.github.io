const menuButton = document.querySelector(".menu-button");
const navList = document.querySelector(".nav-list");

if (menuButton && navList) {
  menuButton.addEventListener("click", () => {
    const open = navList.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("nav-open", open);
  });
  navList.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    navList.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  }));
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();


