const revealNodes = document.querySelectorAll('[data-reveal]');
const counterNodes = document.querySelectorAll('[data-counter]');

const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.16, rootMargin: '0px 0px -40px 0px' }
);

revealNodes.forEach((node, index) => {
  node.style.transitionDelay = `${Math.min(index * 60, 240)}ms`;
  revealObserver.observe(node);
});

function animateCounter(node) {
  const target = Number(node.getAttribute('data-counter') || '0');
  const durationMs = 1100;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = String(Math.round(target * eased));

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.8 }
);

counterNodes.forEach(node => counterObserver.observe(node));
