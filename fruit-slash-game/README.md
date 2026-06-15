# 🍉 切水果大作战 (Fruit Slash)

HTML5 Canvas 切水果游戏，支持排行榜、全球加速访问。

**线上地址**: https://game.candy33.xyz

## 技术栈

- **前端**: 原生 HTML5 Canvas + CSS3，零依赖
- **后端**: Vercel Serverless Functions (Node.js)
- **数据库**: Upstash Redis（排行榜存储）
- **部署**: Vercel 自动部署
- **加速/域名**: Cloudflare DNS + CDN

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/fruit-slash-game.git
cd fruit-slash-game
npm install
```

### 2. 配置 Upstash Redis

1. 前往 [Upstash Console](https://console.upstash.com/) 创建免费 Redis 数据库
2. 复制 REST URL 和 Token
3. 创建 `.env.local` 文件：

```bash
cp .env.example .env.local
# 编辑 .env.local 填入你的 Upstash 凭据
```

### 3. 本地开发

```bash
npm run dev
# 访问 http://localhost:3000
```

### 4. 部署到 Vercel

1. 在 [Vercel](https://vercel.com) 导入 GitHub 仓库
2. 在 Vercel 项目 Settings → Environment Variables 添加：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. 部署会自动触发

### 5. 配置自定义域名 (Cloudflare)

1. 在 Vercel 项目 Settings → Domains 添加 `game.candy33.xyz`
2. 在 Cloudflare DNS 添加记录：
   - **类型**: CNAME
   - **名称**: game
   - **目标**: `cname.vercel-dns.com`
   - **代理状态**: 仅 DNS（灰色云朵）或开启代理（橙色云朵）

> 如果开启 Cloudflare 代理（橙色云朵），需要在 Cloudflare SSL/TLS 设置中选择 "Full (Strict)" 模式。

### 6. Cloudflare 优化配置（可选）

在 Cloudflare Dashboard 中：
- **Speed → Optimization**: 开启 Auto Minify (JS/CSS/HTML)
- **Caching → Configuration**: Browser Cache TTL 设为 4 小时
- **Rules → Page Rules**: `game.candy33.xyz/api/*` → Cache Level: Bypass

## 项目结构

```
fruit-slash-game/
├── public/              # 静态前端文件
│   ├── index.html       # 游戏页面
│   ├── css/style.css    # 样式
│   └── js/
│       ├── game.js      # 游戏引擎（Canvas 渲染、物理、碰撞）
│       └── ui.js        # UI 控制器（菜单、排行榜交互）
├── api/
│   └── leaderboard.js   # 排行榜 API (GET/POST)
├── vercel.json          # Vercel 部署配置
├── package.json
└── .env.example
```

## 游戏玩法

- 🖱️ 滑动鼠标/手指切开水果得分
- 🍎 普通水果 1 分，🍇 稀有水果 2-3 分
- 💣 切到炸弹扣一条命
- ❤️ 3 条命，漏掉水果也会扣命
- 🔥 连续切水果触发连击加分
- 📈 难度随时间递增

## API 接口

### GET /api/leaderboard
获取排行榜（默认 Top 20）

### POST /api/leaderboard
提交分数
```json
{ "name": "玩家名", "score": 100, "combo": 5 }
```
