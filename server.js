/**
 * 考研资料库后端API代理服务
 * 功能：代理DeepSeek等AI API请求，保护API密钥
 * 部署：支持Vercel Serverless、Render、Railway、本地运行
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== 中间件 ==========
app.use(express.json({ limit: '1mb' }));

// CORS配置 - 只允许指定域名访问
const allowedOrigins = [
  'https://kaoyanzhushou.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // 在此添加你的自定义域名
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许无origin的请求（如curl、Postman测试）
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不允许的CORS来源'));
    }
  },
  credentials: true
}));

// 速率限制 - 每个IP每分钟最多30次请求
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '考研资料库API代理服务',
    version: '1.0.0',
    deepseek_configured: !!process.env.DEEPSEEK_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ========== DeepSeek API 代理 ==========
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * 调用DeepSeek API
 * @param {Array} messages - 对话消息数组
 * @param {Object} options - 配置选项
 */
async function callDeepSeek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }

  const requestBody = {
    model: options.model || 'deepseek-chat',
    messages: messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens || 2000,
    stream: options.stream || false,
  };

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`);
  }

  return response;
}

// 非流式对话
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, systemPrompt, userMessage, options } = req.body;

    // 构建消息
    let chatMessages = [];
    if (systemPrompt) {
      chatMessages.push({ role: 'system', content: systemPrompt });
    }
    if (messages && Array.isArray(messages)) {
      chatMessages = chatMessages.concat(messages);
    }
    if (userMessage) {
      chatMessages.push({ role: 'user', content: userMessage });
    }

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const response = await callDeepSeek(chatMessages, options || {});
    const data = await response.json();

    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model: data.model
    });
  } catch (error) {
    console.error('Chat API错误:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 流式对话（SSE）
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, systemPrompt, userMessage, options } = req.body;

    let chatMessages = [];
    if (systemPrompt) {
      chatMessages.push({ role: 'system', content: systemPrompt });
    }
    if (messages && Array.isArray(messages)) {
      chatMessages = chatMessages.concat(messages);
    }
    if (userMessage) {
      chatMessages.push({ role: 'user', content: userMessage });
    }

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }

    const response = await callDeepSeek(chatMessages, { ...(options || {}), stream: true });

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 流式转发
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          } else {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Stream API错误:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== 科研计划书生成专用API ==========
app.post('/api/proposal/generate', async (req, res) => {
  try {
    const { field, topic, title, subject, methods, duration, style } = req.body;

    if (!field || !topic) {
      return res.status(400).json({ error: '研究领域和研究方向不能为空' });
    }

    const systemPrompt = `你是一位运动人体科学领域的资深教授和博士生导师，擅长指导学生撰写科研计划书。
请根据以下信息，生成一份学术规范、内容详实、逻辑清晰的科研计划书。
要求：
1. 包含8个标准部分：选题背景与研究意义、国内外研究现状、研究目标与研究内容、研究方法与技术路线、研究创新点、预期研究成果、研究进度安排、参考文献
2. 语言专业、学术规范，符合体育学/运动人体科学博士申请要求
3. 研究方法具体可操作，包含具体的检测指标和实验设计
4. 参考文献引用真实存在的经典文献和最新研究
5. 字数约4000-5000字`;

    const userMessage = `研究领域：${field}
研究方向：${topic}
研究题目：${title || '（请根据研究方向自动生成）'}
研究对象：${subject || '（请根据研究方向推荐）'}
研究方法：${methods || '（请根据研究方向推荐）'}
研究周期：${duration || '24个月'}
内容详细程度：${style || 'detailed'}

请生成完整的科研计划书。`;

    const response = await callDeepSeek(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      { temperature: 0.7, max_tokens: 4000 }
    );

    const data = await response.json();

    res.json({
      success: true,
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
    });
  } catch (error) {
    console.error('Proposal生成错误:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== 错误处理 ==========
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: 'API端点不存在' });
});

// ========== 启动服务器 ==========
app.listen(PORT, () => {
  console.log(`
========================================
  考研资料库API代理服务已启动
  端口: ${PORT}
  环境: ${process.env.NODE_ENV || 'development'}
  DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置'}
  健康检查: http://localhost:${PORT}/api/health
========================================
  `);
});

module.exports = app;
