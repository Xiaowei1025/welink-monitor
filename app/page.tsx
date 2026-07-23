"use client";

import { FormEvent, useMemo, useState } from "react";

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

export default function Home() {
  const [sources, setSources] = useState(initialSources);
  const [selectedId, setSelectedId] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState("今天 07:42");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("AI 分析服务已接入 · WeLink 消息读取仍等待公司内网桥接");
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);

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

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><span>WeLink 巡检台</span></div>
        <p className="sidebar-label">工作台</p>
        <nav aria-label="主导航">
          <a className="nav-item active" href="#overview"><span>◈</span>总览</a>
          <a className="nav-item" href="#sources"><span>⌁</span>消息源</a>
          <a className="nav-item" href="#reports"><span>▤</span>报告中心</a>
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
          <article className="metric-card"><p>需要持续跟进</p><strong>3</strong><span className="warning-text">其中 1 项存在业务风险</span></article>
          <article className="metric-card"><p>上次执行</p><strong className="time-value">{lastRun}</strong><span>自动任务：每日 08:00</span></article>
          <article className="metric-card"><p>报告接收目标</p><strong>2</strong><span>已启用，等待人工确认发送</span></article>
        </section>

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

        <section className="panel automation" id="automation">
          <div><p className="eyebrow">自动化流程</p><h2>工作日每天 08:00 执行</h2><p>按当前启用的消息源读取数据，生成汇总报告；发送动作保留人工确认。</p></div>
          <div className="automation-controls"><span className="schedule-chip">Asia/Shanghai</span><span className="toggle on">开</span><button className="ghost-button" onClick={() => setNotice("自动化规则编辑功能已就绪：下一步接入内网任务调度器。")}>编辑规则</button></div>
        </section>
      </section>

      {showAdd && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="新增消息源"><form className="modal" onSubmit={addSource}><div className="modal-heading"><div><p className="eyebrow">新增消息源</p><h2>选择要巡检的会话</h2></div><button type="button" className="close-button" onClick={() => setShowAdd(false)}>×</button></div><label>类型<select name="kind" defaultValue="讨论群"><option>通报群</option><option>讨论群</option><option>个人</option></select></label><label>名称<input name="name" placeholder="例如：服务器硬件问题群" autoFocus /></label><label>群 ID 或工号<input name="target" placeholder="例如：1234567891011 或 a00123456" /></label><label>备注<input name="note" placeholder="说明此消息源的用途" /></label><button className="primary-button" type="submit">新增并启用</button></form></div>}
    </main>
  );
}
