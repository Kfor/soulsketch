# SoulSketch — AI Soulmate Drawing & Matching Web App

## Background

SoulSketch 是一个"红娘式"AI 聊天抽卡 Web 应用，灵感来自星座+画像类 dating app（如 Astairo、Soulmate Sketch）。核心体验是通过 AI 对话逐步"画出你的灵魂伴侣"，产出可分享的卡片，并可选加入用户池做合拍度匹配。产品目标是快速上线、冲爆款传播、验证付费转化。

一句话动线：用户无需登录进入对话 → 几轮图选题+自由输入逐步把灵魂伴侣画像"画清晰" → 生成三张可分享结果卡（画像/人设关键词/星座合拍点评） → 免费预览带水印，高清去水印靠付费或邀请解锁 → 中后段引导上传星座+自拍加入用户池（渐进式登录） → 系统按合拍度在 opt-in 池内推荐 → 双向 Like 后开聊。

## Target Users & Scenarios

- **主要用户**：18-35 岁，对星座/占卜/恋爱话题感兴趣的年轻人
- **使用场景**：
  - 娱乐抽卡：好奇心驱动，"看看AI画出来的灵魂伴侣长什么样"
  - 社交分享：生成卡片发 TikTok/Instagram/小红书/朋友圈
  - 轻度 dating：加入池子寻找合拍的人
- **市场**：英文优先（TikTok 冷启动），中文可后续扩展

## User Flow

### 核心交互形态：聊天式界面

整个产品的核心交互是 **ChatGPT 式的聊天界面**，不是步骤页面：

- **布局**：全屏聊天界面，底部固定聊天输入框
- **AI 消息格式**：每条 AI 消息 = 文字（红娘口吻）+ 可选的选项卡片/图片卡片
- **用户输入**：既可以点击选项推进，也可以随时自由输入文字进行互动
- **画像展示**：画像作为聊天中的消息卡片出现，随对话推进逐步演进
- **会话连续性**：整个漏斗 A 是一个连续的聊天会话，不存在"页面跳转"

### 漏斗 A：聊天 → 画像 → 导出卡片（传播/裂变/付费）

整个漏斗 A 在一个聊天会话中完成，画像在对话中逐步"画清晰"。

**阶段 1：破冰 + 初始轮廓**（前 1-2 轮，预置线稿，粗略轮廓）
- AI 开场（红娘口吻）+ 首个选项问题（想找 男/女/都可）
- 用户选择或自由回答 → AI 回复 + 展示第一张粗略轮廓线稿
- 线稿非常简略（如模糊的人形轮廓），营造"正在画"的感觉
- Supabase 匿名登录自动完成，用户无感知

**阶段 2：深度勾勒**（第 3-5 轮，预置线稿，逐步清晰到素描级别）
- 每轮 AI 发送"选项 + 问题"（如体型偏好、气质风格、穿搭风格等）
- 每题 3-5 个图选项，用户可点选也可自由描述
- 每轮回答后，展示的线稿从轮廓逐步过渡到类似素描的效果
- 线稿按 Question Graph 规则切换（预制资源，按标签组合选取）

**阶段 3：AI 生成 + 多步迭代**（第 6 轮起，AI 实时生成）
- 线稿阶段结束，基于前几轮收集的偏好拼接 prompt，调用 AI 图像生成
- AI 生成第一版彩色画像（仍为聊天中的图片卡片）
- AI 继续追问更细节的问题（发色、眼型、表情、场景等）
- 每次用户回答后，AI 重新生成/微调画像（image-to-image / inpaint）
- 用户可随时自由输入修改（"更成熟一点/眼睛更圆/发色换棕色"）
- 此阶段无固定轮次上限，用户觉得满意时可选择"完成"

**阶段 4：校准 + 结果**（用户选择完成后，或 AI 判断画像已稳定）
- AI 话术："最后校准 — 让结果更贴合你的缘分频率"
- 请求输入星座（必填）+ 上传自拍（可选）
- 自拍用途拆分：勾选"仅用于本次校准" 或 "同时加入缘分池"
- 上传自拍触发邮箱验证（渐进式登录）
- 生成最终三张卡（作为聊天消息中的卡片组）：
  - 理想型画像（高质量版）
  - 人设关键词卡
  - 星座合拍度条形图 + 红娘判词
