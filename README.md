# Terminal Homepage

终端风格的 GitHub 个人主页：`ls` 看项目，`cd` 进仓库，键盘和鼠标都能用。
外面是一层像素桌面——本地壁纸、GitHub 头像窗、终端主窗，右下角常驻一台 `arcade.exe`：
闲置 5 秒，它自己挑游戏、自己打，固定以 25 Hz 更新与绘制。

纯静态、零依赖、不需要构建，直接托管在 GitHub Pages 上。

![像素桌面](docs/preview.png)

`cd` 进项目后是一张可点的项目卡片，仓库会在新标签页打开：

![项目卡片](docs/preview-project.png)

> 截图就是 xlxDH 的真实仓库数据：数据文件里 23 个仓库，默认隐藏 2 个，页面显示 21 个。

---

## 为什么选这套方案

做「终端式主页」常见有四条路：

| 方案 | 手感 | 体积 / 依赖 | 维护成本 | 适合谁 |
| --- | --- | --- | --- | --- |
| **手写静态终端 + 像素桌面**（本项目） | 够像：提示符、光标、补全、历史都有 | 126 KB（gzip 后 36 KB）+ 43 KB 像素壁纸，0 依赖 | 改一个 `config.js` | 想要干净、快、每一行都能自己改 |
| xterm.js + local-echo | 真终端：ANSI、滚屏、光标移动 | 300 KB+，要打包 | 依赖长期升级 | 想做成 WebSSH 那种重度终端 |
| 现成主题（Hugo / Jekyll 的 terminal 主题） | 看主题质量 | 要装生成器工具链 | 模板+主题两层配置 | 想顺便把博客一起搭了 |
| React + 终端组件库 | 组件化 | 框架 + 依赖 | 中等 | 本来就在写 React |

选第一种的原因很实际：GitHub Pages 直接托管静态文件，首屏不用等框架，没有第三方供应链风险；
交互逻辑集中在 `terminal.js` 和 `arcade.js`，桌面外观集中在 `pixel-desktop.css`，想加命令、换壁纸都只动一处。

> **一个前提**：GitHub 的 Profile README 会过滤 `<script>`，所以「能交互」只能放在 **GitHub Pages** 上，
> 在 README 里放一个链接/徽章指过去即可。本项目就是 Pages 站点本身。

## 快速开始（3 步）

1. 新建仓库 `<你的用户名>.github.io`（也可以放任意仓库，路径都是相对的，子目录同样能跑）。
2. 把本目录推上去。
3. 仓库 **Settings → Pages → Source** 选 **GitHub Actions**，等第一次 Action 跑完，
   访问 `https://<你的用户名>.github.io`。

画面里的数据已经是 `xlxDH` 的：23 个仓库，`config.js` 默认隐藏 `-` 和 `ecjtu-22-c`，首页列 21 个。
以后新增仓库可以手动刷新，或等 Action 每周自动跑：

```bash
npm run sync -- xlxDH   # 重新生成 assets/js/data/projects.js
```

（不需要 `npm install`，全项目没有任何依赖。）

## 本地预览

```bash
npm run dev            # http://127.0.0.1:5173
npm run dev -- 8080    # 换端口
```

本地打开时不会从 `127.0.0.1` 推断用户名；如果既没填 `user`、也没有 `projects.js` 数据，名字会显示成 `you`。
在 `assets/js/config.js` 里填上 `user` 即可。

## 能做什么

| 命令 | 作用 |
| --- | --- |
| `ls [-l] [-a]` | 列出仓库；`-l` 带更新时间，`-a` 含归档仓库 |
| `cd <项目 \| .. \| ~>` | 进入项目（默认同时在新标签页打开仓库），`..` / `~` 返回 |
| `cat <文件>` | 在项目里看 `README.md` / `info.json` / `LICENSE` |
| `open <项目\|链接>` | 在浏览器打开仓库、演示地址或任意 URL |
| `pwd` / `whoami` / `about` / `contact` | 路径、身份、关于、联系方式 |
| `login <GitHub 名>` / `logout` | 把提示符换成访客自己的名字（会记住），或退回 `visitor` |
| `neofetch` | 系统信息（大概） |
| `theme [dark\|light\|auto\|crt\|nocrt]` | 主题 / 扫描线 |
| `history` / `clear` / `help` | 历史、清屏、帮助 |

内置别名：`ll` → `ls -l`、`la` → `ls -a`、`dir` → `ls`、`cls` → `clear`、`gh` → `open github`、`?` → `help`，
都在 `config.js` 的 `aliases` 里。

键盘：`↑` `↓` 翻历史、`Tab` 补全（命令 / 项目名 / 文件名）、`Ctrl+L` 清屏、`Ctrl+U` 清行、
`Ctrl+C` 取消、`Esc` 清空、`?` = `help`。
鼠标：点项目名等于 `cd`，卡片上的按钮都能点，右下角可以切深浅色。

深链接：`#/p/<项目名>` 可以直接分享某个项目页，刷新、后退都正常。

