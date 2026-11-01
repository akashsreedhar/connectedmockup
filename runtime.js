// Minimal renderer for the Connekted mockup screens (.dc.html files).
// Supports {{ holes }}, <sc-for>, <sc-if>, <dc-import>, onClick handlers and setState.
(function () {
  const SCREENS = ['Login', 'Signup', 'Assistant', 'Main', 'Onboarding', 'Inbox', 'Agents', 'Agent', 'KnowledgeBase', 'LiveCall', 'Campaigns', 'Campaign', 'Automations', 'Contacts', 'Contact', 'Companies', 'Deals', 'Calls', 'Reports', 'Settings', 'Numbers', 'Sidebar'];
  const NAMES = { Login: 'Sign in', Signup: 'Sign up and workspace setup', Main: 'Home', Onboarding: 'Setup', Inbox: 'Inbox', Agents: 'Agents', Agent: 'Agent editor', KnowledgeBase: 'Knowledge base', LiveCall: 'Live call', Campaigns: 'Campaigns', Campaign: 'Campaign builder', Automations: 'Automations', Contacts: 'Contacts', Contact: 'Contact after a call', Companies: 'Companies', Deals: 'Deals', Calls: 'Call history', Reports: 'Analytics', Settings: 'Settings', Numbers: 'Phone numbers' };
  const defs = {};

  // Shared helpers for screens. sig(name) gives the bar heights of an agent's voice signature,
  // the same every time for the same name; sigBars(name, px) gives ready-made inline styles.
  window.CX = {
    sig(name, n) {
      n = n || 5; let h = 7;
      for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return Array.from({ length: n }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; const mid = 1 - Math.abs(i - (n - 1) / 2) / n; return Math.round((0.35 + 0.65 * ((h >>> 16) % 100) / 100 * mid + 0.15) * 100) / 100; });
    },
    sigBars(name, px, n) { return CX.sig(name, n).map((v) => ({ style: 'height:' + Math.max(3, Math.round(v * px)) + 'px' })); }
  };

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, next);
      if (this.__render) this.__render();
    }
    forceUpdate() { if (this.__render) this.__render(); }
  }

  function parseDef(name, text) {
    // <template> survives inside tables, so control-flow tags become templates before parsing.
    const prepared = text
      .replace(/<sc-for\b/g, '<template data-sc="for"').replace(/<\/sc-for>/g, '</template>')
      .replace(/<sc-if\b/g, '<template data-sc="if"').replace(/<\/sc-if>/g, '</template>');
    const doc = new DOMParser().parseFromString(prepared, 'text/html');
    const xdc = doc.querySelector('x-dc');
    const helmet = xdc.querySelector('helmet');
    const css = helmet ? Array.from(helmet.querySelectorAll('style')).map((s) => s.textContent).join('\n') : '';
    if (helmet) helmet.remove();
    const script = doc.querySelector('script[data-dc-script]');
    const Cls = new Function('DCLogic', script.textContent + '\nreturn Component;')(DCLogic);
    const title = (doc.querySelector('title') || {}).textContent || name;
    return { nodes: Array.from(xdc.childNodes), Cls, css, title };
  }

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    const parts = path.split('.');
    let v = scope[parts[0]];
    for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  }
  const interp = (s, scope) => s.replace(HOLE, (_, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); });
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  function build(nodes, scope) {
    const frag = document.createDocumentFragment();
    nodes.forEach((node) => {
      if (node.nodeType === 3) { frag.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
      if (node.nodeType !== 1) return;
      const tag = node.localName;
      if (tag === 'template' && node.getAttribute('data-sc') === 'for') {
        const m = WHOLE.exec(node.getAttribute('list') || '');
        const list = m ? lookup(m[1], scope) : [];
        const as = node.getAttribute('as') || 'item';
        (list || []).forEach((item, i) => {
          const child = Object.assign({}, scope, { [as]: item, $index: i });
          frag.appendChild(build(Array.from((node.content || node).childNodes), child));
        });
        return;
      }
      if (tag === 'template' && node.getAttribute('data-sc') === 'if') {
        const m = WHOLE.exec(node.getAttribute('value') || '');
        if (m && lookup(m[1], scope)) frag.appendChild(build(Array.from((node.content || node).childNodes), scope));
        return;
      }
      if (tag === 'dc-import') {
        const props = {};
        Array.from(node.attributes).forEach((a) => {
          if (a.name === 'name' || a.name.startsWith('hint-')) return;
          const m = WHOLE.exec(a.value);
          props[camel(a.name)] = m ? lookup(m[1], scope) : interp(a.value, scope);
        });
        const host = document.createElement('div');
        host.style.height = '100%';
        mount(node.getAttribute('name'), props, host);
        frag.appendChild(host);
        return;
      }
      const el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(node.namespaceURI, node.localName)
        : document.createElement(tag);
      Array.from(node.attributes).forEach((a) => {
        const m = WHOLE.exec(a.value);
        if (a.name.startsWith('on') && m) {
          const fn = lookup(m[1], scope);
          if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
          return;
        }
        if (m) {
          const v = lookup(m[1], scope);
          if (v === false || v == null) return;
          el.setAttribute(a.name, v === true ? '' : String(v));
        } else {
          el.setAttribute(a.name, a.value.indexOf('{{') >= 0 ? interp(a.value, scope) : a.value);
        }
      });
      el.appendChild(build(Array.from(node.childNodes), scope));
      frag.appendChild(el);
    });
    return frag;
  }

  function mount(name, props, host) {
    const def = defs[name];
    // Imported components (Sidebar, Assistant) bring their <helmet> styles along once.
    if (host.id !== 'app' && def.css && !document.querySelector('style[data-comp="' + name + '"]')) {
      const st = document.createElement('style'); st.setAttribute('data-comp', name); st.textContent = def.css;
      document.head.insertBefore(st, document.getElementById('screen-css'));
    }
    const inst = new def.Cls(props);
    // Re-rendering replaces the DOM, so keep focus and caret on the element with the same id.
    inst.__render = () => {
      const a = document.activeElement;
      const id = a && host.contains(a) && a.id;
      const sel = id && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
      host.replaceChildren(build(def.nodes, inst.renderVals() || {}));
      if (id) { const n = document.getElementById(id); if (n) { n.focus(); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    };
    inst.__render();
    return def;
  }

  // Hash is #/Screen or #/Screen/section; the section is passed to the screen as props.sub.
  function current() {
    const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    return { name: NAMES[parts[0]] ? parts[0] : 'Main', sub: parts[1] || '' };
  }

  function show() {
    const { name, sub } = current();
    const def = defs[name];
    document.getElementById('screen-css').textContent = def.css;
    document.title = def.title + ' · Connekted mockup';
    mount(name, { sub }, document.getElementById('app'));
    const pick = document.getElementById('jump');
    if (pick) pick.value = name;
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#') { e.preventDefault(); return; }
    const m = /^\/?([A-Za-z0-9_-]+)\.dc\.html(?:#([A-Za-z0-9_-]+))?$/.exec(href);
    if (m) { e.preventDefault(); location.hash = '/' + m[1] + (m[2] ? '/' + m[2] : ''); }
  });
  window.addEventListener('hashchange', show);

  Promise.all(SCREENS.map((n) => fetch('screens/' + n + '.dc.html').then((r) => r.text()).then((t) => { defs[n] = parseDef(n, t); })))
    .then(() => {
      const pick = document.getElementById('jump');
      Object.keys(NAMES).forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = NAMES[n]; pick.appendChild(o); });
      pick.addEventListener('change', () => { location.hash = '/' + pick.value; });
      show();
      // The assistant lives outside #app so its conversation survives screen changes.
      mount('Assistant', {}, document.getElementById('assistant'));
    })
    .catch((err) => { document.getElementById('app').textContent = 'Could not load the mockup: ' + err.message; });
})();
