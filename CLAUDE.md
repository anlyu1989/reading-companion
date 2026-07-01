# CLAUDE.md — Reading Companion 项目交接

## 是什么

AI 伴读阅读器 —— fork 自 [azu/mubook-hon](https://github.com/azu/mubook-hon)(epub/pdf reader + Notion sync),改造成**本地存储 + AI 伴读**工具。

核心新增功能:
- **本地 IndexedDB 存储**(替代 Dropbox,国内可用)
- **划词浮动 toolbar**:⭐ 句子 / 🔤 单词 / ✨ 问 AI
- **三类收藏**(sentence/answer/word),句子和 AI 回答带 AI 分析
- **AI 对话历史**按书持久化,可加载历史会话
- **收藏跳回原文** + 顶部 banner 提示
- **绿色品牌 UI**(参考 Earva Figma 风格)

## 当前状态(截至 2026-07-01)

`main` 领先 `origin/main` 5 个 commit(交接时应该已 push):

| commit | 说明 |
|---|---|
| `f6448f7` Z | 划词浮动 toolbar + 单词词义(/api/dict)+ 收藏 AI 分析 + 跳转回原文 banner |
| `2f0a23d` Y | AI 对话历史持久化 + 收藏(句子/回答/单词)+ 跳回原文(marker) |
| `6c29bf8` X | AI 划词问答(/api/chat DeepSeek 流式)+ UI 品牌化重构 |
| `e4254a6`   | fix(viewer): 加左右浮动翻页按钮 ‹ › |
| `7007926`   | 用本地 IndexedDB 替换 Dropbox 作为书籍存储 |

上游主干:`5ce7f1a` (azu/mubook-hon)

## 启动(新机器)

前置:
- Node ≥ 20
- pnpm 10.27.0(package.json 钉的版本);没装:`npm i -g pnpm@10.27.0`
- git submodule(`public/foliate-js`)—— clone 时用 `--recursive` 或补 `git submodule update --init`

```bash
git clone --recursive https://github.com/anlyu1989/reading-companion.git
cd reading-companion
pnpm install

# 环境变量(server-only,不带 NEXT_PUBLIC_ 前缀)
echo "DEEPSEEK_API_KEY=sk-..." > .env.local

# 启动 — 用 dev:next 单独跑 Next(见下方"已知坑")
pnpm dev:next --port 3002
```

推荐 nohup 后台跑(不被会话/MCP teardown 杀掉):
```bash
( nohup pnpm dev:next --port 3002 > /tmp/reading-companion-dev.log 2>&1 < /dev/null & )
```

## 密钥来源

`DEEPSEEK_API_KEY` 用户已在 `~/projects/sentence-parser/.env` 和 `~/projects/intensive-reading/.env.local` 里(同一把 key 可复用)。

## 代码架构

```
app/
├─ storage/                 # IndexedDB 底层
│  ├─ db.ts                 #   统一 openDB (v2: books/bookBlobs/chats/favorites)
│  ├─ bookStorage.ts        #   书籍 CRUD
│  ├─ chatStorage.ts        #   ChatSession CRUD (bookId 索引)
│  └─ favoriteStorage.ts    #   Favorite CRUD (type/bookId/createdAt 索引)
├─ library/
│  ├─ useLibrary.ts         # 首页书架 hook
│  ├─ useBookBlob.ts        # viewer 用的 blob 加载 hook
│  └─ useFavorites.ts       # /favorites 页 hook (SWR)
├─ chat/
│  ├─ ChatContext.tsx       # Provider: openWith / sendFollowUp / loadChat / history / fontScale
│  ├─ ChatPanel.tsx         # 右侧抽屉(选区块 + 消息 + 输入 + 历史 + 字号 + 收藏)
│  └─ ChatPanel.module.css
├─ api/
│  ├─ chat/route.ts         # DeepSeek 流式代理(SSE → text/plain stream)
│  └─ dict/route.ts         # 词典 JSON 接口(response_format=json_object)
├─ favorites/
│  ├─ page.tsx              # /favorites (Tab 全部/句子/回答/单词 + 跳转链接)
│  └─ favorites.module.css
├─ viewer/
│  ├─ content.tsx           # viewer 入口,包 ChatProvider,读 URL 参数
│  └─ epub/
│     ├─ FoliateReader.tsx  # epub 阅读器 (~1700 行,含划词 toolbar/字号/页码/banner)
│     └─ FoliateReader.module.css
├─ styles/
│  └─ tokens.css            # 设计变量(色/圆角/字体/间距)—— #1f9d5a 绿主色
├─ settings/
│  └─ useUserSettings.ts    # TAP_PRESET_DEFAULT 已改全 "none"(默认不点屏幕翻页)
└─ page.tsx                 # 首页 = 书架 + 拖拽上传
```

## 已知坑 & trade-off

1. **`pnpm dev` 失败**,用 `pnpm dev:next` —— wrangler 需要 `./out` 目录,dev 时不存在
2. **Notion Worker (CF Worker) 没在 dev 用** —— 当前工具流程全本地 IDB,Worker 不必启
3. **收藏跳回原文用 banner 而非文字内高亮** —— Foliate paginator 持续 swap iframe doc,四种文字内高亮方案都失败;banner 稳定可见,✕ 手动关
4. **历史 chat session 不存 chapterText** —— 节省空间;加载历史后追问 AI 只有对话 + selection,无章节上下文
5. **首页 "Recent Books" 区块依赖 Notion**,没配 Notion 会显示 "No recent books"(不影响功能)
6. **`preview_start` MCP 与 nohup 冲突** —— preview 拒绝接管非它启的 server;想用 preview 验证需先 kill nohup → preview_start → 验证完 → nohup 重启
7. **原项目大量代码仍未清理**(`app/dropbox/*` / `app/notion/useNotionFileUpload*` / `_fake` 测试夹具 / `bibi-epub` 未维护版本 / 各种 `.play.ts` Playwright 测试)。这些是死代码,不影响运行,可在后续 commit 统一清理

## 用户偏好(接手前请知道)

- **中文对话** — 用户所有交流用中文,回复也用中文
- **教学/开发任务可自主执行** — 不必事事请示
- **反馈风格偏简短直接** — 不喜欢冗长的总结和确认
- **主动建议提速工具** — 看到有 MCP / 工具能显著加速,立刻说
- **dev server 用 nohup** — 长期跑不被会话 teardown 杀
- 用户是**托福阅读老师 + 国际学科化学老师 + 英语培训机构教务**;做过 4 个工具(sentence-parser / complete-words / homework-grader / intensive-reading)。这是他第一个偏个人兴趣的产品

## 可能的下一步(用户没确认,仅供参考)

- 移动端体验(目前 Panel 全屏遮书;考虑底部抽屉式)
- Vercel deploy(任何设备 web 访问)
- 收藏加分组/标签/笔记
- 全书 RAG(目前只用当前章节做上下文)
- 章节结尾自动总结
- 单词收藏做拼写测试 / 闪卡
- 清理原项目死代码(dropbox / bibi / play 测试等)