## 访客的名字

提示符默认是 `visitor@你`。静态站点**拿不到访客的 GitHub 登录身份**——没有 OAuth 就没有接口能查，
GitHub 的 Referer 只带 `github.com` 域名、不带用户名。所以做成「自报家门」：

```bash
login octocat    # → octocat@your-name:~$，刷新也记得
logout           # 变回 visitor
```

也可以直接分享带名字的链接：`https://you.github.io/?u=octocat`，对方打开就是自己的名字。

> 想做真正的自动识别，只能接 GitHub OAuth（需要后端或 Cloudflare Worker 换 token），
> 对个人主页来说不值得。

## 像素桌面与游戏机

桌面是两层：底下用两张本地像素图拼成壁纸，上面浮着 `home / terminal` 主窗和右侧栏（GitHub 头像窗 + `arcade.exe`）。
超过 1000px 时左右两栏；更窄时上下堆叠，侧栏两张窗并排；手机单列，游戏窗缩到 320px 宽——它不再铺满背景，只占一个小窗。

`arcade.exe` 一打开就在选单：空闲 5 秒，光标滚动 → 随机选中一个游戏 → 交给 AI。
一有键盘 / 点击 / 滚轮 / 输入，立刻回到选单重新计时；一局结束也会回到选单，过一会儿再开下一局。

![背景游戏机](docs/preview-arcade.png)

- **俄罗斯方块**：枚举旋转 × 列，用「高度、空洞、凹凸、消行」加权评分选点，7-bag 随机出块
- **贪吃蛇**：BFS 找食物，落子前用洪泛填充检查剩余空间，快被围死时改走「最大生存空间」
- **打砖块**：预测球的落点（含墙面反弹），带随机瞄准误差，偶尔漏球
- 每局都是新种子：方块顺序、食物位置、砖块布局、发球角度都不同，没有两局一样
- 蛇头两只眼睛会跟着方向转（放大 8 倍的样子）：

  ![蛇头](docs/snake-eyes.png)

- 256×224 逻辑分辨率 + 自绘 5×7 点阵字体，放大后保持像素颗粒；HUD 在底部
- 固定 25 Hz 更新与绘制；切到后台暂停，回来接着算，不会攒一堆帧一次补上
- `prefers-reduced-motion` 或 `?arcade=off` 时不启动；手机上是侧栏小窗

想固定看某个游戏：`?arcade=tetris` / `?arcade=snake` / `?arcade=breakout`（会立刻开局）。

改完可以跑几条自检：

```bash
node scripts/check-arcade.mjs    # 25 Hz、后台暂停/恢复、三个游戏各模拟 2 分钟
node scripts/check-parser.mjs    # 命令解析：引号、空参数、转义
python scripts/check-assets.py   # HTML/CSS 本地资源、图片完整性（需要 Pillow）
```

## 素材

壁纸和图标都在 `assets/images/`：`wallpaper-source.jpg` / `portrait-source.png` 是原图，
`pixel-wallpaper.png` / `pixel-portrait.png` 是实际加载的减色素材，`site-icon.png` / `favicon.ico` 是站点图标。
运行 `python scripts/prepare-art.py` 可重新生成像素素材（需要 Pillow）。

右侧头像窗是页面里唯一的外链图片：用 `projects.js` 里的 `profile.avatar`，同步 GitHub 时自动更新。

## 换成你自己的

只改 `assets/js/config.js`：

```js
user: "xlxDH",        // GitHub 用户名；留空则从 <user>.github.io 自动推断
name: "",             // 留空则显示 user
role: "",             // 一句话身份
tagline: "",          // 主页副标题
bio: "",              // 自我介绍（whoami / about 会显示）
location: "",
email: "",
links: { github: "", blog: "", x: "", zhihu: "", rss: "" },

autoJump: true,       // cd 后自动开新标签
autoLs: true,         // 首屏自动 ls
autoLsLimit: 6,       // 首屏最多列几个（0 = 全部）
scanlines: true,      // CRT 扫描线
theme: "auto",        // auto | dark | light
promptUser: "visitor",// 访客默认名，login 之后会变
host: "",             // 提示符里的主机名，留空 = user

arcade: true,         // 背景 FC 游戏机
arcadeIdle: 5000,     // 多久没操作自动开局（毫秒）

hidden: ["-", "ecjtu-22-c"],   // 不展示的仓库
aliases: { ll: "ls -l", la: "ls -a", dir: "ls", cls: "clear", "?": "help", gh: "open github" },
```

所有字段都可以留空，页面会自己找默认值。

- **配色**：`assets/css/pixel-desktop.css` 顶部的 `:root` 和 `html[data-theme="light"]`；
  `assets/css/terminal.css` 里是终端排版的基础变量。
- **字体**：改 `--font-mono`，建议保持等宽，光标按字符宽度对齐。
- **头像**：换 GitHub 头像后跑一次 `npm run sync`，头像窗会跟着 `profile.avatar` 更新。
- **想藏仓库**：`hidden: ["old-blog"]`，或同步时用 `--exclude`。
- **想置顶**：`npm run sync -- <user> --pinned a,b,c`。
- **不想开背景游戏**：`arcade: false`，或链接里加 `?arcade=off`。

