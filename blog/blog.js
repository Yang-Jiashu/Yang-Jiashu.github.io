(() => {
  const links = [...document.querySelectorAll('.article-nav a')];
  const headings = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const progress = document.querySelector('.reading-progress');
  let pending = false;
  const update = () => {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0})`;
    let active = headings[0];
    for (const heading of headings) if (heading.getBoundingClientRect().top <= 150) active = heading;
    links.forEach(link => {
      if (active && link.hash === `#${active.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    pending = false;
  };
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; window.requestAnimationFrame(update); }
  }, { passive:true });
  window.addEventListener('resize', update);
  update();
})();
