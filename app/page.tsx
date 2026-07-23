"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type SourceKind = "通报群" | "讨论群" | "个人";
type Source = {
  id: number;
  name: string;
  target: string;
  kind: SourceKind;
  note: string;
  enabled: boolean;
  range: string;
  messages: number;
};

const initialSources: Source[] = [
  { id: 1, name: "服务器硬件问题通报", target: "群 ID 1298…441", kind: "通报群", note: "每日问题汇总", enabled: true, range: "近 3 天", messages: 86 },
  { id: 2, name: "Atlas 900 故障讨论", target: "群 ID 2781…910", kind: "讨论群", note: "GPU 与散热问题", enabled: true, range: "全量增量", messages: 342 },
  { id: 3, name: "KunLun 主板 RMA 讨论", target: "群 ID 3382…045", kind: "讨论群", note: "已闭环，暂不关注", enabled: false, range: "全量增量", messages: 0 },
  { id: 4, name: "张工", target: "工号 a00123456", kind: "个人", note: "现场维修进展", enabled: true, range: "近 3 天", messages: 21 },
];

const recipients = [
  { name: "硬件运维日报", target: "群 ID 1298…001", enabled: true },
  { name: "李工", target: "工号 b0067890", enabled: true },
  { name: "重大问题通报", target: "群 ID 7720…890", enabled: false },
];

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };
type IssueStatus = "处理中" | "待协调" | "待观察" | "已闭环";
type ActionStatus = "待执行" | "进行中" | "已完成";
type Evidence = { id: number; sourceName: string; author: string; messageTime: string; excerpt: string; isKey: boolean };
type ActionItem = { id: number; title: string; owner: string; dueAt: string | null; status: ActionStatus; priority: string };
type Issue = {
  id: number; title: string; severity: "P1" | "P2" | "P3"; status: IssueStatus; impact: string; owner: string; dueAt: string | null;
  updatedAt: string; riskReason: string; nextStep: string; isDemo: boolean; evidence: Evidence[]; actions: ActionItem[];
};

const CHAT_STORAGE_KEY = "welink-monitor-chat-history-v1";

const initialIssues: Issue[] = [
  {
    id: -1, title: "Atlas 900 节点 GPU 温度告警", severity: "P1", status: "处理中", impact: "训练任务存在降频与中断风险", owner: "张工", dueAt: "今天 16:00", updatedAt: "今天 10:24", isDemo: true,
    riskReason: "同一机柜已有 4 台设备出现过温，异常风扇模组尚未完成替换验证。", nextStep: "完成风扇模组替换，复测 30 分钟温度曲线并回填验证结论。",
    evidence: [
      { id: -11, sourceName: "Atlas 900 故障讨论", author: "张工", messageTime: "今天 09:12", excerpt: "A03-04 节点 GPU 温度连续 10 分钟超过阈值，已先下线训练任务。", isKey: true },
      { id: -12, sourceName: "服务器硬件问题通报", author: "王工", messageTime: "今天 10:24", excerpt: "风扇转速存在波动，备件已申请，等待更换后验证。", isKey: true },
    ],
    actions: [
      { id: -101, title: "更换异常风扇模组", owner: "张工", dueAt: "今天 16:00", status: "进行中", priority: "紧急" },
      { id: -102, title: "复测 GPU 温度曲线并给出验证结论", owner: "王工", dueAt: "今天 17:00", status: "待执行", priority: "紧急" },
    ],
  },
  {
    id: -2, title: "KunLun 主板 RMA 备件到货延期", severity: "P2", status: "待协调", impact: "2 台业务备用机恢复计划延后", owner: "李工", dueAt: "今天 14:00", updatedAt: "今天 09:40", isDemo: true,
    riskReason: "备件交期未确认，超过承诺窗口后将影响备用资源池。", nextStep: "向供应链确认到货时间；若无法满足，申请同型号备件调拨。",
    evidence: [{ id: -21, sourceName: "KunLun 主板 RMA 讨论", author: "李工", messageTime: "今天 09:40", excerpt: "供应商暂未给出明确到货日期，备用机恢复计划需重新评估。", isKey: true }],
    actions: [{ id: -201, title: "确认备件到货时间并给出调拨预案", owner: "李工", dueAt: "今天 14:00", status: "待执行", priority: "高" }],
  },
  {
    id: -3, title: "A03 机柜进风温度波动", severity: "P2", status: "待观察", impact: "暂未影响业务，存在关联散热风险", owner: "王工", dueAt: "明天 11:00", updatedAt: "昨天 17:18", isDemo: true,
    riskReason: "波动与 GPU 过温告警时间段重叠，需判断是否为环境侧诱因。", nextStep: "补采集机柜前后温湿度数据，并与 BMS 告警记录交叉核验。",
    evidence: [{ id: -31, sourceName: "Atlas 900 故障讨论", author: "陈工", messageTime: "昨天 17:18", excerpt: "进风温度出现短时波动，暂未确认与 GPU 告警的直接关联。", isKey: false }],
    actions: [{ id: -301, title: "核验 BMS 温湿度告警记录", owner: "陈工", dueAt: "明天 11:00", status: "待执行", priority: "高" }],
  },
];