- 免费：低清预览 + 水印保存
- 付费/邀请解锁：高清去水印 + 额外版本

**阶段 5：持续微调**（结果后仍可继续聊天）
- 用户可在同一聊天中继续输入修改需求
- 每次微调产生版本号，天然留存/分享
- 微调次数受限（免费 N 次，付费更多）

### 漏斗 B：入池 → 推荐 → 联系（订阅/增值）

1. **入池引导**（结果页次 CTA：看看现实里谁跟你最合拍）
   - 上传自拍 1-3 张 + 星座 + 基础标签
   - 勾选同意加入匹配池（opt-in，默认 false）
   - 触发邮箱验证绑定账号
   - 立即回报："加入后解锁今天 10 个缘分推荐"
2. **推荐/匹配**（系统推荐 + 过滤，非自由搜索）
   - "今天的 N 个缘分推荐"
   - 轻量筛选：年龄段/城市/兴趣/星座
   - 免费：每天 5 个候选（部分模糊）
   - 付费：每天 50 个 + 高级筛选 + 回看历史
3. **联系**（双向 Like 机制）
   - 免费：可 Like，限次
   - 双向 Like 后开启站内聊天（付费权益）
   - 一键拉黑/举报

### 分享裂变流

- 分享卡片自动生成"猜猜我喜欢哪种？"挑战链接
- 朋友打开 → 展示 TA 的卡 → 大按钮"抽你的灵魂伴侣画像" → 回流
- 邀请奖励阶梯：1人=无水印导出 / 2人=高清导出 / 3人=3次新版本

## Core Requirements

### R1: 聊天式 AI 画像生成

**聊天引擎**
- 聊天界面（类 ChatGPT）：底部输入框 + 消息流
- AI 消息 = 文字（红娘口吻，由 LLM 生成）+ 可选的选项按钮 + 可选的图片卡片
- 用户可点击选项推进，也可随时自由输入文字
- 聊天状态持久化（Supabase `chat_messages` 表），支持刷新恢复、跨设备续聊

**Question Graph + LLM 混合驱动**
- 前几轮由 Question Graph 驱动：预定义的节点（题目+选项+线稿标签映射+下一跳规则）
- 中后段由 LLM 驱动：根据已收集偏好动态生成追问，不再依赖固定图谱
- LLM 同时负责生成红娘口吻的文案、人设描述、prompt 拼接

**画像渐进生成（三阶段）**
- **预置线稿阶段**（前 ~5 轮）：
  - 准备 30-60 张预制线稿资源，按标签分类（性别×体型×气质×风格）
  - 前 1-2 轮展示粗略轮廓（极简线稿）
  - 第 3-5 轮逐步切换到更精细的素描级线稿
  - 渐进清晰效果：轮廓 → 简笔 → 素描，通过线稿分层实现
- **AI 生成阶段**（第 6 轮起）：
  - 基于前几轮收集的偏好，由 LLM 拼接 prompt，调用图像生成 API
  - 生成彩色画像，作为聊天中的图片卡片展示
  - 支持多步迭代：用户继续回答或自由输入 → 重新生成/微调
  - 微调用 image-to-image / inpaint（限次数：免费 N 次，付费更多）
- **最终输出**：三张卡（画像图 / 人设关键词卡 / 星座合拍度条形图+红娘判词）

### R2: 用户系统（渐进式登录）

- 匿名登录开局（Supabase Anonymous Auth）
- 高价值动作触发绑定：上传自拍、付费、联系
- 绑定方式：Email OTP / Magic Link（最小摩擦）
- 匿名→绑定数据迁移（MVP 用方案 B：创建新用户+迁移数据）

### R3: 用户池 & 匹配推荐

