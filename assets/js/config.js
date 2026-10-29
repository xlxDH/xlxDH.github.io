/* ==========================================================================
 * config.js — 换成你自己的信息，只改这一个文件就够了
 * ==========================================================================
 * 所有字段都可以留空：留空时页面会自己找默认值，不会报错。
 */
window.CONFIG = {
  /* GitHub 用户名。留空 = 自动从 <user>.github.io 域名推断；
     本地预览时推断不出来，建议先填上你自己的用户名。 */
  user: "",

  /* ---------- 展示 ---------- */
  name: "",                      // 留空则显示 user
  role: "写代码 · 也写点别的",     // 一句话身份
  tagline: "",                   // 追加在 role 后面，可留空
  bio: "白天写前端，晚上折腾小工具。喜欢把想法做成能点的东西。",
  location: "",                  // 例如 "Hangzhou, CN"
  email: "",                     // 例如 "hi@example.com"

  /* 页头可点的链接。github 留空会自动指向 github.com/<user> */
  links: {
    github: "",
    blog: "",
    x: "",
    zhihu: "",
    rss: "",
  },

  /* ---------- 交互 ---------- */
  autoJump: true,      // cd 进项目时，自动在新标签页打开仓库
  autoLs: true,        // 启动后自动执行一次 ls（首屏直接看到项目）
  scanlines: true,     // CRT 扫描线
  theme: "auto",       // auto | dark | light
  promptUser: "visitor", // 访客默认名；访客可用 login <GitHub名> 换成自己的
  host: "",            // 提示符里的主机名，留空 = user

  /* ---------- 背景里的 FC 游戏机 ---------- */
  arcade: true,        // 关掉设 false（或 URL 加 ?arcade=off）
  arcadeIdle: 5000,    // 多少毫秒没有操作就自动开局

  /* 不想展示的仓库（slug 或 name，小写） */
  hidden: [],

  /* 自定义别名（也可以直接改这里） */
  aliases: {
    ll: "ls -l",
    la: "ls -a",
    dir: "ls",
    cls: "clear",
    "?": "help",
    gh: "open github",
  },
};
