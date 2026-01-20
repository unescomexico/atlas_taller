// --- Cambiar de sección (solo 2 opciones) ---
const buttons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".section");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    // Quitar "active" de todos los botones
    buttons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // Ocultar todas las secciones
    sections.forEach(sec => sec.classList.remove("active"));

    // Mostrar solo la correspondiente
    if (btn.id === "btn-fichas") {
      document.getElementById("fichas-section").classList.add("active");
    }

    if (btn.id === "btn-galeria") {
      document.getElementById("galeria-section").classList.add("active");
    }
  });
});