- 入池：opt-in + 自拍 + 标签 + 星座
- 匹配主要靠 pref_embedding（偏好向量），不做脸相似度
- Supabase pgvector 做 ANN 检索 + 规则过滤
- 系统推荐模式，非自由搜索
- 免费 5/天，付费 50/天
- 双向 Like 才能聊天

### R4: 付费系统（Stripe）

- **一次性导出**（$2.99-$3.99）：高清去水印 + 额外 2 版本
- **Plus 订阅**（$7.99-$12.99/月）：更多抽卡次数 + 更多推荐 + 联系权限 + 高级筛选
- **邀请解锁**：替代付费的增长通道
- Vercel API route 处理 checkout + webhook
- Supabase entitlements 表管理权益

### R5: 安全与风控

- 不允许上传他人照片搜索（条款+举报）
- 城市只到城市级别，不精确定位
- 搜索/推荐限频
- 一键退出池子 + 删除照片（硬删除，含向量索引）
- 18+ 年龄门槛
- 内容审核：挡裸露/未成年/骚扰性请求
- RLS：pool_photos/face_embedding 只能本人读写
- 搜索结果走 SECURITY DEFINER RPC，控制返回字段
- 每设备/IP 限制匿名阶段生成次数
- 分享链接用短 token + 过期时间

### R6: 增长引擎

- 分享卡裂变（三张连发+挑战链接）
- 邀请奖励阶梯
- 每日回访："今日恋爱运势+适合的 soulmate 类型"每日卡
- 首页示例墙（30-60 张预制卡，社证明）
- 池子人数计数显示
- 结果页展示模糊候选卡预告（引导入池）

## Design / Constraints

### 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Next.js (App Router) |
| 部署 | Vercel |
| 后端/数据库 | Supabase (Postgres + pgvector + Auth + Storage + Edge Functions) |
| 支付 | Stripe (Checkout + Webhooks) |
| AI 图像生成 | 扩散模型 API（具体待定：DALL-E / Stable Diffusion / Flux 等） |
| AI 聊天 | LLM API（生成红娘判词/人设描述/prompt 拼接） |

### 数据模型（最小可用）

- `profiles`: id, display_name, gender_pref, age_bucket, city, zodiac, is_in_pool, visibility_level, created_at
- `entitlements`: user_id, plan (free/plus), plan_expires_at, export_credits, search_daily_limit, contact_daily_limit, daily_draws_left, daily_recos_left
- `persona_sessions`: id, user_id, status (active/completed), current_phase (sketch/ai_gen/calibration/done), summary_json (结构化人设), pref_embedding vector(n), created_at, updated_at
- `chat_messages`: id, session_id, role (system/assistant/user), content_text, content_options jsonb (选项按钮数据), content_image_url (线稿/AI生成图 URL), sketch_level (null/outline/simple/detailed/ai_v1/ai_v2/...), created_at
- `sketch_assets`: id, tags jsonb (gender, body_type, vibe, style 等标签), detail_level (outline/simple/detailed), storage_path, created_at
- `generated_assets`: id, session_id, user_id, asset_type (portrait/keyword_card/zodiac_card), storage_path, is_highres, version, created_at
- `pool_photos`: id, user_id, storage_path, created_at
- `search_logs`: id, user_id, query_type, created_at
- `contact_requests`: id, from_user, to_user, status (pending/accepted/rejected/blocked), created_at
- `invites`: id, inviter_id, code, invitee_id, is_valid, created_at

### 关键约束

- **MVP 速度优先**：目标快速上线验证
- **Web 优先**（H5/PWA），App 后续再做
- **聊天式交互**：核心体验是 ChatGPT 式聊天，不是表单/步骤页面
- **不做脸相似度检索**（MVP 只用偏好向量）
- **不爬外部社媒数据**，不导出/推荐外部社媒账号
- **不做实时聊天**（MVP 只做 Like + Request）— 注意：这指的是用户间的聊天，不是 AI 聊天
- 前 ~5 轮用预置线稿（渐进清晰），之后切 AI 实时生成
- 付费墙不放在第一次看结果之前
- AI 生成的画像和微调都在聊天流中完成，不跳转到单独页面

