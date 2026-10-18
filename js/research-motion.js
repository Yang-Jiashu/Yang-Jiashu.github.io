// Spring-driven SVG scenes. Only the visible scene runs, and all original art
// stays available as an image and as the source of the enlarged view.
const NS = 'http://www.w3.org/2000/svg';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const number = value => Number(value.toFixed(3));
const numbers = path => (path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
const spring = (stiffness = .065, damping = .79) => ({ value: 0, velocity: 0, target: 0, stiffness, damping });
function step(s, dt) {
    s.velocity = (s.velocity + (s.target - s.value) * s.stiffness * dt) * Math.pow(s.damping, dt);
    s.value += s.velocity * dt;
    return Math.abs(s.target - s.value) > .015 || Math.abs(s.velocity) > .015;
}
function rotate(point, angle, pivot) {
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const x = point.x - pivot[0], y = point.y - pivot[1];
    return { x: pivot[0] + x * c - y * s, y: pivot[1] + x * s + y * c };
}
function pathCurve(p) {
    return `M${number(p[0])} ${number(p[1])}C${p.slice(2).map(number).join(' ')}`;
}

export function createResearchMotion(artworks) {
    const intro = document.querySelector('.intro');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const states = new Map();
    let active = null, frame = 0, lastTime = 0, pointer = null, inside = false;

    function restore(state) {
        [state.activity, state.lookX, state.lookY].forEach(s => { s.value = s.velocity = s.target = 0; });
        state.layers.forEach(layer => {
            [layer.x, layer.y, layer.angle].forEach(s => { s.value = s.velocity = s.target = 0; });
        });
        state.joints.forEach(joint => { joint.angle.value = joint.angle.velocity = joint.angle.target = 0; });
        state.originals.forEach(({ el, attribute, value }) => {
            if (value === null) el.removeAttribute(attribute);
            else el.setAttribute(attribute, value);
        });
        state.phase = 0;
        state.link.classList.remove('is-animating');
    }
    function stop() {
        cancelAnimationFrame(frame);
        frame = lastTime = 0;
        inside = false;
        states.forEach(restore);
        active = null;
    }
    function visibleArtwork() {
        return artworks.find(link => !link.closest('.research-view').hidden);
    }
    function schedule() {
        if (!frame && active && states.has(active) && !reduced.matches && !document.hidden) {
            frame = requestAnimationFrame(draw);
        }
    }
    function activate(link) {
        if (active !== link) {
            if (states.has(active)) restore(states.get(active));
            active = link;
            lastTime = 0;
        }
        if (pointer) {
            const r = intro.getBoundingClientRect();
            inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
        }
        if (inside) schedule();
    }
    intro.addEventListener('pointermove', event => {
        // A real mouse event is authoritative, including on hybrid devices that
        // report a coarse primary pointer. Touch never starts a tracking loop.
        if (event.pointerType !== 'mouse' || reduced.matches || document.querySelector('dialog[open]')) return;
        pointer = { x: event.clientX, y: event.clientY };
        inside = true;
        activate(visibleArtwork());
    }, { passive: true });
    intro.addEventListener('pointerleave', () => { inside = false; schedule(); });
    intro.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    reduced.addEventListener('change', stop);

    artworks.forEach(async link => {
        const image = link.querySelector('img');
        try {
            const source = new URL(link.href);
            source.searchParams.set('v', 'elastic2');
            const response = await fetch(source);
            if (!response.ok) throw new Error('Artwork unavailable');
            const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
            if (xml.querySelector('parsererror')) throw new Error('Invalid artwork');
            const svg = document.importNode(xml.documentElement, true);
            if (svg.localName !== 'svg' || !svg.querySelector('[data-motion-layer], [data-joint]')) throw new Error('Static artwork');
            svg.classList.add('research-drawing', 'research-live-drawing');
            const originals = [];
            const remember = (el, attribute) => originals.push({ el, attribute, value: el.getAttribute(attribute) });
            const layers = [...svg.querySelectorAll('[data-motion-layer]')].map((el, i) => {
                remember(el, 'transform');
                const pivot = el.dataset.pivot?.split(/\s+/).map(Number);
                return { el, name: el.dataset.motionLayer, depth: Number(el.dataset.depth), turn: Number(el.dataset.turn),
                    cx: Number(el.dataset.cx) || pivot?.[0] || 260, cy: Number(el.dataset.cy) || pivot?.[1] || 165,
                    x: spring(.045 + i % 4 * .009, .79), y: spring(.055 + i % 3 * .008, .78), angle: spring(.04, .8) };
            });
            const curves = selector => [...svg.querySelectorAll(selector)].map(el => {
                remember(el, 'd');
                return { el, base: numbers(el.getAttribute('d')) };
            });
            const joints = [...svg.querySelectorAll('[data-joint]')].map((el, i) => {
                remember(el, 'transform');
                return { el, name: el.dataset.joint, pivot: el.dataset.pivot.split(/\s+/).map(Number), angle: spring(.04 + i * .012, .77) };
            });
            const samples = [...svg.querySelectorAll('[data-action-sample]')];
            samples.forEach(el => ['cx', 'cy', 'opacity'].forEach(attr => remember(el, attr)));
            const rays = [...svg.querySelectorAll('[data-world-ray]')];
            rays.forEach(el => { remember(el, 'd'); remember(el, 'stroke-dashoffset'); });
            const trail = svg.querySelector('[data-action-trail="primary"]');
            const arrow = svg.querySelector('[data-action-trail-arrow]');
            const contour = svg.querySelector('[data-action-trail="contour"]');
            const observerRay = svg.querySelector('[data-action-static="observer"] path[stroke-dasharray]');
            if (observerRay) remember(observerRay, 'd');
            if (contour) remember(contour, 'transform');
            if (trail) { remember(trail, 'd'); remember(trail, 'stroke-dashoffset'); }
            if (arrow) remember(arrow, 'transform');
            const state = { link, svg, layers, joints, originals, phase: 0, activity: spring(.07, .8), lookX: spring(.055, .8), lookY: spring(.055, .8),
                fibers: curves('[data-fiber]'), pages: curves('[data-book-page]'), edges: curves('[data-knowledge-edge]'),
                rays, trail, contour, observerRay, trailBase: trail ? numbers(trail.getAttribute('d')) : null, arrow, samples };
            states.set(link, state);
            image.hidden = true;
            link.append(svg);
            link.dataset.motionReady = 'true';
            if (active === link) schedule();
        } catch {
            link.dataset.motionReady = 'false';
        }
    });

    function draw(time) {
        frame = 0;
        const state = states.get(active);
        if (!state || reduced.matches || document.hidden || active.closest('.research-view').hidden) { stop(); return; }
        const rect = active.getBoundingClientRect();
        const hero = intro.getBoundingClientRect();
        if (pointer && (pointer.x < hero.left || pointer.x > hero.right || pointer.y < hero.top || pointer.y > hero.bottom)) inside = false;
        const dt = lastTime ? clamp((time - lastTime) / 16.667, .25, 2) : 1;
        lastTime = time;
        const px = pointer ? (pointer.x - rect.left) / rect.width * 520 : 260;
        const py = pointer ? (pointer.y - rect.top) / rect.height * 330 : 165;
        const globalX = pointer ? (pointer.x - hero.left) / hero.width * 2 - 1 : 0;
        const globalY = pointer ? (pointer.y - hero.top) / hero.height * 2 - 1 : 0;
        const x = inside ? clamp(globalX * .75 + clamp((px - 260) / 240, -1.2, 1.2) * .25, -1.2, 1.2) : 0;
        const y = inside ? clamp(globalY * .55 + clamp((py - 165) / 160, -1.15, 1.15) * .45, -1.15, 1.15) : 0;
        state.activity.target = inside ? 1 : 0;
        let busy = step(state.activity, dt);
        state.lookX.target = x; state.lookY.target = y;
        busy = step(state.lookX, dt) || busy; busy = step(state.lookY, dt) || busy;
        const viewX = state.lookX.value, viewY = state.lookY.value;
        const activity = clamp(state.activity.value, 0, 1);
        const clock = time / 1000;
        state.phase += dt / 60 * activity;
        const layerByName = Object.fromEntries(state.layers.map(layer => [layer.name, layer]));
        const nodes = state.layers.filter(layer => layer.el.hasAttribute('data-knowledge-node'));
        state.link.classList.add('is-animating');

        state.layers.forEach((layer, i) => {
            let tx = x * layer.depth * 1.6, ty = y * layer.depth;
            if (layer.el.hasAttribute('data-knowledge-node')) {
                const dx = layer.cx + layer.x.value - px, dy = layer.cy + layer.y.value - py;
                const distance = Math.hypot(dx, dy);
                const force = inside ? Math.pow(Math.max(0, 1 - distance / 105), 2) * 34 : 0;
                tx += dx / Math.max(distance, 1) * force + Math.sin(clock * 1.8 + i * 1.7) * 2 * activity;
                ty += dy / Math.max(distance, 1) * force + Math.cos(clock * 1.5 + i * 1.9) * 2.6 * activity;
            }
            layer.x.target = tx;
            layer.y.target = ty;
            layer.angle.target = x * layer.turn + y * layer.turn * .2;
            [layer.x, layer.y, layer.angle].forEach(s => { busy = step(s, dt) || busy; });
            if (['world-terrain', 'world-target', 'action-trail'].includes(layer.name)) return;
            layer.el.setAttribute('transform', `translate(${number(layer.x.value)} ${number(layer.y.value)}) rotate(${number(layer.angle.value)} ${layer.cx} ${layer.cy})`);
        });

        // The mesh breathes in perspective while the camera and the sampled
        // point move at different depths; the sight lines stay attached.
        const terrain = layerByName['world-terrain'];
        if (terrain) {
            const a = terrain.angle.value * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            const sx = 1 + viewX * .016 * activity, sy = 1 - viewY * .065 * activity, shear = viewX * .045 * activity;
            const m = [c * sx, s * sx, c * shear - s * sy, s * shear + c * sy];
            const cx = 260, cy = 210;
            const e = cx + terrain.x.value - m[0] * cx - m[2] * cy;
            const f = cy + terrain.y.value - m[1] * cx - m[3] * cy;
            const project = (px, py) => ({ x: m[0] * px + m[2] * py + e, y: m[1] * px + m[3] * py + f });
            terrain.el.setAttribute('transform', `matrix(${m.map(number).join(' ')} ${number(e)} ${number(f)})`);
            const target = layerByName['world-target'], camera = layerByName['world-camera'];
            const point = project(target.cx, target.cy);
            point.x += target.x.value;
            point.y += target.y.value;
            const pulse = 1 + Math.sin(clock * 2.7) * .055 * activity;
            target.el.setAttribute('transform', `translate(${number(point.x - target.cx)} ${number(point.y - target.cy)}) translate(${target.cx} ${target.cy}) scale(${number(pulse)}) translate(${-target.cx} ${-target.cy})`);
            state.rays.forEach(ray => {
                const end = Number(ray.dataset.worldRay) === 2 ? point : project(Number(ray.dataset.endX), Number(ray.dataset.endY));
                ray.setAttribute('d', `M${number(68 + camera.x.value)} ${number(225 + camera.y.value)}L${number(end.x)} ${number(end.y)}`);
                if (ray.dataset.worldRay === '2') ray.setAttribute('stroke-dashoffset', number(-state.phase * 16));
            });
        }

        if (nodes.length) {
            state.edges.forEach(({ el }) => {
                const [a, b] = el.dataset.knowledgeEdge.split(',').map(Number).map(index => nodes[index]);
                const ax = a.cx + a.x.value, ay = a.cy + a.y.value, bx = b.cx + b.x.value, by = b.cy + b.y.value;
                el.setAttribute('d', `M${number(ax)} ${number(ay)}Q${number((ax + bx) / 2 + 12)} ${number((ay + by) / 2 - 8)} ${number(bx)} ${number(by)}`);
            });
            const book = layerByName['knowledge-book'], fibers = layerByName['knowledge-fibers'], node = nodes[0];
            state.fibers.forEach(({ el, base }, i) => {
                const p = [...base];
                p[0] += book.x.value - fibers.x.value; p[1] += book.y.value - fibers.y.value;
                p[2] += viewX * 18 * activity; p[3] += Math.sin(clock * 2.2 + i * .17) * 5 * activity;
                p[4] += node.x.value * .6 - fibers.x.value; p[5] += node.y.value * .6 - fibers.y.value + viewY * 8;
                p[6] += node.x.value - fibers.x.value; p[7] += node.y.value - fibers.y.value;
                el.setAttribute('d', pathCurve(p));
            });
            state.pages.forEach(({ el, base }, i) => {
                const p = [...base], bend = (viewX * 5 + Math.sin(clock * 2.3 + i * .13) * 1.9 * activity) * Math.sin((i + 1) / 21 * Math.PI);
                p[3] += bend; p[5] += bend * .55; p[9] -= bend * .85; p[11] -= bend * .6;
                el.setAttribute('d', `M${number(p[0])} ${number(p[1])}C${p.slice(2, 8).map(number).join(' ')}C${p.slice(8).map(number).join(' ')}`);
            });
        }

        // Nested rotations keep the robot's shoulder, elbow and tool connected.
        const targets = { shoulder: x * 8 + y * 3, elbow: -x * 13 + y * 6, wrist: x * 9 - y * 7, gripper: Math.sin(clock * 1.7) * 2 * activity + x * 3 };
        state.joints.forEach(joint => {
            joint.angle.target = targets[joint.name] || 0;
            busy = step(joint.angle, dt) || busy;
            joint.el.setAttribute('transform', `rotate(${number(joint.angle.value)} ${joint.pivot.join(' ')})`);
        });
        if (state.trail) {
            let start = { x: 347, y: 191 };
            [...state.joints].reverse().forEach(joint => { start = rotate(start, joint.angle.value, joint.pivot); });
            const object = layerByName['action-object'];
            let end = rotate({ x: 392, y: 213 }, object.angle.value, [object.cx, object.cy]);
            end.x += object.x.value; end.y += object.y.value;
            if (state.observerRay) {
                const endpoints = [[379, 207], [422, 212]].map(([x, y]) => {
                    const point = rotate({ x, y }, object.angle.value, [object.cx, object.cy]);
                    return `${number(point.x + object.x.value)} ${number(point.y + object.y.value)}`;
                });
                state.observerRay.setAttribute('d', `M414 104L${endpoints[0]}M414 104L${endpoints[1]}`);
            }
            const p = [...state.trailBase];
            p[0] = start.x; p[1] = start.y;
            p[2] += (start.x - 347) * .65 + viewX * 12; p[3] += (start.y - 191) * .65 + viewY * 10;
            p[4] += end.x - 392 + Math.sin(clock * 1.6) * 3 * activity; p[5] += end.y - 213;
            p[6] = end.x; p[7] = end.y;
            state.trail.setAttribute('d', pathCurve(p));
            state.trail.setAttribute('stroke-dashoffset', number(-state.phase * 18));
            if (state.contour) state.contour.setAttribute('transform', `translate(${number((start.x - 347 + end.x - 392) * .5)} ${number((start.y - 191 + end.y - 213) * .35)})`);
            if (state.arrow) state.arrow.setAttribute('transform', `translate(${number(end.x - 392)} ${number(end.y - 213)})`);
            const length = state.trail.getTotalLength();
            state.samples.forEach((el, i) => {
                const t = ((i / state.samples.length + state.phase * .1) % 1);
                const point = state.trail.getPointAtLength(t * length);
                el.setAttribute('cx', number(point.x)); el.setAttribute('cy', number(point.y));
                el.setAttribute('opacity', number(.2 + .45 * Math.sin(t * Math.PI) * activity));
            });
        }
        if (inside || busy || activity > .003) schedule();
        else { restore(state); lastTime = 0; }
    }
    return { reset: stop, activate };
}