function renderInlineMarkdown(value: string, prefix: string): ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g);
  return tokens.filter(Boolean).map((token, index) => {
    const key = `${prefix}-${index}`;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={key}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={key}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return token;
  });
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function isTableDivider(line: string) {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let codeLines: string[] = [];
  let inCode = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const key = `markdown-${index}`;
    if (line.trim().startsWith("```")) {
      if (inCode) blocks.push(<pre className="chat-code" key={key}>{codeLines.join("\n")}</pre>);
      codeLines = [];
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (line.includes("|") && lines[index + 1] && isTableDivider(lines[index + 1])) {
      const headers = tableCells(line);
      const divider = tableCells(lines[index + 1]);
      const rows: string[][] = [];
      let rowIndex = index + 2;
      while (rowIndex < lines.length && lines[rowIndex].includes("|") && lines[rowIndex].trim()) {
        rows.push(tableCells(lines[rowIndex]));
        rowIndex += 1;
      }
      blocks.push(<div className="markdown-table-wrap" key={key}><table><thead><tr>{headers.map((header, cellIndex) => <th key={`${key}-h-${cellIndex}`} className={divider[cellIndex]?.startsWith(":") && divider[cellIndex]?.endsWith(":") ? "center" : divider[cellIndex]?.endsWith(":") ? "right" : ""}>{renderInlineMarkdown(header, `${key}-h-${cellIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, dataIndex) => <tr key={`${key}-r-${dataIndex}`}>{headers.map((_, cellIndex) => <td key={`${key}-c-${dataIndex}-${cellIndex}`} className={divider[cellIndex]?.startsWith(":") && divider[cellIndex]?.endsWith(":") ? "center" : divider[cellIndex]?.endsWith(":") ? "right" : ""}>{renderInlineMarkdown(row[cellIndex] ?? "", `${key}-c-${dataIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>);
      index = rowIndex - 1;
      continue;
    }
    if (!line.trim()) { blocks.push(<div className="markdown-space" key={key} />); continue; }
    if (line.startsWith("### ")) { blocks.push(<h4 key={key}>{renderInlineMarkdown(line.slice(4), key)}</h4>); continue; }
    if (line.startsWith("## ")) { blocks.push(<h3 key={key}>{renderInlineMarkdown(line.slice(3), key)}</h3>); continue; }
    if (line.startsWith("# ")) { blocks.push(<h2 key={key}>{renderInlineMarkdown(line.slice(2), key)}</h2>); continue; }
    if (/^[-*]\s+/.test(line)) { blocks.push(<div className="markdown-list" key={key}><span>•</span><p>{renderInlineMarkdown(line.replace(/^[-*]\s+/, ""), key)}</p></div>); continue; }
    if (/^\d+\.\s+/.test(line)) { blocks.push(<div className="markdown-list ordered" key={key}><span>{line.match(/^\d+/)?.[0]}.</span><p>{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""), key)}</p></div>); continue; }
    if (line.startsWith("> ")) { blocks.push(<blockquote key={key}>{renderInlineMarkdown(line.slice(2), key)}</blockquote>); continue; }
    blocks.push(<p key={key}>{renderInlineMarkdown(line, key)}</p>);
  }
  if (inCode) blocks.push(<pre className="chat-code" key="markdown-unclosed">{codeLines.join("\n")}</pre>);
  return <div className="markdown-message">{blocks}</div>;
}

export default function Home() {
  const [sources, setSources] = useState(initialSources);
  const [selectedId, setSelectedId] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState("今天 07:42");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("AI 分析服务已接入 · WeLink 消息读取仍等待公司内网桥接");
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [selectedIssueId, setSelectedIssueId] = useState(-1);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selected = sources.find((source) => source.id === selectedId) ?? sources[0];
  const enabledSources = sources.filter((source) => source.enabled);
  const totalMessages = enabledSources.reduce((total, source) => total + source.messages, 0);
  const sourceCounts = useMemo(
    () => ({
      通报群: sources.filter((source) => source.kind === "通报群").length,
      讨论群: sources.filter((source) => source.kind === "讨论群").length,
      个人: sources.filter((source) => source.kind === "个人").length,
    }),
    [sources],
  );
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0];
  const activeIssues = issues.filter((issue) => issue.status !== "已闭环");
  const criticalIssues = activeIssues.filter((issue) => issue.severity === "P1");
  const todayActions = useMemo(() => issues.flatMap((issue) => issue.actions.filter((action) => action.status !== "已完成").map((action) => ({ ...action, issueId: issue.id, issueTitle: issue.title, severity: issue.severity }))), [issues]);

  useEffect(() => {
    let restored: ChatMessage[] = [];
    try {
      const saved = window.localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        restored = parsed.slice(-20).flatMap((item, index) => {
          if (!item || typeof item !== "object") return [];
          const message = item as Partial<ChatMessage>;
          if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
          return [{ id: typeof message.id === "string" ? message.id : `saved-${index}`, role: message.role, content: message.content.slice(0, 8000) }];
        });
      }
    } catch {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    }
    const timer = window.setTimeout(() => {
      setChatMessages(restored);
      setChatLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (chatLoaded) window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatMessages.slice(-20)));
  }, [chatLoaded, chatMessages]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, isChatting]);

  useEffect(() => {
    let active = true;
    async function loadIssues() {
      try {
        let response = await fetch("/api/issues");
        let payload = await response.json() as { issues?: Issue[] };
        if (response.ok && payload.issues?.length === 0) {
          await fetch("/api/issues", { method: "POST" });
          response = await fetch("/api/issues");
          payload = await response.json() as { issues?: Issue[] };
        }
        if (active && response.ok && payload.issues?.length) {
          setIssues(payload.issues);
          setSelectedIssueId(payload.issues[0].id);
        }
      } catch {
        // 内网数据库未连接时保留演示台账，避免影响消息源配置和 AI 问答。
      }
    }
    void loadIssues();
    return () => { active = false; };
  }, []);

  function updateSource(id: number, patch: Partial<Source>) {
    setSources((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  }

  async function runAnalysis() {
    if (enabledSources.length === 0) {
      setNotice("请至少启用一个消息源后再执行分析。");
      return;
    }
    setIsRunning(true);
    setNotice("正在调用 AI 生成巡检报告…");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: enabledSources }),
      });
      const payload = await response.json() as { report?: string; error?: string; model?: string };
      if (!response.ok || !payload.report) throw new Error(payload.error ?? "未获得报告");
      setAnalysisReport(payload.report);
      setIsRunning(false);
      setLastRun("刚刚");
      setNotice(`AI 分析完成：已整理 ${enabledSources.length} 个消息源、${totalMessages} 条消息；报告尚未发送。`);
    } catch (error) {
      setIsRunning(false);
      setNotice(error instanceof Error ? `分析未完成：${error.message}` : "分析未完成，请检查 AI 服务配置。");
    }
  }

  function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = form.get("kind") as SourceKind;
    const name = String(form.get("name") || "").trim();
    const target = String(form.get("target") || "").trim();
    if (!name || !target) return;
    const created: Source = {
      id: Date.now(), name, target, kind, note: String(form.get("note") || "未填写备注"), enabled: true,
      range: kind === "讨论群" ? "全量增量" : "近 3 天", messages: 0,
    };
    setSources((current) => [...current, created]);
    setSelectedId(created.id);
    setShowAdd(false);
    setNotice(`已新增“${name}”，请在公司内网环境校验目标 ID 后启用真实读取。`);
  }

  function changeIssueStatus(issueId: number, status: IssueStatus) {
    setIssues((current) => current.map((issue) => issue.id === issueId ? { ...issue, status, updatedAt: "刚刚" } : issue));
    if (issueId < 0) { setNotice("演示台账已更新；内网数据源接通后会自动保存为共享闭环记录。"); return; }
    void fetch(`/api/issues/${issueId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      .then((response) => { if (!response.ok) throw new Error(); setNotice("问题状态已同步到闭环台账。"); })
      .catch(() => setNotice("状态暂未保存，请稍后重试。"));
  }

  function changeActionStatus(issueId: number, actionId: number, status: ActionStatus) {
    setIssues((current) => current.map((issue) => issue.id === issueId ? { ...issue, actions: issue.actions.map((action) => action.id === actionId ? { ...action, status } : action) } : issue));
    if (issueId < 0) { setNotice("演示行动项已更新；连接内网后会同步给责任人。" ); return; }
    void fetch(`/api/issues/${issueId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, actionStatus: status }) })
      .then((response) => { if (!response.ok) throw new Error(); setNotice(status === "已完成" ? "行动项已完成，闭环台账已更新。" : "行动项进展已更新。"); })
      .catch(() => setNotice("行动项暂未保存，请稍后重试。"));
  }

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = chatDraft.trim();
    if (!question || isChatting) return;
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: question };
    const assistantMessage: ChatMessage = { id: `assistant-${Date.now()}`, role: "assistant", content: "" };
    const conversation = [...chatMessages, userMessage];
    setChatMessages((current) => [...current, userMessage, assistantMessage]);
    setChatDraft("");
    setChatError(null);
    setIsChatting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.slice(-12).map(({ role, content }) => ({ role, content })),
          context: { report: analysisReport, sources: enabledSources },
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "智能问答服务暂时不可用。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const partial = answer;
        setChatMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: partial } : message));
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("智能问答服务未返回内容。");
      setChatMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: answer } : message));
    } catch (error) {
      setChatMessages((current) => current.filter((message) => message.id !== assistantMessage.id));
      setChatError(error instanceof Error ? error.message : "智能问答服务暂时不可用。");
    } finally {
      setIsChatting(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><span>WeLink 巡检台</span></div>
        <p className="sidebar-label">工作台</p>
        <nav aria-label="主导航">
          <a className="nav-item active" href="#overview"><span>◈</span>总览</a>
          <a className="nav-item" href="#sources"><span>⌁</span>消息源</a>
          <a className="nav-item" href="#issues"><span>●</span>问题闭环</a>
          <a className="nav-item" href="#reports"><span>▤</span>报告中心</a>
          <a className="nav-item" href="#chat"><span>✦</span>智能追问</a>
          <a className="nav-item" href="#automation"><span>◷</span>自动化</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection"><span className="dot" />AI 服务端调用已启用</div>
          <p>WeLink 内网桥接待配置<br />不会读取或发送 WeLink 消息</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">服务器硬件 · 问题消息巡检</p>
            <h1>把群里的杂音，变成可执行的问题通报。</h1>
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={() => setNotice("发送前预览已打开：当前报告将发送给 2 个启用接收方。")}>发送前预览</button>
            <button className="primary-button" onClick={runAnalysis} disabled={isRunning}>{isRunning ? "分析中…" : "一键分析"}</button>
          </div>
        </header>

        <div className="notice" role="status"><span>✦</span>{notice}</div>

        <section className="metrics" id="overview" aria-label="巡检概览">
          <article className="metric-card emphasis"><p>本次可读取消息</p><strong>{totalMessages}</strong><span>来自 {enabledSources.length} 个已启用消息源</span></article>
          <article className="metric-card"><p>需要持续跟进</p><strong>{activeIssues.length}</strong><span className="warning-text">其中 {criticalIssues.length} 项为 P1 风险</span></article>
          <article className="metric-card"><p>上次执行</p><strong className="time-value">{lastRun}</strong><span>自动任务：每日 08:00</span></article>
          <article className="metric-card"><p>今日待办</p><strong>{todayActions.length}</strong><span>{todayActions.filter((action) => action.priority === "紧急").length} 项需要优先推进</span></article>
        </section>

        <section className="command-grid" id="issues" aria-label="问题闭环台账">
          <section className="panel issue-register">
            <div className="panel-heading"><div><p className="eyebrow">问题闭环台账</p><h2>今天要盯住哪些问题？</h2></div><span className="demo-chip">演示数据</span></div>
            <div className="issue-list">
              {issues.map((issue) => <button className={`issue-row ${selectedIssue?.id === issue.id ? "selected" : ""}`} key={issue.id} onClick={() => setSelectedIssueId(issue.id)}>
                <span className={`severity-dot ${issue.severity}`}>{issue.severity}</span>
                <span className="issue-row-main"><strong>{issue.title}</strong><small>{issue.impact}</small><em>责任人：{issue.owner} · {issue.dueAt ?? "未设截止时间"}</em></span>
                <span className={`issue-status ${issue.status}`}>{issue.status}</span>
              </button>)}
            </div>
            <div className="issue-register-footer"><span>每个问题都带有责任人、截止时间、证据与行动项</span><button className="small-link" onClick={() => setNotice("真实消息接通后，AI 会自动归并相似讨论并创建问题卡片。")}>自动归并说明 →</button></div>
          </section>
          <aside className="panel today-panel">
            <div className="panel-heading compact"><div><p className="eyebrow">今日必办</p><h2>先处理这 {todayActions.length} 件事</h2></div><span className="today-count">{todayActions.filter((action) => action.priority === "紧急").length} 紧急</span></div>
            <div className="today-action-list">{todayActions.map((action) => <button className="today-action" key={`${action.issueId}-${action.id}`} onClick={() => setSelectedIssueId(action.issueId)}><span className={`action-check ${action.status === "进行中" ? "working" : ""}`}>{action.status === "进行中" ? "···" : "○"}</span><span><b>{action.title}</b><small>{action.issueTitle} · {action.owner} · {action.dueAt}</small></span><em>{action.priority}</em></button>)}</div>
          </aside>
        </section>

        {selectedIssue && <section className="panel issue-detail-panel" aria-label="所选问题详情">
          <div className="panel-heading"><div><p className="eyebrow">{selectedIssue.severity} · {selectedIssue.status} · 责任人 {selectedIssue.owner}</p><h2>{selectedIssue.title}</h2></div><label className="issue-status-select">状态<select value={selectedIssue.status} onChange={(event) => changeIssueStatus(selectedIssue.id, event.target.value as IssueStatus)}><option>处理中</option><option>待协调</option><option>待观察</option><option>已闭环</option></select></label></div>
          <div className="issue-detail-grid">
            <div className="risk-brief"><span>风险判断</span><p>{selectedIssue.riskReason}</p><span>下一步</span><p>{selectedIssue.nextStep}</p><small>最近更新：{selectedIssue.updatedAt} · {selectedIssue.isDemo ? "当前为演示消息证据" : "已同步闭环台账"}</small></div>
            <div className="evidence-timeline"><div className="detail-label">证据时间线 <small>关键结论可追溯到原始消息</small></div>{selectedIssue.evidence.map((item) => <div className="evidence-item" key={item.id}><span className={item.isKey ? "evidence-key" : "evidence-dot"} /><div><b>{item.messageTime} · {item.author}</b><p>{item.excerpt}</p><small>{item.sourceName} · 原消息接通后可跳转</small></div></div>)}</div>
            <div className="action-board"><div className="detail-label">行动项 <small>完成后自动留痕</small></div>{selectedIssue.actions.map((action) => <div className="action-item" key={action.id}><button className={`action-complete ${action.status === "已完成" ? "done" : ""}`} aria-label={`将${action.title}标记为${action.status === "已完成" ? "待执行" : "已完成"}`} onClick={() => changeActionStatus(selectedIssue.id, action.id, action.status === "已完成" ? "待执行" : "已完成")}>{action.status === "已完成" ? "✓" : ""}</button><div><b>{action.title}</b><small>{action.owner} · {action.dueAt ?? "未设截止时间"} · {action.status}</small></div><span className={`priority ${action.priority}`}>{action.priority}</span></div>)}</div>
          </div>
        </section>}

        <section className="workspace-grid">
          <section className="panel sources-panel" id="sources">
            <div className="panel-heading">
              <div><p className="eyebrow">消息源配置</p><h2>今天要看哪些消息？</h2></div>
              <button className="text-button" onClick={() => setShowAdd(true)}>＋ 新增消息源</button>
            </div>
            <div className="filter-row">
              <span className="filter active">全部 <b>{sources.length}</b></span>
              <span className="filter">通报群 <b>{sourceCounts.通报群}</b></span>
              <span className="filter">讨论群 <b>{sourceCounts.讨论群}</b></span>
              <span className="filter">个人 <b>{sourceCounts.个人}</b></span>
              <button className="small-link" onClick={() => { setSources((current) => current.map((source) => ({ ...source, enabled: source.kind === "讨论群" }))); setNotice("已仅启用问题讨论群。"); }}>仅看讨论群</button>
            </div>
            <div className="source-list">
              {sources.map((source) => (
                <button key={source.id} className={`source-row ${selectedId === source.id ? "selected" : ""}`} onClick={() => setSelectedId(source.id)}>
                  <span className={`source-icon ${source.kind}`}>{source.kind === "个人" ? "人" : source.kind === "通报群" ? "报" : "议"}</span>
                  <span className="source-main"><strong>{source.name}</strong><small>{source.target} · {source.note}</small></span>
                  <span className="source-meta"><em>{source.range}</em><i className={source.enabled ? "toggle on" : "toggle"} onClick={(event) => { event.stopPropagation(); updateSource(source.id, { enabled: !source.enabled }); }}>{source.enabled ? "开" : "关"}</i></span>
                </button>
              ))}
            </div>
            <div className="bulk-actions">
              <button onClick={() => { setSources((current) => current.map((source) => ({ ...source, enabled: true }))); setNotice("已启用全部消息源。"); }}>全部启用</button>
              <button onClick={() => { setSources((current) => current.map((source) => ({ ...source, enabled: false }))); setNotice("已暂停全部消息源。"); }}>全部暂停</button>
              <span>讨论群默认采用全量增量读取</span>
            </div>
          </section>

          <aside className="panel inspector">
            <div className="panel-heading compact"><div><p className="eyebrow">所选消息源</p><h2>读取规则</h2></div><button className="delete-button" onClick={() => { setSources((current) => current.filter((source) => source.id !== selected.id)); setSelectedId(sources[0]?.id ?? 0); setNotice(`已删除“${selected.name}”。`); }}>删除</button></div>
            {selected && <div className="editor-form">
              <label>名称<input value={selected.name} onChange={(event) => updateSource(selected.id, { name: event.target.value })} /></label>
              <label>备注<input value={selected.note} onChange={(event) => updateSource(selected.id, { note: event.target.value })} /></label>
              <label>读取范围<select value={selected.range} onChange={(event) => updateSource(selected.id, { range: event.target.value })}><option>近 3 天</option><option>近 5 天</option><option>近 10 天</option><option>全量增量</option></select></label>
              <div className="rule-callout"><span>◎</span><p><b>{selected.kind === "讨论群" ? "讨论群分析规则" : "通报群摘要规则"}</b><br />{selected.kind === "讨论群" ? "提取背景、进展、根因、计划与参与人员；未确认结论会单独标记。" : "按时间范围汇总问题、责任人、状态与待办事项。"}</p></div>
              <button className="save-button" onClick={() => setNotice(`“${selected.name}”的读取规则已保存。`)}>保存修改</button>
            </div>}
          </aside>
        </section>

        <section className="workspace-grid lower-grid" id="reports">
          <section className="panel report-panel">
            <div className="panel-heading"><div><p className="eyebrow">最新分析结果</p><h2>Atlas 900 节点 GPU 温度告警</h2></div><span className="status-pill">需要跟进</span></div>
            {analysisReport ? <pre className="ai-report">{analysisReport}</pre> : <p className="report-lead">点击“一键分析”后将由 AI 根据已启用消息源生成巡检报告。当前尚未接入真实 WeLink 聊天正文。</p>}
            <div className="report-columns">
              <div><span>问题背景</span><p>Atlas 900 训练节点出现 GPU 过温告警，集中在机柜 A03 的 4 台设备。</p></div>
              <div><span>最新进展</span><p>已完成风扇转速与进风温度核验，待更换一台异常风扇模组。</p></div>
              <div><span>初步根因</span><p>散热模组转速波动，仍需通过备件替换验证。</p></div>
              <div><span>下一步计划</span><p>张工今日 16:00 前完成备件替换；王工复测温度曲线。</p></div>
            </div>
            <div className="participants"><span>参与讨论</span><b>张工</b><b>王工</b><b>陈工</b><button className="small-link">查看完整报告 →</button></div>
          </section>

          <aside className="panel delivery-panel">
            <div className="panel-heading compact"><div><p className="eyebrow">报告投递</p><h2>发送到哪里？</h2></div><button className="text-button" onClick={() => setNotice("接收方管理将在公司内网版中接入 WeLink 群 ID 与工号校验。")}>管理</button></div>
            <div className="recipient-list">{recipients.map((recipient) => <div className="recipient-row" key={recipient.name}><span className="avatar">{recipient.name.slice(0, 1)}</span><span><b>{recipient.name}</b><small>{recipient.target}</small></span><i className={recipient.enabled ? "toggle on" : "toggle"}>{recipient.enabled ? "开" : "关"}</i></div>)}</div>
            <button className="outline-button" onClick={() => setNotice("已生成报告发送预览。真实发送将在公司内网桥接服务配置完成后启用。")}>生成发送预览</button>
          </aside>
        </section>

        <section className="panel chat-panel" id="chat" aria-label="智能追问">
          <div className="panel-heading chat-heading">
            <div><p className="eyebrow">智能追问</p><h2>继续问，直到问题说清楚。</h2></div>
            <button className="text-button" disabled={chatMessages.length === 0 || isChatting} onClick={() => { setChatMessages([]); setChatError(null); }}>清空对话</button>
          </div>
          <div className="chat-context"><span>✦</span><p>AI 会参考当前巡检报告和已启用消息源回答。真实 WeLink 聊天正文接入前，无法确认未提供的故障细节。</p></div>
          <div className="chat-messages" ref={chatScrollRef} aria-live="polite" aria-label="问答历史">
            {chatMessages.length === 0 && <div className="chat-empty"><span>✦</span><div><b>从一个问题开始</b><p>例如：这个问题的风险等级如何？下一步应该找谁跟进？</p></div></div>}
            {chatMessages.map((message) => <article className={`chat-bubble ${message.role}`} key={message.id}>
              <span className="chat-avatar">{message.role === "user" ? "我" : "AI"}</span>
              <div className="chat-bubble-body">{message.role === "assistant" ? (message.content ? <MarkdownMessage content={message.content} /> : <span className="typing" aria-label="正在思考"><i /><i /><i /></span>) : <p>{message.content}</p>}</div>
            </article>)}
          </div>
          {chatError && <p className="chat-error" role="alert">{chatError}</p>}
          <form className="chat-composer" onSubmit={askQuestion}>
            <textarea aria-label="向巡检助手提问" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) event.currentTarget.form?.requestSubmit(); }} placeholder="针对当前问题继续提问，例如：请列出今天必须推进的三件事" rows={2} disabled={isChatting} />
            <div><span>Ctrl / ⌘ + Enter 发送 · 对话仅保存在此浏览器</span><button className="primary-button" type="submit" disabled={!chatDraft.trim() || isChatting}>{isChatting ? "回答中…" : "发送"}</button></div>
          </form>
        </section>

        <section className="panel automation" id="automation">
          <div><p className="eyebrow">自动化流程</p><h2>工作日每天 08:00 执行</h2><p>按当前启用的消息源读取数据，生成汇总报告；发送动作保留人工确认。</p></div>
          <div className="automation-controls"><span className="schedule-chip">Asia/Shanghai</span><span className="toggle on">开</span><button className="ghost-button" onClick={() => setNotice("自动化规则编辑功能已就绪：下一步接入内网任务调度器。")}>编辑规则</button></div>
        </section>
      </section>

      {showAdd && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="新增消息源"><form className="modal" onSubmit={addSource}><div className="modal-heading"><div><p className="eyebrow">新增消息源</p><h2>选择要巡检的会话</h2></div><button type="button" className="close-button" onClick={() => setShowAdd(false)}>×</button></div><label>类型<select name="kind" defaultValue="讨论群"><option>通报群</option><option>讨论群</option><option>个人</option></select></label><label>名称<input name="name" placeholder="例如：服务器硬件问题群" autoFocus /></label><label>群 ID 或工号<input name="target" placeholder="例如：1234567891011 或 a00123456" /></label><label>备注<input name="note" placeholder="说明此消息源的用途" /></label><button className="primary-button" type="submit">新增并启用</button></form></div>}
    </main>
  );
}