## Environment Bootstrap

### Prerequisites

- Node.js >= 20
- pnpm (包管理器)
- Supabase CLI (`npx supabase`)
- Vercel CLI (`npx vercel`)
- Stripe CLI (`stripe`)（用于本地 webhook 测试）

### 初始化命令

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 填入: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#       SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
#       STRIPE_WEBHOOK_SECRET, AI_IMAGE_API_KEY, AI_LLM_API_KEY

# 3. 启动本地 Supabase
npx supabase start

# 4. 执行数据库迁移
npx supabase db push

# 5. 启用 pgvector 扩展
# (在迁移文件中: CREATE EXTENSION IF NOT EXISTS vector;)

# 6. 启动开发服务器
pnpm dev

# 7. Stripe webhook 本地转发
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 健康检查

```bash
# 前端
curl http://localhost:3000

# Supabase
npx supabase status

# Stripe webhook
stripe trigger checkout.session.completed
```

### E2E 可开始条件

- `pnpm dev` 启动无报错
- Supabase 本地实例运行中，pgvector 扩展已启用
- Stripe webhook 本地转发正常
- 能匿名登录 → 完成一次聊天生成 → 看到结果卡

## Failure Recovery Runbook

### 1. Supabase 本地启动失败

- **故障信号**: `npx supabase start` 报错 / Docker 容器未运行
- **自救命令**: `npx supabase stop && docker system prune -f && npx supabase start`
- **验证命令**: `npx supabase status` 显示所有服务 running
- **失败后下一步**: 检查 Docker Desktop 是否运行；检查端口占用 `lsof -i :54321`

### 2. pgvector 扩展不可用

- **故障信号**: SQL 报错 `type "vector" does not exist`
- **自救命令**: `psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"`
- **验证命令**: `psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`
- **失败后下一步**: 确认 Supabase 版本支持 pgvector；检查 supabase/config.toml

### 3. Stripe Webhook 签名验证失败

- **故障信号**: `/api/stripe/webhook` 返回 400，日志显示 signature verification failed
- **自救命令**: `stripe listen --forward-to localhost:3000/api/stripe/webhook` 重启，更新 `.env.local` 中的 `STRIPE_WEBHOOK_SECRET` 为 CLI 输出的 whsec_xxx
- **验证命令**: `stripe trigger checkout.session.completed` 返回 200
- **失败后下一步**: 确认 webhook route 未解析 body（Next.js 需要 raw body）

### 4. AI 图像生成 API 超时/报错

- **故障信号**: 生成画像请求超时或返回非 200
- **自救命令**: 检查 API key 有效性 `curl -H "Authorization: Bearer $AI_IMAGE_API_KEY" <api-health-endpoint>`；检查 rate limit
- **验证命令**: 用测试 prompt 手动调用 API 确认可用
- **失败后下一步**: 切换备用模型/provider；或临时降级为只展示预置线稿

### 5. 匿名登录不生效

- **故障信号**: 前端调用 `supabase.auth.signInAnonymously()` 报错
- **自救命令**: 在 Supabase Dashboard → Auth → Settings 确认 "Enable anonymous sign-ins" 已开启；或在 `supabase/config.toml` 中设置 `[auth] enable_anonymous_sign_ins = true`
- **验证命令**: `curl -X POST $SUPABASE_URL/auth/v1/signup -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}'`
- **失败后下一步**: 检查 Supabase 版本是否支持匿名登录（需 >=2.x）

## Out of Scope (MVP)

- 原生 App（iOS/Android）
- 脸相似度匹配（face_embedding）— MVP 只用偏好向量
- 实时聊天（WebSocket/Realtime）— MVP 只做 Like + Request
- 外部社媒爬虫/数据
- 多语言国际化（MVP 仅英文）
- 精确地理定位
- 广告变现
- Boost 小额增购（$0.99-$1.99 的即时道具）
- 每日运势推送（需 App 或 Web Push）