### URL 参数

| 参数 | 作用 |
| --- | --- |
| `?theme=dark` / `light` / `auto` | 固定主题，不写进 localStorage（截图、演示方便） |
| `?u=octocat` / `?user=octocat` | 提示符直接用访客的名字 |
| `?arcade=off` | 关掉背景游戏 |
| `?arcade=tetris` / `snake` / `breakout` | 固定某个游戏并立刻开局 |

## 数据是怎么来的

```
GitHub REST API ──(npm run sync / GitHub Action)──> assets/js/data/projects.js ──> 页面
```

- Action 在每次 push 和每周一 03:17 UTC（北京 11:17）跑一次，用内置的 `GITHUB_TOKEN` 拉仓库列表，
  写成静态 JS。**访客打开页面时不请求 GitHub REST API**，所以没有匿名限额，也不会闪烁。
- 同步脚本会跳过 fork、以 `.` 开头的仓库，以及和用户名同名的 Profile README 仓库；
  归档仓库会保留并标记，`ls` 默认不显示。
- 也可以完全手写 `projects.js`，照着文件里的对象字段写即可。

## 跳转是怎么实现的

- `cd <项目>` 在**同一个事件循环**里用一个隐藏的 `<a target="_blank">` 触发点击。
  比 `window.open` 可靠：这是导航而不是弹窗，不会被拦截器挡掉。
- 页面用 hash 路由 `#/p/<slug>`，GitHub Pages 不需要配 404 兜底，刷新也不会 404。
- 不想要自动跳转就设 `autoJump: false`，卡片上的「打开仓库」按钮仍然可用。

## 目录结构

```
index.html                  页面骨架 + 像素桌面外壳 + 首屏防闪烁的主题脚本
assets/css/terminal.css     终端排版、命令输出、移动端
assets/css/pixel-desktop.css 桌面壁纸、窗口、右侧栏、深浅色配色
assets/js/config.js         你的个人信息（主要改这里）
assets/js/data/projects.js  项目数据，可由脚本生成
assets/js/terminal.js       命令引擎：解析、渲染、路由、补全、历史
assets/js/arcade.js         背景 FC：选单、三个游戏、各自的 AI
assets/images/              壁纸 / 头像 / 图标的源图与像素版
scripts/serve.mjs           零依赖本地服务器
scripts/sync-projects.mjs   拉 GitHub 仓库 → 生成 projects.js
scripts/prepare-art.py      生成像素壁纸 / 头像 / favicon（需要 Pillow）
scripts/check-arcade.mjs    验证 25 Hz、后台暂停与三个游戏
scripts/check-parser.mjs    验证命令解析
scripts/check-assets.py     验证 HTML/CSS 本地资源与图片
.github/workflows/pages.yml 同步数据 + 部署 Pages
docs/preview*.png           README 截图，可以换成你自己的
LICENSE
```

## 常见问题

**会不会被弹窗拦截？**
不会。跳转走的是 `<a target="_blank">` 的点击，属于页面导航，不是 `window.open`。

**新增了仓库但页面没更新？**
`projects.js` 是构建期生成的，跑一次 `npm run sync -- xlxDH` 重新生成（或在 Actions 里手动触发一次 workflow）。

**首屏为什么只列 6 个？**
`config.js` 里的 `autoLsLimit` 控制，设 `0` 就一次列出全部；首屏少一点，标题和输入框才不会被顶出屏幕，完整的用 `ls` 看。

**能自动认出访客的 GitHub 名字吗？**
不能。没有 OAuth 就没有可信的身份来源，Referer 也只给 `github.com` 这个域名。
所以用 `login <名字>` 或 `?u=<名字>` 让访客自己报——一次之后会记住。

**背景游戏会不会拖慢页面？**
不会。逻辑分辨率只有 256×224，一帧几十个 `fillRect`；切到后台会暂停，手机上也只占侧栏一个小窗。

**想加第四个游戏？**
在 `arcade.js` 里写一个 `createXxx(seed)`，返回 `{ title, update, draw, over, score, level }`，
再把名字加进 `GAME_KEYS` 和 `GAME_NAMES` 就行，选单会自动多一行。

**移动端能用吗？**
能。侧栏会堆叠，点项目名直接进入，点命令行出键盘。

**README 截图为什么是深色？**
页面默认 `theme: "auto"` 跟随系统；截图用 `?theme=dark` 固定深色。你也可以用右下角按钮或 `theme dark` 切换。

**没有 npm 环境可以吗？**
可以。整个站点就是一堆静态文件，`scripts/` 和 `package.json` 只是本地工具，删掉也能跑。

**兼容性？**
近两年的 Chrome / Edge / Safari / Firefox。用到了 `dvh`、`color-mix()` 和 canvas 像素渲染，老浏览器会降级但不影响使用。

## License

MIT
