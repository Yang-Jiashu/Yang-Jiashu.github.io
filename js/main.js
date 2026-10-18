(() => {
    const header = document.querySelector('.site-header');
    const menuButton = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.site-nav');
    const modal = document.querySelector('#wechat-modal');
    let lastContactTrigger;

    function closeMenu() {
        nav.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Open navigation');
    }
    menuButton.addEventListener('click', () => {
        const open = menuButton.getAttribute('aria-expanded') !== 'true';
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        nav.classList.toggle('is-open', open);
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('click', event => {
        if (!header.contains(event.target)) closeMenu();
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', event => {
        if (event.matches) closeMenu();
    });

    document.querySelectorAll('[data-contact]').forEach(trigger => {
        trigger.addEventListener('click', () => {
            closeMenu();
            lastContactTrigger = trigger;
            modal.showModal();
            document.body.classList.add('modal-open');
        });
    });
    modal.querySelector('.contact-modal-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', event => {
        if (event.target === modal) {
            const box = modal.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close();
        }
    });
    modal.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
        const returnTarget = lastContactTrigger?.getClientRects().length ? lastContactTrigger : menuButton;
        returnTarget?.focus();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });

    const awardModal = document.querySelector('#award-modal');
    const awardImage = document.querySelector('#award-image');
    let lastAwardTrigger;
    document.querySelectorAll('[data-award]').forEach(link => {
        link.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            closeMenu();
            lastAwardTrigger = link;
            const title = `${link.closest('li').querySelector('.date').textContent} · ${link.textContent.trim()}`;
            document.querySelector('#award-title').textContent = title;
            awardImage.src = link.href;
            awardImage.alt = `${title} certificate`;
            document.querySelector('#award-original').href = link.href;
            awardModal.showModal();
            document.body.classList.add('modal-open');
        });
    });
    awardModal.querySelector('.award-modal-close').addEventListener('click', () => awardModal.close());
    awardModal.addEventListener('click', event => {
        if (event.target !== awardModal) return;
        const box = awardModal.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) awardModal.close();
    });
    awardModal.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
        lastAwardTrigger?.focus();
    });

    const links = [...nav.querySelectorAll('a[href^="#"]')];
    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                links.forEach(link => {
                    if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
                    else link.removeAttribute('aria-current');
                });
            });
        }, { rootMargin: '-15% 0px -65% 0px' });
        sections.forEach(section => observer.observe(section));
    }

    const artworks = [...document.querySelectorAll('[data-artwork]')];
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resetArtworks = [];
    artworks.forEach(artwork => {
        let frame = 0;
        let x = 0;
        let y = 0;
        function reset() {
            cancelAnimationFrame(frame);
            frame = 0;
            artwork.classList.remove('is-tracking');
        }
        resetArtworks.push(reset);
        artwork.addEventListener('pointermove', event => {
            if (event.pointerType !== 'mouse' || !finePointer.matches || reducedMotion.matches) return;
            const box = artwork.getBoundingClientRect();
            x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
            y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                artwork.style.setProperty('--art-x', `${(x * 7).toFixed(2)}px`);
                artwork.style.setProperty('--art-y', `${(y * 5).toFixed(2)}px`);
                artwork.style.setProperty('--art-rx', `${(-y * 4).toFixed(2)}deg`);
                artwork.style.setProperty('--art-ry', `${(x * 5).toFixed(2)}deg`);
                artwork.classList.add('is-tracking');
            });
        });
        artwork.addEventListener('pointerleave', reset);
        artwork.addEventListener('pointercancel', reset);
        artwork.addEventListener('blur', reset);
    });
    function resetArtworkMotion() {
        resetArtworks.forEach(reset => reset());
    }
    finePointer.addEventListener('change', resetArtworkMotion);
    reducedMotion.addEventListener('change', resetArtworkMotion);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) resetArtworkMotion();
    });

    const artModal = document.querySelector('#research-art-modal');
    const artImage = document.querySelector('#research-art-image');
    let lastArtworkTrigger;
    artworks.forEach(artwork => {
        artwork.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            resetArtworkMotion();
            lastArtworkTrigger = artwork;
            artImage.src = artwork.href;
            artImage.alt = artwork.querySelector('img').alt;
            document.querySelector('#research-art-title').textContent = artwork.closest('.research-view').querySelector('h2').textContent;
            document.querySelector('#research-art-original').href = artwork.href;
            artModal.showModal();
            document.body.classList.add('modal-open');
        });
    });
    artModal.querySelector('.research-art-close').addEventListener('click', () => artModal.close());
    artModal.addEventListener('click', event => {
        if (event.target !== artModal) return;
        const box = artModal.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) artModal.close();
    });
    artModal.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
        lastArtworkTrigger?.focus({ preventScroll: true });
    });

    const researchTabs = [...document.querySelectorAll('[data-direction]')];
    function selectDirection(tab, moveFocus = false) {
        resetArtworkMotion();
        researchTabs.forEach(item => {
            const selected = item === tab;
            item.setAttribute('aria-selected', String(selected));
            item.tabIndex = selected ? 0 : -1;
            document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
        });
        document.getElementById('research-number').textContent = String(researchTabs.indexOf(tab) + 1).padStart(2, '0');
        if (moveFocus) tab.focus();
    }
    researchTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectDirection(tab));
        tab.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % researchTabs.length;
            else if (event.key === 'ArrowLeft') next = (index + researchTabs.length - 1) % researchTabs.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = researchTabs.length - 1;
            else return;
            event.preventDefault();
            selectDirection(researchTabs[next], true);
        });
    });
})();
