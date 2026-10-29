#!/usr/bin/env node
/* ==========================================================================
 * sync-projects.mjs — 把你的 GitHub 仓库拉成页面用的数据文件
 * ==========================================================================
 * 用法：
 *   node scripts/sync-projects.mjs --user <你的用户名>
 *   npm run sync -- <你的用户名>
 *
 * 可选参数：
 *   --token <token>   提高 API 限额（也可以放环境变量 GITHUB_TOKEN）
 *   --out <path>      输出文件，默认 assets/js/data/projects.js
 *   --limit <n>       最多拉多少个仓库，默认 100（上限 300）
 *   --exclude a,b     不展示的仓库
 *   --pinned a,b      置顶的仓库（按给定顺序排在最前）
 *   --forks           连 fork 的仓库一起收
 *   --help
 * ========================================================================== */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.github.com';
const DEFAULT_OUT = 'assets/js/data/projects.js';

/* ---------------------------------------------------------------- 参数 */
const argv = process.argv.slice(2);
const opts = { limit: 100, out: DEFAULT_OUT };

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  const next = () => argv[++i];

  if (arg === '--user' || arg === '-u') opts.user = next();
  else if (arg === '--token' || arg === '-t') opts.token = next();
  else if (arg === '--out' || arg === '-o') opts.out = next();
  else if (arg === '--limit') opts.limit = Number(next()) || 100;
  else if (arg === '--exclude') opts.exclude = next();
  else if (arg === '--pinned') opts.pinned = next();
  else if (arg === '--forks') opts.forks = true;
  else if (arg === '--help' || arg === '-h') opts.help = true;
  else if (!arg.startsWith('-') && !opts.user) opts.user = arg;
}

if (opts.help) {
  console.log(`
用法：node scripts/sync-projects.mjs --user <GitHub 用户名> [选项]

  --user, -u     GitHub 用户名（也可用环境变量 GH_USER）
  --token, -t    GitHub token，可选，用来提高 API 限额
  --out, -o      输出文件，默认 ${DEFAULT_OUT}
  --limit        最多拉多少个仓库，默认 100
  --exclude      逗号分隔，不展示的仓库名
  --pinned       逗号分隔，置顶顺序
  --forks        包含 fork 的仓库
  --help, -h     显示这段帮助
`);
  process.exit(0);
}

const user = String(opts.user || process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER || '')
  .trim()
  .replace(/^@/, '');

if (!user) {
  console.error('缺少用户名。用法：npm run sync -- <你的 GitHub 用户名>');
  process.exit(1);
}

const token = opts.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 300);
const exclude = new Set(
  String(opts.exclude || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);
const pinned = String(opts.pinned || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

/* ---------------------------------------------------------------- 请求 */
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'terminal-homepage-sync',
};
if (token) headers.Authorization = `Bearer ${token}`;

async function api(pathname) {
  const response = await fetch(`${API}${pathname}`, { headers });

  if (response.status === 404) {
    throw new Error(`找不到用户「${user}」，检查一下用户名拼写。`);
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = Number(response.headers.get('x-ratelimit-reset') || 0);
    if (remaining === '0' || response.status === 429) {
      const when = reset ? new Date(reset * 1000).toLocaleString('zh-CN') : '稍后';
      throw new Error(
        `GitHub API 限额用完了（未登录 60 次/小时）。${when} 之后重试，或设置 GITHUB_TOKEN 环境变量。`
      );
    }
    throw new Error(`GitHub API 拒绝请求（${response.status}）。`);
  }
  if (!response.ok) {
    throw new Error(`GitHub API 返回 ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/* ---------------------------------------------------------------- 主流程 */
function toProject(repo) {
  const license =
    repo.license && repo.license.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
      ? repo.license.spdx_id
      : '';

  return {
    slug: repo.name,
    name: repo.name,
    desc: (repo.description || '').trim(),
    url: repo.html_url,
    homepage: /^https?:\/\//i.test(repo.homepage || '') ? repo.homepage : '',
    language: repo.language || '',
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 8) : [],
    updated: (repo.pushed_at || repo.updated_at || '').slice(0, 10),
    license,
    archived: Boolean(repo.archived),
    fork: Boolean(repo.fork),
  };
}

async function main() {
  console.log(`→ 正在读取 github.com/${user} …`);

  let profile = null;
  try {
    profile = await api(`/users/${user}`);
  } catch (error) {
    if (!String(error.message).includes('限额')) throw error;
    console.warn('  ! 用户资料读取失败，继续拉仓库。');
  }

  const repos = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await api(
      `/users/${user}/repos?per_page=100&page=${page}&sort=pushed&direction=desc&type=owner`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100 || repos.length >= limit) break;
  }

  const projects = repos
    .filter((repo) => !repo.name.toLowerCase().startsWith('.'))
    /* 跳过 GitHub 个人主页 README 仓库本身 */
    .filter((repo) => repo.name.toLowerCase() !== user.toLowerCase())
    .filter((repo) => opts.forks || !repo.fork)
    .map(toProject)
    .filter((project) => project.slug)
    .filter((project) => !exclude.has(project.slug.toLowerCase()))
    .slice(0, limit);

  /* 置顶排序 */
  if (pinned.length) {
    const order = new Map(pinned.map((slug, index) => [slug, index]));
    projects.sort((a, b) => {
      const left = order.has(a.slug.toLowerCase()) ? order.get(a.slug.toLowerCase()) : Infinity;
      const right = order.has(b.slug.toLowerCase()) ? order.get(b.slug.toLowerCase()) : Infinity;
      return left - right;
    });
  }

  const meta = {
    user,
    generatedAt: new Date().toISOString(),
    demo: false,
    source: 'github-api',
    profile: profile
      ? {
          name: profile.name || '',
          bio: profile.bio || '',
          blog: /^https?:\/\//i.test(profile.blog || '') ? profile.blog : '',
          location: profile.location || '',
          avatar: profile.avatar_url || '',
          followers: profile.followers || 0,
          publicRepos: profile.public_repos || 0,
        }
      : null,
  };

  const outPath = path.resolve(process.cwd(), opts.out);
  const body = `/* =========================================================================
 * 自动生成，请勿手动编辑。
 * 由 scripts/sync-projects.mjs 于 ${new Date().toISOString()} 生成
 * 用户：${user} · 仓库数：${projects.length}
 * 想改内容就改 GitHub 上的仓库信息，然后重新运行 npm run sync
 * ========================================================================= */
window.PROJECTS_META = ${JSON.stringify(meta, null, 2)};

window.PROJECTS = ${JSON.stringify(projects, null, 2)};
`;

  await writeFile(outPath, body, 'utf8');

  console.log(`✓ 已写入 ${path.relative(process.cwd(), outPath)}（${projects.length} 个仓库）`);
  projects.forEach((project) => {
    const lang = project.language || '—';
    console.log(`  · ${project.slug.padEnd(28)} ${lang.padEnd(14)} ★${project.stars}`);
  });

  if (!token) {
    console.log('  i 未登录的 API 限额是 60 次/小时；设置 GITHUB_TOKEN 可提升到 5000。');
  }
  console.log('→ 本地预览：npm run dev');
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  if (String(error.message).includes('fetch failed')) {
    console.error('  看起来是网络问题：检查代理，或先手动编辑 assets/js/data/projects.js。');
  }
  process.exit(1);
});
