/* ==========================================================================
 * terminal.js — 终端式个人主页的交互引擎
 * ==========================================================================
 * 没有框架、没有构建、没有依赖。整套逻辑就是一个 IIFE：
 *   数据(PROJECTS) → 命令表(commands) → 输入框 ↔ 输出区
 * ========================================================================== */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- 配置 */
  const CONFIG = Object.assign(
    {
      user: '',
      name: '',
      role: '',
      tagline: '',
      bio: '',
      location: '',
      email: '',
      links: {},
      autoJump: true,
      autoLs: true,
      scanlines: true,
      theme: 'auto',
      promptUser: 'visitor',
      host: '',
      hidden: [],
      aliases: {},
    },
    window.CONFIG || {}
  );

  const META = window.PROJECTS_META || {};

  const detectUser = () => {
    const match = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname || '');
    return match ? match[1] : '';
  };

  const USER = String(CONFIG.user || META.user || detectUser() || 'you');
  const PROFILE = META.profile || {};
  const NAME = String(CONFIG.name || PROFILE.name || USER);
  const BIO = CONFIG.bio || PROFILE.bio || '';
  const LOCATION = CONFIG.location || PROFILE.location || '';
  const HOST = String(CONFIG.host || USER);

  /* 访客身份：静态站点拿不到 GitHub 登录态，所以做成「自报家门」+ ?u= 分享链接 */
  const DEFAULT_GUEST = String(CONFIG.promptUser || 'visitor');
  const WHO_KEY = 'th.who';
  const GITHUB_NAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

  function sanitizeWho(value) {
    const name = String(value || '').trim().replace(/^@/, '');
    return GITHUB_NAME.test(name) ? name : '';
  }

  let guest = sanitizeWho(readStored(WHO_KEY)) || DEFAULT_GUEST;

  /* 链接表：github 永远存在，email 自动转成 mailto: */
  const LINKS = (() => {
    const map = {};
    Object.keys(CONFIG.links || {}).forEach((key) => {
      const value = CONFIG.links[key];
      if (typeof value === 'string' && value.trim()) map[key.toLowerCase()] = value.trim();
    });
    if (!map.github) map.github = `https://github.com/${USER}`;
    if (!map.blog && /^https?:\/\//i.test(PROFILE.blog || '')) map.blog = PROFILE.blog;
    if (CONFIG.email && !map.email) map.email = `mailto:${CONFIG.email}`;
    return map;
  })();

  const LINK_LABELS = {
    github: 'github',
    blog: 'blog',
    email: 'email',
    x: 'x',
    twitter: 'x',
    zhihu: '知乎',
    rss: 'rss',
    linkedin: 'linkedin',
    bilibili: 'bilibili',
  };

  /* ---------------------------------------------------------------- 数据 */
  const HIDDEN = new Set((CONFIG.hidden || []).map((item) => String(item).toLowerCase()));

  const PROJECTS = (Array.isArray(window.PROJECTS) ? window.PROJECTS : [])
    .filter((project) => project && project.slug)
    .map((project) =>
      Object.assign({ topics: [], stars: 0, forks: 0 }, project, {
        slug: String(project.slug),
        topics: Array.isArray(project.topics) ? project.topics : [],
      })
    )
    .filter(
      (project) =>
        !HIDDEN.has(project.slug.toLowerCase()) &&
        !HIDDEN.has(String(project.name || '').toLowerCase())
    );

  /* ---------------------------------------------------------------- 工具 */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const span = (className, text) => el('span', className, text);
  const uniq = (list) => Array.from(new Set(list));

  function fmtNum(value) {
    const num = Number(value) || 0;
    if (num >= 10000) return `${Math.round(num / 1000)}k`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(num);
  }

  const shortUrl = (url) =>
    String(url)
      .replace(/^mailto:/, '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LANG_COLORS = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572a5',
    HTML: '#e34c26',
    CSS: '#563d7c',
    SCSS: '#c6538c',
    Vue: '#41b883',
    Svelte: '#ff3e00',
    React: '#61dafb',
    Go: '#00add8',
    Rust: '#dea584',
    Java: '#b07219',
    Kotlin: '#a97bff',
    Swift: '#f05138',
    'C++': '#f34b7d',
    C: '#6e7681',
    'C#': '#178600',
    Shell: '#89e051',
    Ruby: '#701516',
    PHP: '#4f5d95',
    Dart: '#00b4ab',
    Lua: '#000080',
    'Jupyter Notebook': '#da5b0b',
    MDX: '#fcb32c',
    Astro: '#ff5a03',
  };

  const langColor = (language) => LANG_COLORS[language] || 'var(--muted)';

  /* ---------------------------------------------------------------- 状态 */
  const state = {
    cwd: [],
    history: [],
    hPos: -1,
    draft: '',
    bootedAt: Date.now(),
  };

  try {
    const saved = JSON.parse(sessionStorage.getItem('th.history') || '[]');
    if (Array.isArray(saved)) {
      state.history = saved.filter((item) => typeof item === 'string').slice(-100);
    }
  } catch (error) {
    /* 忽略：隐私模式下 sessionStorage 可能不可用 */
  }

  /* ---------------------------------------------------------------- DOM */
  const $ = (selector) => document.querySelector(selector);

  const out = $('#out');
  const form = $('#form');
  const input = $('#cmd');
  const ps1 = $('#ps1');
  const promptline = $('.promptline');
  const typedBefore = $('#typed-before');
  const typedAfter = $('#typed-after');
  const caret = $('#caret');
  const hintbar = $('#hintbar');
  const themeBtn = $('#theme-btn');
  const bannerName = $('#banner-name');
  const bannerSub = $('#banner-sub');
  const bannerHost = $('#banner-host');
  const bannerGh = $('#banner-gh');
  const bannerLinks = $('#banner-links');
  const githubAvatar = $('#github-avatar');
  if (githubAvatar) {
    githubAvatar.src = PROFILE.avatar || `https://github.com/${encodeURIComponent(USER)}.png?size=256`;
    githubAvatar.alt = `${USER} 的 GitHub 头像`;
  }

  if (!out || !input || !form) return;

  /* ---------------------------------------------------------------- 主题 */
  const THEME_KEY = 'th.theme';
  const SCAN_KEY = 'th.scanlines';
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
  let themeMode = 'auto';

  function readStored(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      /* 忽略 */
    }
  }

  function applyTheme(mode, persist) {
    themeMode = ['dark', 'light', 'auto'].indexOf(mode) >= 0 ? mode : 'auto';
    const resolved = themeMode === 'auto' ? (lightQuery.matches ? 'light' : 'dark') : themeMode;
    document.documentElement.dataset.theme = resolved;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f7f3' : '#070b0a');
    if (themeBtn) themeBtn.setAttribute('aria-pressed', String(resolved === 'light'));
    if (persist) store(THEME_KEY, themeMode);
  }

  lightQuery.addEventListener('change', () => {
    if (themeMode === 'auto') applyTheme('auto');
  });

  function applyScanlines(enabled, persist) {
    document.documentElement.dataset.scanlines = enabled ? 'on' : 'off';
    if (persist) store(SCAN_KEY, enabled ? 'on' : 'off');
  }

  /* ---------------------------------------------------------------- 提示符 */
  const pathText = () => (state.cwd.length ? `~/${state.cwd[0]}` : '~');

  function promptFragment(path) {
    const fragment = document.createDocumentFragment();
    fragment.append(
      span('p-user', guest),
      span('p-at', '@'),
      span('p-host', HOST),
      span('p-colon', ':'),
      span('p-path', path),
      span('p-sig', '$')
    );
    return fragment;
  }

  function updatePs1() {
    ps1.replaceChildren(promptFragment(pathText()));
  }

  /* ---------------------------------------------------------------- 输出 */
  function printLine(content, className) {
    const line = el('div', className ? `line ${className}` : 'line');
    if (content != null && content !== '') {
      if (typeof content === 'string') line.textContent = content;
      else line.append(content);
    }
    out.append(line);
    return line;
  }

  const printBlock = (node) => printLine(node, 'line--block');
  const printMuted = (text) => printLine(text, 'line--muted');
  const printDim = (text) => printLine(text, 'line--dim');
  const printError = (text) => printLine(text, 'line--err');
  const printBlank = () => printLine('');

  function printText(text, className) {
    String(text)
      .split('\n')
      .forEach((part) => printLine(part, className));
  }

  function printEcho(raw) {
    const line = printLine(null, 'line--cmd');
    line.append(promptFragment(pathText()), document.createTextNode(' '));
    if (raw) line.append(document.createTextNode(raw));
    return line;
  }

  function scrollDown(force) {
    const doc = document.scrollingElement || document.documentElement;
    const distance = doc.scrollHeight - window.scrollY - window.innerHeight;
    if (!force && distance < 4) return;
    window.scrollTo({ top: doc.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ---------------------------------------------------------------- 链接 */
  function openUrl(url) {
    if (!url) return false;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  }

  function linkEl(text, href, className) {
    const anchor = el('a', className || null, text);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }

  /* ---------------------------------------------------------------- 项目 */
  const currentProject = () => PROJECTS.find((project) => project.slug === state.cwd[0]) || null;
  const projectBySlug = (slug) =>
    PROJECTS.find((project) => project.slug.toLowerCase() === String(slug).toLowerCase()) || null;

  function resolveProject(query) {
    const needle = String(query || '').trim().replace(/\/+$/, '').toLowerCase();
    if (!needle) return { notFound: true };

    const exact = PROJECTS.find(
      (project) =>
        project.slug.toLowerCase() === needle ||
        String(project.name || '').toLowerCase() === needle
    );
    if (exact) return { project: exact };

    const prefixed = PROJECTS.filter((project) => project.slug.toLowerCase().startsWith(needle));
    if (prefixed.length === 1) return { project: prefixed[0] };
    if (prefixed.length > 1) return { ambiguous: prefixed };

    const contained = PROJECTS.filter((project) => project.slug.toLowerCase().includes(needle));
    if (contained.length === 1) return { project: contained[0] };
    if (contained.length > 1) return { ambiguous: contained };

    return { notFound: true };
  }

  const FILE_ROWS = [
    { name: 'README.md', desc: '项目说明', cmd: 'cat README.md' },
    { name: 'info.json', desc: '仓库元数据', cmd: 'cat info.json' },
    { name: 'LICENSE', desc: '许可证', cmd: 'cat LICENSE' },
    { name: '.git/', desc: '仓库地址', cmd: 'open' },
  ];

  function isFile(name) {
    const lower = String(name).toLowerCase().replace(/^\.\//, '');
    return lower.startsWith('readme') || lower === 'info.json' || lower === 'info' ||
      lower.startsWith('license') || lower === '.git' || lower === '.git/';
  }

  /* ---------------------------------------------------------------- 渲染块 */
  function projectRow(project, long) {
    const row = el('button', project.archived ? 'row row--archived' : 'row');
    row.type = 'button';
    row.setAttribute(
      'aria-label',
      `进入项目 ${project.slug}${project.desc ? '：' + project.desc : ''}`
    );

    row.append(el('span', 'row__name', `${project.slug}/`));
    row.append(el('span', 'row__desc', project.desc || '—'));

    const meta = el('span', 'row__meta');
    if (project.language) {
      const dot = el('i', 'dot');
      dot.style.setProperty('--c', langColor(project.language));
      meta.append(dot, document.createTextNode(project.language));
    }
    if (project.stars) meta.append(span('row__stars', `· ★${fmtNum(project.stars)}`));
    if (long && project.updated) meta.append(span('row__date', `· ${project.updated}`));
    row.append(meta);

    row.addEventListener('click', () => submitCmd(`cd ${project.slug}`));
    return row;
  }

  function printProjectList(options) {
    const opts = options || {};
    const list = PROJECTS.filter((project) => opts.all || !project.archived);

    if (!PROJECTS.length) {
      printMuted('这里还没有项目数据。');
      printDim('在仓库根目录运行：npm run sync -- <你的 GitHub 用户名>');
      return;
    }

    if (!list.length) {
      printMuted('没有可显示的项目（也许都被归档了，试试 ls -a）。');
      return;
    }

    const stars = PROJECTS.reduce((sum, project) => sum + (Number(project.stars) || 0), 0);
    const bits = [`${list.length} 个仓库`];
    if (stars) bits.push(`★ ${fmtNum(stars)}`);
    printLine(`~/  ${bits.join('  ·  ')}`, 'line--muted line--indent');

    /* 首屏只铺前几个，免得把标题和输入框挤出屏幕；完整的用 ls 看 */
    const shown = opts.limit ? list.slice(0, opts.limit) : list;
    const box = el('div', 'fs');
    shown.forEach((project) => box.append(projectRow(project, opts.long)));
    printBlock(box);

    if (shown.length < list.length) {
      printMuted(`还有 ${list.length - shown.length} 个没显示 · 输入 ls 看全部`);
    }
  }

  function printFileList(project) {
    printLine(`~/${project.slug}/:`, 'line--muted line--indent');
    const box = el('div', 'fs');

    FILE_ROWS.forEach((file) => {
      const row = el('button', 'row row--file');
      row.type = 'button';
      const desc = file.name === 'LICENSE' ? project.license || '未声明' : file.desc;
      row.setAttribute('aria-label', `${file.name}：${desc}`);

      row.append(el('span', 'row__name', file.name));
      row.append(el('span', 'row__desc', desc));
      row.append(el('span', 'row__meta', '↗'));
      row.addEventListener('click', () => submitCmd(file.cmd));
      box.append(row);
    });

    printBlock(box);
    printMuted('cat README.md 查看说明 · cd .. 回到 ~');
  }

  function printCard(project) {
    const card = el('div', 'card');

    const head = el('div', 'card__head');
    head.append(el('span', 'card__name', `${project.slug}/`));
    if (project.language) head.append(el('span', 'badge', project.language));
    if (project.archived) head.append(el('span', 'badge badge--warn', 'archived'));
    if (project.fork) head.append(el('span', 'badge', 'fork'));
    card.append(head);

    card.append(el('p', 'card__desc', project.desc || '（作者很懒，没有写描述）'));

    const dl = el('dl', 'card__meta');
    const addRow = (key, value) => {
      dl.append(el('dt', null, key));
      const dd = el('dd');
      if (value instanceof Node) dd.append(value);
      else dd.textContent = value;
      dl.append(dd);
    };

    if (project.url) addRow('仓库', linkEl(shortUrl(project.url), project.url));
    if (project.homepage) addRow('演示', linkEl(shortUrl(project.homepage), project.homepage));
    addRow('语言', project.language || '—');
    addRow('更新', project.updated || '—');
    if (project.stars || project.forks) {
      addRow('数据', `★ ${fmtNum(project.stars)} · fork ${fmtNum(project.forks)}`);
    }
    if (project.topics.length) addRow('标签', project.topics.map((topic) => `#${topic}`).join(' '));
    if (project.license) addRow('许可证', project.license);
    card.append(dl);

    const actions = el('div', 'card__actions');
    if (project.url) {
      actions.append(linkEl('↗ 打开仓库', project.url, 'btn btn--primary'));
    }
    const readme = el('button', 'btn', 'cat README.md');
    readme.type = 'button';
    readme.dataset.cmd = 'cat README.md';
    actions.append(readme);

    const back = el('button', 'btn', 'cd ..');
    back.type = 'button';
    back.dataset.cmd = 'cd ..';
    actions.append(back);

    card.append(actions);
    printBlock(card);
  }

  function printReadme(project) {
    const md = el('div', 'md');
    md.append(el('h2', 'md__title', `# ${project.slug}`));
    md.append(el('p', 'md__desc', project.desc || '这个仓库还没有写描述。'));

    const list = el('ul', 'md__list');
    const item = (key, value) => {
      const li = el('li');
      li.append(el('b', null, `${key}：`));
      if (value instanceof Node) li.append(value);
      else li.append(document.createTextNode(value));
      list.append(li);
    };

    item('语言', project.language || '—');
    item('更新', project.updated || '—');
    if (project.stars) item('Star', String(project.stars));
    if (project.topics.length) item('标签', project.topics.map((topic) => `#${topic}`).join(' '));
    if (project.url) item('仓库', linkEl(shortUrl(project.url), project.url));
    if (project.homepage) item('演示', linkEl(shortUrl(project.homepage), project.homepage));
    md.append(list);

    md.append(el('p', 'md__desc', '用 open 在浏览器里打开，或 cd .. 回到项目列表。'));
    printBlock(md);
  }

  function printInfo(project) {
    printBlock(el('pre', 'code', JSON.stringify(project, null, 2)));
  }

  function printLicense(project) {
    const license = project.license || '未声明';
    printLine(`${project.slug} · ${license}`, 'line--ok');
    printText(
      `Copyright (c) ${new Date().getFullYear()} ${NAME}\n\n` +
        `本仓库以 ${license} 许可证发布（以仓库内 LICENSE 文件为准）。\n` +
        '可以自由使用、修改、分发，请保留版权声明。',
      'line--dim'
    );
  }

  function printAmbiguous(list) {
    printMuted('匹配到多个项目，继续输入更具体的名字：');
    const box = el('div', 'fs');
    list.forEach((project) => box.append(projectRow(project, false)));
    printBlock(box);
  }

  function unknownCommand(name) {
    printError(`command not found: ${name}`);
    const suggestion = nearestWord(name, Object.keys(commands));
    if (suggestion) printMuted(`你是不是想输入 ${suggestion}？`);
    else printMuted('输入 help 看看有哪些命令。');
  }

  /* ---------------------------------------------------------------- 路由 */
  function renderTitle(project) {
    document.title = project ? `${project.slug} · ${NAME}` : `${NAME} · terminal`;
  }

  function syncRoute(slug, replace) {
    const hash = slug ? `#/p/${encodeURIComponent(slug)}` : '';
    const url = location.pathname + location.search + hash;
    if (location.pathname + location.search + location.hash === url) return;
    try {
      const method = replace ? 'replaceState' : 'pushState';
      history[method]({ slug: slug || null }, '', url);
    } catch (error) {
      /* file:// 或沙箱环境可能禁止修改地址栏，不影响使用 */
    }
  }

  function enterProject(project, options) {
    const opts = options || {};
    state.cwd = [project.slug];
    updatePs1();
    syncRoute(project.slug);
    renderTitle(project);
    printCard(project);

    if (opts.open && CONFIG.autoJump !== false && project.url) {
      if (openUrl(project.url)) printMuted(`↗ 已在新标签页打开 ${shortUrl(project.url)}`);
    }
    scrollDown(true);
  }

  function goHome(options) {
    const opts = options || {};
    if (!state.cwd.length) {
      if (!opts.quiet) printMuted('已经在 ~ 了。');
      return;
    }
    state.cwd = [];
    updatePs1();
    syncRoute(null);
    renderTitle(null);
    if (!opts.quiet) printLine(`← 回到 ~（${PROJECTS.length} 个仓库）`, 'line--muted');
  }

  function routeFromHash() {
    const match = /^#\/p\/(.+)$/.exec(location.hash || '');
    if (match) {
      let slug = match[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (error) {
        /* 保留原样 */
      }
      const project = projectBySlug(slug);
      if (!project) {
        goHome({ quiet: true });
        return;
      }
      if (state.cwd[0] !== project.slug) enterProject(project, { open: false });
      return;
    }

    if (state.cwd.length) {
      state.cwd = [];
      updatePs1();
      renderTitle(null);
    }
  }

  /* ---------------------------------------------------------------- 输入 */
  function syncInput() {
    const value = input.value;
    const pos = input.selectionStart == null ? value.length : input.selectionStart;
    typedBefore.textContent = value.slice(0, pos);
    typedAfter.textContent = value.slice(pos);
    caret.style.left = `${pos}ch`;
  }

  function setInput(value, caretIndex) {
    input.value = value;
    const pos = caretIndex == null ? value.length : caretIndex;
    input.setSelectionRange(pos, pos);
    syncInput();
  }

  function submitCmd(command) {
    input.value = '';
    syncInput();
    runCommand(command);
    /* 点完按钮后把焦点还给输入框，键盘用户可以直接继续敲命令 */
    if (!window.matchMedia('(hover: none)').matches) {
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    }
  }

  /* ---------------------------------------------------------------- 派发 */
  const ALIASES = (() => {
    const map = {
      ll: 'ls -l',
      la: 'ls -a',
      dir: 'ls',
      cls: 'clear',
      '?': 'help',
      gh: 'open github',
    };
    Object.keys(CONFIG.aliases || {}).forEach((key) => {
      const value = CONFIG.aliases[key];
      if (typeof value === 'string' && value.trim()) map[key.toLowerCase()] = value.trim();
    });
    return map;
  })();

  function parse(text) {
    const parts = [];
    let token = '';
    let quote = '';
    let started = false;
    const source = String(text);

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === '\\' && i + 1 < source.length && (quote !== "'" || source[i + 1] === "'")) {
        token += source[i + 1];
        i += 1;
        started = true;
      } else if (quote) {
        if (char === quote) quote = '';
        else token += char;
      } else if (char === '"' || char === "'") {
        quote = char;
        started = true;
      } else if (/\s/.test(char)) {
        if (started) {
          parts.push(token);
          token = '';
          started = false;
        }
      } else {
        token += char;
        started = true;
      }
    }

    if (started) parts.push(token);
    return { name: parts[0] || '', args: parts.slice(1) };
  }

  function expandAliases(text) {
    let current = String(text);
    for (let i = 0; i < 4; i += 1) {
      const match = /^(\S+)([\s\S]*)$/.exec(current);
      if (!match) return current;
      const key = match[1].toLowerCase();
      const alias = ALIASES[key];
      if (!alias || alias === key) return current;
      current = alias + match[2];
    }
    return current;
  }

  function addHistory(command) {
    if (!command) return;
    if (state.history[state.history.length - 1] === command) return;
    state.history.push(command);
    if (state.history.length > 200) state.history.shift();
    try {
      sessionStorage.setItem('th.history', JSON.stringify(state.history.slice(-100)));
    } catch (error) {
      /* 忽略 */
    }
  }

  function runCommand(raw) {
    const original = raw == null ? '' : String(raw);
    printEcho(original);

    const trimmed = original.trim();
    if (!trimmed) {
      scrollDown(true);
      return;
    }

    addHistory(trimmed);
    state.hPos = -1;
    state.draft = '';
    if (hintbar) hintbar.classList.add('is-hidden');

    const parsed = parse(expandAliases(trimmed));
    const command = commands[parsed.name.toLowerCase()];

    if (!command) {
      unknownCommand(parsed.name);
      scrollDown(true);
      return;
    }

    try {
      command.run(parsed.args, { raw: trimmed });
    } catch (error) {
      console.error(error);
      printError(`内部错误：${error && error.message ? error.message : error}`);
    }
    scrollDown(true);
  }

  /* ---------------------------------------------------------------- 命令 */
  const commands = {};

  commands.help = {
    desc: '显示命令列表',
    usage: 'help [命令]',
    run(args) {
      const target = args[0] && args[0].toLowerCase();
      if (target && commands[target]) {
        printLine(commands[target].usage || target, 'line--ok');
        printDim(`  ${commands[target].desc}`);
        return;
      }

      printMuted('可用命令');
      const grid = el('div', 'cmdlist');
      Object.keys(commands).forEach((key) => {
        const command = commands[key];
        if (command.hidden) return;
        grid.append(el('code', null, command.usage || key), el('span', null, command.desc));
      });
      printBlock(grid);
      printMuted('Tab 补全 · ↑↓ 历史 · Ctrl+L 清屏 · 命令不区分大小写');
    },
  };

  commands.ls = {
    desc: '列出仓库（-l 详情，-a 含归档）',
    usage: 'ls [-l] [-a]',
    run(args) {
      const flags = args.filter((arg) => arg.startsWith('-')).join('');
      const target = args.find((arg) => !arg.startsWith('-'));

      if (target) {
        if (state.cwd.length) {
          printError(`ls: ${target}: 不是目录`);
          return;
        }
        const result = resolveProject(target);
        if (result.project) {
          printMuted(`~ 里只有项目；要看文件得先进去：cd ${result.project.slug}`);
          return;
        }
        printError(`ls: 找不到「${target}」`);
        return;
      }

      if (state.cwd.length) return printFileList(currentProject());
      printProjectList({ all: flags.indexOf('a') >= 0, long: flags.indexOf('l') >= 0 });
    },
  };

  commands.cd = {
    desc: '进入项目；cd .. 返回，cd ~ 回到顶层',
    usage: 'cd <项目 | .. | ~>',
    run(args) {
      const target = (args[0] || '').trim();

      if (!target || target === '~' || target === '/' || target === '..') {
        goHome();
        return;
      }

      if (state.cwd.length && isFile(target)) {
        printError(`cd: ${target} 不是目录`);
        return;
      }

      const result = resolveProject(target);
      if (result.project) {
        enterProject(result.project, { open: true });
        return;
      }
      if (result.ambiguous) {
        printAmbiguous(result.ambiguous);
        return;
      }
      printError(`cd: 没有这个项目「${target}」`);
      printMuted('输入 ls 看看有哪些项目。');
    },
  };

  commands.cat = {
    desc: '查看 README.md / info.json / LICENSE',
    usage: 'cat <文件>',
    run(args) {
      const name = args[0];
      if (!name) {
        printMuted('用法：cat README.md');
        return;
      }

      if (state.cwd.length) {
        const project = currentProject();
        const lower = name.toLowerCase();
        if (lower.startsWith('readme')) return printReadme(project);
        if (lower === 'info.json' || lower === 'info') return printInfo(project);
        if (lower.startsWith('license')) return printLicense(project);
        printError(`cat: ${name}: 没有这个文件`);
        printMuted('这里有 README.md、info.json、LICENSE。');
        return;
      }

      const result = resolveProject(name);
      if (result.project) return printReadme(result.project);
      printError(`cat: ${name}: 没有这个项目`);
    },
  };

  commands.open = {
    desc: '在浏览器打开仓库 / 链接',
    usage: 'open <项目 | 链接>',
    run(args) {
      const target = args[0];

      if (!target) {
        if (state.cwd.length) {
          const project = currentProject();
          if (project.url && openUrl(project.url)) {
            printMuted(`↗ 已打开 ${shortUrl(project.url)}`);
            return;
          }
        }
        printMuted(`可打开：${Object.keys(LINKS).join(' · ')} · 或任意项目名`);
        return;
      }

      const lower = target.toLowerCase();
      if (LINKS[lower]) {
        if (openUrl(LINKS[lower])) printMuted(`↗ 已打开 ${shortUrl(LINKS[lower])}`);
        return;
      }

      if (/^https?:\/\//i.test(target)) {
        if (openUrl(target)) printMuted(`↗ 已打开 ${shortUrl(target)}`);
        return;
      }

      const result = resolveProject(target);
      if (result.project && result.project.url) {
        if (openUrl(result.project.url)) printMuted(`↗ 已打开 ${shortUrl(result.project.url)}`);
        return;
      }

      printError(`open: 找不到「${target}」`);
    },
  };

  commands.pwd = {
    desc: '显示当前路径',
    usage: 'pwd',
    run() {
      printLine(pathText());
    },
  };

  commands.whoami = {
    desc: '当前登录身份',
    usage: 'whoami',
    run() {
      printLine(guest, 'line--ok');
      printDim(`访客模式 · 这是 ${NAME} 的主页`);
      if (guest === DEFAULT_GUEST) {
        printMuted('想换成你自己的名字：login <你的 GitHub 用户名>');
      }
    },
  };

  commands.login = {
    desc: '记住你的 GitHub 名字（换提示符）',
    usage: 'login <GitHub 用户名>',
    run(args) {
      if (!args[0]) {
        printDim(`当前身份：${guest}`);
        printMuted('用法：login <你的 GitHub 用户名>，例如 login octocat');
        return;
      }

      if (args.length > 1) {
        printError('login: 只接受一个名字（GitHub 用户名里不会有空格）');
        return;
      }

      const name = sanitizeWho(args[0]);
      if (!name) {
        printError('login: 不是合法的 GitHub 用户名');
        printMuted('只能包含字母、数字和连字符，且不能以连字符开头或结尾。');
        return;
      }

      guest = name;
      store(WHO_KEY, guest);
      updatePs1();
      syncInput();
      printLine(`欢迎，${guest}！`, 'line--ok');
      printMuted('提示符换好了，刷新也会记住；logout 可以退回去。');
    },
  };

  commands.logout = {
    desc: '退回到 visitor',
    usage: 'logout',
    hidden: true,
    run() {
      guest = DEFAULT_GUEST;
      try {
        localStorage.removeItem(WHO_KEY);
      } catch (error) {
        /* 忽略 */
      }
      updatePs1();
      syncInput();
      printMuted('已退出，又变回 visitor 了。');
    },
  };

  commands.about = {
    desc: '关于我',
    usage: 'about',
    run() {
      printLine(NAME, 'line--ok');
      if (BIO) printText(BIO, 'line--dim');

      const facts = [];
      if (CONFIG.role) {
        facts.push(['角色', CONFIG.role + (CONFIG.tagline ? ` · ${CONFIG.tagline}` : '')]);
      }
      if (LOCATION) facts.push(['位置', LOCATION]);

      const linkKeys = Object.keys(LINKS);
      if (linkKeys.length) {
        const fragment = document.createDocumentFragment();
        linkKeys.forEach((key, index) => {
          if (index) fragment.append(document.createTextNode('  '));
          fragment.append(linkEl(key, LINKS[key]));
        });
        facts.push(['链接', fragment]);
      }

      if (!facts.length) {
        if (!BIO) printMuted('在 config.js 里补充 bio / role / location 就会显示在这里。');
        return;
      }

      printBlank();
      const dl = el('dl', 'card__meta');
      facts.forEach(([key, value]) => {
        dl.append(el('dt', null, key));
        const dd = el('dd');
        if (value instanceof Node) dd.append(value);
        else dd.textContent = value;
        dl.append(dd);
      });
      printBlock(dl);
    },
  };

  commands.contact = {
    desc: '联系方式',
    usage: 'contact',
    run() {
      const keys = Object.keys(LINKS);
      if (!keys.length) {
        printMuted('还没有配置联系方式：在 config.js 的 links / email 里填写。');
        return;
      }

      const grid = el('div', 'cmdlist');
      keys.forEach((key) => {
        grid.append(el('code', null, LINK_LABELS[key] || key), linkEl(shortUrl(LINKS[key]), LINKS[key]));
      });
      printBlock(grid);
      printMuted('也可以直接 open github / open email。');
    },
  };

  commands.neofetch = {
    desc: '系统信息（大概）',
    usage: 'neofetch',
    run() {
      const wrap = el('div', 'neofetch');
      wrap.append(
        el(
          'pre',
          null,
          ['┌─────────────┐', '│  >_         │', '│             │', '│  ~/    ▮    │', '└─────────────┘'].join('\n')
        )
      );

      const dl = el('dl');
      const minutes = Math.max(1, Math.round((Date.now() - state.bootedAt) / 60000));
      const stars = PROJECTS.reduce((sum, project) => sum + (Number(project.stars) || 0), 0);
      const rows = [
        ['user', `${guest}@${HOST}`],
        ['OS', 'GitHub Pages · 静态'],
        ['Shell', 'js 1.0'],
        ['Uptime', `${minutes} min`],
        ['Projects', String(PROJECTS.length)],
        ['Stars', fmtNum(stars)],
        ['Resolution', `${window.innerWidth}×${window.innerHeight}`],
      ];
      rows.forEach(([key, value]) => {
        dl.append(el('dt', null, key), el('dd', null, value));
      });
      wrap.append(dl);
      printBlock(wrap);
    },
  };

  commands.theme = {
    desc: '切换主题（dark / light / auto / crt）',
    usage: 'theme [模式]',
    run(args) {
      const target = (args[0] || '').toLowerCase();

      if (!target) {
        printDim(`当前主题：${themeMode}（实际 ${document.documentElement.dataset.theme}）`);
        printMuted('用法：theme dark | light | auto | crt | nocrt');
        return;
      }
      if (target === 'crt' || target === 'scanlines') {
        applyScanlines(true, true);
        printMuted('扫描线：开');
        return;
      }
      if (target === 'nocrt' || target === 'noscanlines') {
        applyScanlines(false, true);
        printMuted('扫描线：关');
        return;
      }
      if (['dark', 'light', 'auto'].indexOf(target) < 0) {
        printError('theme: 只支持 dark / light / auto / crt / nocrt');
        return;
      }
      applyTheme(target, true);
      printMuted(`主题 → ${target}（实际 ${document.documentElement.dataset.theme}）`);
    },
  };

  commands.history = {
    desc: '命令历史',
    usage: 'history',
    run() {
      if (!state.history.length) {
        printMuted('还没有历史记录。');
        return;
      }
      state.history.slice(-30).forEach((item, index) => {
        printLine(`${String(index + 1).padStart(3, ' ')}  ${item}`, 'line--dim');
      });
    },
  };

  commands.clear = {
    desc: '清屏',
    usage: 'clear',
    run() {
      out.replaceChildren();
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    },
  };

  commands.banner = {
    desc: '再看一眼标题',
    usage: 'banner',
    hidden: true,
    run() {
      printLine(NAME, 'line--ok');
      const line = [CONFIG.role, CONFIG.tagline].filter(Boolean).join(' · ');
      if (line) printMuted(line);
    },
  };

  commands.date = {
    desc: '当前时间',
    usage: 'date',
    hidden: true,
    run() {
      printDim(new Date().toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'medium' }));
    },
  };

  commands.echo = {
    desc: '原样输出',
    usage: 'echo <文本>',
    hidden: true,
    run(args) {
      printLine(args.join(' '));
    },
  };

  commands.github = {
    desc: '打开 GitHub 主页',
    usage: 'github',
    hidden: true,
    run() {
      if (openUrl(LINKS.github)) printMuted(`↗ 已打开 ${shortUrl(LINKS.github)}`);
    },
  };

  commands.sudo = {
    desc: '你不该用这个',
    usage: 'sudo <命令>',
    hidden: true,
    run() {
      printDim(`[sudo] password for ${guest}: ********`);
      printError(`${guest} is not in the sudoers file. This incident will be reported.`);
      printMuted('（已上报给 GitHub，请耐心等待。）');
    },
  };

  commands.exit = {
    desc: '退出（并没有出口）',
    usage: 'exit',
    hidden: true,
    run() {
      printDim('再见。窗口将在 3 秒后关闭……');
      printMuted('骗你的，这是网页。刷新一下就能重新开始。');
    },
  };

  /* ---------------------------------------------------------------- 补全 */
  function commonPrefix(list) {
    if (!list.length) return '';
    return list.reduce((prefix, word) => {
      let index = 0;
      while (
        index < prefix.length &&
        index < word.length &&
        prefix[index].toLowerCase() === word[index].toLowerCase()
      ) {
        index += 1;
      }
      return prefix.slice(0, index);
    });
  }

  function complete() {
    const value = input.value;
    const caretPos = input.selectionStart == null ? value.length : input.selectionStart;
    const head = value.slice(0, caretPos);
    const tail = value.slice(caretPos);
    const match = /(\S*)$/.exec(head);
    const token = match ? match[1] : '';
    const start = head.length - token.length;
    const first = head.slice(0, start).trim() === '';
    const lower = token.toLowerCase();

    const pool = first
      ? Object.keys(commands)
      : state.cwd.length
        ? FILE_ROWS.map((file) => file.name)
        : PROJECTS.map((project) => project.slug);

    let matches = uniq(pool.filter((item) => item.toLowerCase().startsWith(lower))).sort();

    /* 首词补不出命令时，看看是不是想进某个项目 */
    if (!matches.length && first && !state.cwd.length) {
      matches = uniq(
        PROJECTS.map((project) => project.slug).filter((slug) => slug.toLowerCase().startsWith(lower))
      ).sort();
      if (matches.length === 1) {
        const insert = `cd ${matches[0]} `;
        setInput(head.slice(0, start) + insert + tail, start + insert.length);
        return;
      }
    }

    if (!matches.length) {
      printLine(`没有匹配「${token}」`, 'line--muted');
      scrollDown(true);
      return;
    }

    if (matches.length === 1) {
      const insert = matches[0] + (first ? ' ' : '');
      setInput(head.slice(0, start) + insert + tail, start + insert.length);
      return;
    }

    const prefix = commonPrefix(matches);
    if (prefix.length > token.length) {
      setInput(head.slice(0, start) + prefix + tail, start + prefix.length);
    }
    printLine(matches.join('   '), 'line--muted');
    scrollDown(true);
  }

  function navigateHistory(step) {
    if (!state.history.length) return;
    if (state.hPos === -1 && step > 0) state.draft = input.value;
    if (state.hPos === -1 && step < 0) return;

    let pos = state.hPos + step;
    if (pos < -1) pos = -1;
    if (pos > state.history.length - 1) pos = state.history.length - 1;
    state.hPos = pos;

    const value = pos < 0 ? state.draft : state.history[state.history.length - 1 - pos];
    setInput(value);
  }

  function distance(a, b) {
    const left = String(a);
    const right = String(b);
    const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
    for (let j = 1; j <= right.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      }
    }
    return rows[left.length][right.length];
  }

  function nearestWord(word, pool) {
    const needle = String(word).toLowerCase();
    let best = null;
    let bestScore = 3;
    pool.forEach((candidate) => {
      const score = distance(needle, candidate);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
    return needle.length > 1 && bestScore <= 2 ? best : null;
  }

  /* ---------------------------------------------------------------- 页头 */
  function renderBanner() {
    if (bannerName) bannerName.textContent = NAME;
    if (bannerHost) bannerHost.textContent = `${USER}.github.io`;
    if (bannerGh) {
      bannerGh.href = LINKS.github;
      bannerGh.textContent = `@${USER} ↗`;
    }
    if (bannerSub) {
      const line = [CONFIG.role, CONFIG.tagline].filter(Boolean).join(' · ');
      bannerSub.textContent = line || '终端风格的 GitHub 主页 · ls / cd 就能逛';
    }
    if (bannerLinks) {
      bannerLinks.replaceChildren();
      Object.keys(LINKS).forEach((key) => {
        if (key === 'github') return;
        const item = el('li');
        item.append(linkEl(LINK_LABELS[key] || key, LINKS[key]));
        bannerLinks.append(item);
      });
    }
    document.title = `${NAME} · terminal`;
  }

  /* ---------------------------------------------------------------- 启动 */
  function printBootLog() {
    const rows = [
      ['[ ok ] ', 'config.js 已载入'],
      ['[ ok ] ', `~/projects 挂载完成（${PROJECTS.length} 个仓库）`],
      ['[ ok ] ', '等待输入 …'],
    ];

    rows.forEach((row, index) => {
      const line = el('div', 'line line--dim');
      line.style.setProperty('--i', String(index));
      line.append(span('p-user', row[0]), document.createTextNode(row[1]));
      out.append(line);
    });

    if (META.demo) {
      printLine('[ !! ] 示例数据 · 跑 npm run sync 换成你自己的仓库', 'line--warn');
    }
  }

  function boot() {
    const params = new URLSearchParams(location.search);

    /* 分享链接可以带名字：?u=octocat */
    const invited = sanitizeWho(params.get('u') || params.get('user'));
    if (invited) {
      guest = invited;
      store(WHO_KEY, guest);
    }

    const themeParam = params.get('theme');
    const initialTheme =
      ['dark', 'light', 'auto'].indexOf(themeParam) >= 0
        ? themeParam
        : readStored(THEME_KEY) || CONFIG.theme;
    applyTheme(initialTheme, false);

    const scan = readStored(SCAN_KEY);
    applyScanlines(scan ? scan === 'on' : CONFIG.scanlines !== false, false);

    renderBanner();
    updatePs1();
    syncInput();

    /* #/p/<slug> 直接打开时不再刷一遍 ls，免得把项目卡片挤出屏幕 */
    const deepMatch = /^#\/p\/(.+)$/.exec(location.hash || '');
    let deepProject = null;
    if (deepMatch) {
      try {
        deepProject = projectBySlug(decodeURIComponent(deepMatch[1]));
      } catch (error) {
        deepProject = null;
      }
    }

    printBootLog();
    if (invited) printLine(`[ ok ] 你好，${guest} —— 提示符已经用上你的名字`, 'line--dim');
    if (!deepProject) {
      printMuted('试试 ls、cd <项目>、help —— 或者直接用鼠标点下面的项目名。');
      if (CONFIG.autoLs !== false && PROJECTS.length) {
        const limit = CONFIG.autoLsLimit === 0 ? 0 : Number(CONFIG.autoLsLimit) || 6;
        printProjectList({ limit });
      }
    }

    routeFromHash();
    syncInput();
    scrollDown(true);

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    }
  }

  /* ---------------------------------------------------------------- 事件 */
  input.addEventListener('input', syncInput);
  input.addEventListener('keyup', syncInput);
  input.addEventListener('click', syncInput);
  input.addEventListener('select', syncInput);

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) syncInput();
  });

  input.addEventListener('focus', () => promptline.classList.add('is-focused'));
  input.addEventListener('blur', () => promptline.classList.remove('is-focused'));

  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;

    if (event.ctrlKey && !event.metaKey && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        commands.clear.run();
        return;
      }
      if (key === 'u') {
        event.preventDefault();
        setInput('');
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        printLine('^C', 'line--muted');
        setInput('');
        scrollDown(true);
        return;
      }
    }

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        submitCmd(input.value);
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateHistory(1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        navigateHistory(-1);
        break;
      case 'Tab':
        event.preventDefault();
        complete();
        break;
      case 'Escape':
        event.preventDefault();
        setInput('');
        break;
      default:
        break;
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitCmd(input.value);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || !target.closest) return;

    const cmdEl = target.closest('[data-cmd]');
    if (cmdEl) {
      event.preventDefault();
      submitCmd(cmdEl.dataset.cmd);
      return;
    }

    if (target.closest('a, button, input, textarea, select, label')) return;
    if (window.getSelection && String(window.getSelection()).length > 0) return;

    if (!window.matchMedia('(hover: none)').matches) {
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        input.focus();
      }
    }
  });

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const resolved = document.documentElement.dataset.theme;
      applyTheme(resolved === 'light' ? 'dark' : 'light', true);
      if (!window.matchMedia('(hover: none)').matches) {
        try {
          input.focus({ preventScroll: true });
        } catch (error) {
          input.focus();
        }
      }
    });
  }

  window.addEventListener('popstate', routeFromHash);
  window.addEventListener('hashchange', routeFromHash);

  /* 给控制台留个后门，方便调试 */
  window.TERM = { run: runCommand, config: CONFIG, projects: PROJECTS, commands };

  boot();
})();
