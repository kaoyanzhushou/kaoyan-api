# 考研资料库后端API代理服务

为考研资料库网站提供安全的AI API代理服务，保护API密钥不暴露在前端代码中。

## 功能特性

- 🔒 **密钥保护**：API密钥存储在服务端环境变量，不暴露给前端
- 🤖 **DeepSeek API代理**：支持非流式和流式（SSE）对话
- 📝 **科研计划书生成**：专用API，基于研究方向生成学术级计划书
- 🛡️ **CORS安全**：只允许指定域名访问
- ⚡ **速率限制**：每IP每分钟30次请求，防止滥用
- 🚀 **多平台部署**：支持Vercel、Render、Railway、本地运行

## API端点

### 健康检查
```
GET /api/health
```

### 非流式对话
```
POST /api/chat
Content-Type: application/json

{
  "systemPrompt": "你是一个 helpful assistant",
  "messages": [{"role": "user", "content": "你好"}],
  "userMessage": "补充消息",
  "options": {
    "model": "deepseek-chat",
    "temperature": 0.7,
    "max_tokens": 2000
  }
}
```

### 流式对话（SSE）
```
POST /api/chat/stream
```

### 科研计划书生成
```
POST /api/proposal/generate
Content-Type: application/json

{
  "field": "运动生理学",
  "topic": "运动与骨骼肌适应",
  "title": "研究题目（可选）",
  "subject": "研究对象（可选）",
  "methods": "研究方法（可选）",
  "duration": "24个月",
  "style": "detailed"
}
```

## 本地运行

### 1. 安装依赖
```bash
cd api-server
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 DeepSeek API Key
```

### 3. 启动服务
```bash
npm start
```

服务将在 `http://localhost:3001` 启动。

### 4. 测试
```bash
curl http://localhost:3001/api/health
```

## 部署到 Vercel（推荐，免费）

### 方法一：Vercel CLI
```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
cd api-server
vercel --prod
```

### 方法二：GitHub 集成
1. 将 api-server 目录推送到 GitHub 仓库
2. 登录 [vercel.com](https://vercel.com)
3. 点击 "Add New Project"，选择你的仓库
4. 在 "Environment Variables" 中添加：
   - `DEEPSEEK_API_KEY` = 你的DeepSeek API密钥
5. 点击 "Deploy"

部署完成后，你的API地址为：`https://你的项目名.vercel.app/api/health`

## 部署到 Render（免费）

1. 登录 [render.com](https://render.com)
2. 点击 "New" → "Web Service"
3. 连接你的 GitHub 仓库
4. 配置：
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. 在 "Environment Variables" 中添加 `DEEPSEEK_API_KEY`
6. 点击 "Create Web Service"

## 部署到 Railway

1. 登录 [railway.app](https://railway.app)
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库
4. 在 "Variables" 中添加 `DEEPSEEK_API_KEY`
5. 等待部署完成

## 前端集成

在考研资料库网站中，将API请求地址从直接调用DeepSeek改为调用你的后端服务：

```javascript
// 原来（不安全，密钥暴露在前端）
const response = await fetch('https://api.deepseek.com/chat/completions', {
  headers: { 'Authorization': 'Bearer sk-xxx' }  // 密钥暴露！
});

// 现在（安全，通过后端代理）
const response = await fetch('https://你的项目名.vercel.app/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userMessage: '你好',
    systemPrompt: '你是一个 helpful assistant'
  })
});
```

## 获取 DeepSeek API Key

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入 "API Keys" 页面
4. 点击 "Create API Key"
5. 复制生成的 API Key（只显示一次，请妥善保存）

## 安全建议

1. **永远不要**将API密钥提交到GitHub或暴露在前端代码中
2. 使用环境变量管理密钥
3. 配置CORS白名单，只允许你的网站域名访问
4. 设置合理的速率限制，防止API被滥用
5. 定期轮换API密钥
6. 监控API调用量和费用

## 技术栈

- Node.js + Express
- CORS 中间件
- express-rate-limit 速率限制
- dotenv 环境变量管理
- DeepSeek API（OpenAI兼容格式）

## 许可证

MIT
