type ChatRole = "user" | "assistant";

type ChatMessage = { role: ChatRole; content: string };
type ChatContext = { report?: string | null; sources?: unknown };

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    const content = message.content.trim().slice(0, 6000);
    return content ? [{ role: message.role, content }] : [];
  });
}

function cleanContext(value: unknown): { report: string; sources: string } {
  const context = value && typeof value === "object" ? value as ChatContext : {};
  const report = typeof context.report === "string" && context.report.trim()
    ? context.report.trim().slice(0, 12000)
    : "尚未执行一键分析，当前只有消息源配置，没有真实聊天正文。";
  const sources = Array.isArray(context.sources)
    ? JSON.stringify(context.sources.slice(0, 30)).slice(0, 12000)
    : "[]";
  return { report, sources };
}

function extractDeltas(chunk: string): string[] {
  return chunk.split("\n\n").flatMap((event) => {
    const data = event.split("\n").find((line) => line.startsWith("data:"))?.replace(/^data:\s*/, "");
    if (!data || data === "[DONE]") return [];
    try {
      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
      const content = parsed.choices?.[0]?.delta?.content;
      return typeof content === "string" ? [content] : [];
    } catch {
      return [];
    }
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI 服务尚未配置。请在服务端配置 AI_API_KEY。" }, { status: 503 });

  const payload = await request.json().catch(() => null) as { messages?: unknown; context?: unknown } | null;
  const messages = cleanMessages(payload?.messages);
  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "请先输入要追问的问题。" }, { status: 400 });
  }
  const context = cleanContext(payload?.context);
  const endpoint = `${(process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
  const model = process.env.AI_MODEL ?? "deepseek-v4-flash";

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      stream: true,
      messages: [
        {
          role: "system",
          content: "你是服务器硬件维护问题的追问助手。只根据给出的巡检报告、消息源元数据和对话历史回答。当前外网演示环境没有真实 WeLink 聊天正文：不得声称看到了未提供的消息、不得编造故障事实、责任人、时间或根因。证据不足时明确说明，并给出最小化的核实建议。中文回答，使用清晰的 Markdown 标题、列表和加粗；回答可审阅、简洁且可执行。",
        },
        {
          role: "user",
          content: `当前巡检报告：\n${context.report}\n\n已启用消息源元数据：\n${context.sources}\n\n请结合以上上下文回答后续对话。`,
        },
        ...messages,
      ],
    }),
  }).catch(() => null);

  if (!upstream) return Response.json({ error: "无法连接 AI 服务。请检查内网网络或服务地址。" }, { status: 502 });
  if (!upstream.ok || !upstream.body) return Response.json({ error: `AI 服务请求失败（HTTP ${upstream.status}）。请检查模型名称和服务端配置。` }, { status: 502 });

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) for (const delta of extractDeltas(part)) controller.enqueue(encoder.encode(delta));
        }
        buffer += decoder.decode();
        for (const delta of extractDeltas(buffer)) controller.enqueue(encoder.encode(delta));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
