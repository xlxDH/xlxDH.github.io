# Terminal Homepage

终端风格的 GitHub 个人主页。用 `ls` 浏览项目、`cd` 打开仓库，也可以切换主题、查看项目文件；桌面上还有一台会自动游玩的像素游戏机。

纯静态、零依赖，可直接部署到 GitHub Pages。

![像素桌面预览](docs/preview.png)

## 部署

1. Fork 本仓库，或将文件推送到你的 GitHub 仓库。个人主页仓库应命名为 `<用户名>.github.io`。
2. 在 `assets/js/config.js` 中设置 `user` 和个人信息。
3. 打开仓库 **Settings → Pages**，将 Source 设为 **GitHub Actions**；若是 Fork，先在 Actions 页面启用工作流。
4. 推送到 `main`，等部署成功后访问 `https://<用户名>.github.io/`；普通项目仓库的地址为 `https://<用户名>.github.io/<仓库名>/`。

工作流会在推送时及每周自动同步公开仓库数据并部署。也可在 Actions 页面手动运行。

## 本地预览

需要 Node.js 18 或更新版本；无需安装依赖：

```bash
npm run dev
```

打开 `http://127.0.0.1:5173`。修改端口：`npm run dev -- 8080`。

## 交互

| 命令 | 作用 |
| --- | --- |
| `ls [-l] [-a]` | 浏览项目；`-l` 显示更新时间，`-a` 包含归档项目 |
| `cd <项目名>` | 打开项目；`cd ..` 或 `cd ~` 返回 |
| `cat <文件>` | 查看项目的 `README.md`、`info.json` 或 `LICENSE` |
| `open <项目名\|链接>` | 打开仓库或链接 |
| `login <名字>` / `logout` | 设置或清除访客显示名 |
| `theme [dark\|light\|auto]` | 切换主题 |
| `help` / `history` / `clear` | 帮助、历史记录、清屏 |

方向键浏览命令历史，`Tab` 补全，`Ctrl+L` 清屏。也可以点击项目卡片。项目深链接格式：`#/p/<项目名>`。

## 自定义与同步

主要设置位于 `assets/js/config.js`，包括用户名、个人资料、主题、背景游戏和隐藏的项目。访客显示名可用 `login <名字>` 设置；静态页面不会自动获取访客的 GitHub 身份。

重新获取 GitHub 项目列表：

```bash
npm run sync -- <GitHub用户名>
```

生成的数据写入 `assets/js/data/projects.js`。同步脚本也支持 `--exclude` 和 `--pinned`，运行 `npm run sync -- --help` 查看选项。

## 检查

```bash
node scripts/check-parser.mjs
node scripts/check-arcade.mjs
python scripts/check-assets.py  # 需要 Pillow
```

## License

[MIT](LICENSE)
