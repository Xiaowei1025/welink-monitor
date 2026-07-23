type AnalysisSource = {
  name?: string;
  kind?: string;
  note?: string;
  range?: string;
  messages?: number;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function cleanSources(value: unknown): AnalysisSource[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item) => {
    const source = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      name: typeof source.name === "string" ? source.name.slice(0, 120) : "未命名来源",
      kind: typeof source.kind === "string" ? source.kind.slice(0, 20) : "消息源",
      note: typeof source.note === "string" ? source.note.slice(0, 300) : "",
      range: typeof source.range === "string" ? source.range.slice(0, 30) : "",
      messages: typeof source.messages === "number" ? Math.max(0, Math.floor(source.messages)) : 0,
    };
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI 服务尚未配置。请在服务端配置 AI_API_KEY。" }, { status: 503 });
  }

  const payload = await request.json().catch(() => null) as { sources?: unknown } | null;
  const sources = cleanSources(payload?.sources);
  if (sources.length === 0) {
    return Response.json({ error: "没有可分析的已启用消息源。" }, { status: 400 });
  }

  const endpoint = `${(process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
  const model = process.env.AI_MODEL ?? "deepseek-v4-flash";
  const prompt = [
    "你是服务器硬件维护问题分析助手。以下是当前已启用的 WeLink 消息源元数据；它们是演示数据，不包含真实聊天正文。",
    "请生成一份简洁的中文巡检示例报告。不要虚构具体的故障事实、责任人、时间或根因。",
    "必须包含：报告标题、巡检范围、风险提示、建议的下一步。用 Markdown 输出，控制在 260 个中文字符以内。",
    `消息源：${JSON.stringify(sources)}`,
  ].join("\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: "你输出的是安全、可审阅的运维汇总，不将推测表述为事实。" },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return Response.json({ error: `AI 服务请求失败（HTTP ${response.status}）。请检查模型名称和服务端配置。` }, { status: 502 });
    }
    const result = await response.json() as ChatCompletionResponse;
    const report = result.choices?.[0]?.message?.content?.trim();
    if (!report) return Response.json({ error: "AI 服务未返回可用报告。" }, { status: 502 });
    return Response.json({ report, model });
  } catch {
    return Response.json({ error: "无法连接 AI 服务。请检查内网网络或服务地址。" }, { status: 502 });
  }
}
