(function () {
  if (!document.querySelector(".moving-bg")) {
    const bg = document.createElement("div");
    bg.className = "moving-bg";
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML = "<span></span><span></span><span></span><span></span><span></span>";
    document.body.prepend(bg);
  }

  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-menu");

  if (!toggle || !menu) return;

  function setOpen(open) {
    menu.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  toggle.addEventListener("click", function () {
    setOpen(!menu.classList.contains("open"));
  });

  menu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      setOpen(false);
    });
  });

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".navbar")) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setOpen(false);
  });

  let adminLink = menu.querySelector("#adminNavLink");
  if (!adminLink) {
    adminLink = document.createElement("a");
    adminLink.id = "adminNavLink";
    adminLink.href = "login.html";
    adminLink.textContent = "Admin Login";
    menu.appendChild(adminLink);
  }

  async function updateAdminNav() {
    if (typeof refreshAdminState !== "function") return;

    const loggedIn = await refreshAdminState();
    if (loggedIn) {
      adminLink.href = "#";
      adminLink.textContent = "Admin Logout";
      adminLink.onclick = async function (event) {
        event.preventDefault();
        try {
          await adminLogout();
        } catch (err) {
          alert(err.message);
        }
        adminLink.href = "login.html";
        adminLink.textContent = "Admin Login";
        adminLink.onclick = null;
        setOpen(false);
        if (typeof window.onAdminAuthChange === "function") {
          window.onAdminAuthChange(false);
        }
      };
    } else {
      adminLink.href = "login.html";
      adminLink.textContent = "Admin Login";
      adminLink.onclick = null;
    }

    if (typeof window.onAdminAuthChange === "function") {
      window.onAdminAuthChange(loggedIn);
    }
  }

  // Mark current page in the menu
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  menu.querySelectorAll("a").forEach(function (link) {
    if (link.id === "adminNavLink") return;
    const href = (link.getAttribute("href") || "").toLowerCase();
    if (href === path || (path === "" && href === "index.html")) {
      link.setAttribute("aria-current", "page");
    }
  });
  if (path === "login.html") {
    adminLink.setAttribute("aria-current", "page");
  }

  updateAdminNav();
})();
