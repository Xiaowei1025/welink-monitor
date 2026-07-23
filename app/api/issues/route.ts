import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { actionItems, issueEvidence, issues } from "../../../db/schema";

const demoIssues = [
  {
    title: "Atlas 900 节点 GPU 温度告警",
    severity: "P1", status: "处理中", impact: "训练任务存在降频与中断风险", owner: "张工", dueAt: "今天 16:00", updatedAt: "今天 10:24",
    riskReason: "同一机柜已有 4 台设备出现过温，异常风扇模组尚未完成替换验证。",
    nextStep: "完成风扇模组替换，复测 30 分钟温度曲线并回填验证结论。",
  },
  {
    title: "KunLun 主板 RMA 备件到货延期",
    severity: "P2", status: "待协调", impact: "2 台业务备用机恢复计划延后", owner: "李工", dueAt: "今天 14:00", updatedAt: "今天 09:40",
    riskReason: "备件交期未确认，超过承诺窗口后将影响备用资源池。",
    nextStep: "向供应链确认到货时间；若无法满足，申请同型号备件调拨。",
  },
  {
    title: "A03 机柜进风温度波动",
    severity: "P2", status: "待观察", impact: "暂未影响业务，存在关联散热风险", owner: "王工", dueAt: "明天 11:00", updatedAt: "昨天 17:18",
    riskReason: "波动与 GPU 过温告警时间段重叠，需判断是否为环境侧诱因。",
    nextStep: "补采集机柜前后温湿度数据，并与 BMS 告警记录交叉核验。",
  },
];

const demoEvidence = [
  [
    { sourceName: "Atlas 900 故障讨论", author: "张工", messageTime: "今天 09:12", excerpt: "A03-04 节点 GPU 温度连续 10 分钟超过阈值，已先下线训练任务。", isKey: true },
    { sourceName: "服务器硬件问题通报", author: "王工", messageTime: "今天 10:24", excerpt: "风扇转速存在波动，备件已申请，等待更换后验证。", isKey: true },
  ],
  [
    { sourceName: "KunLun 主板 RMA 讨论", author: "李工", messageTime: "今天 09:40", excerpt: "供应商暂未给出明确到货日期，备用机恢复计划需重新评估。", isKey: true },
  ],
  [
    { sourceName: "Atlas 900 故障讨论", author: "陈工", messageTime: "昨天 17:18", excerpt: "进风温度出现短时波动，暂未确认与 GPU 告警的直接关联。", isKey: false },
  ],
];

const demoActions = [
  [
    { title: "更换异常风扇模组", owner: "张工", dueAt: "今天 16:00", status: "进行中", priority: "紧急" },
    { title: "复测 GPU 温度曲线并给出验证结论", owner: "王工", dueAt: "今天 17:00", status: "待执行", priority: "紧急" },
  ],
  [
    { title: "确认备件到货时间并给出调拨预案", owner: "李工", dueAt: "今天 14:00", status: "待执行", priority: "高" },
  ],
  [
    { title: "核验 BMS 温湿度告警记录", owner: "陈工", dueAt: "明天 11:00", status: "待执行", priority: "高" },
  ],
];

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  if (message.includes("no such table")) return "闭环台账正在初始化，请刷新后重试。";
  return "闭环台账暂时不可用。";
}

export async function GET() {
  try {
    const db = getDb();
    const [issueRows, evidenceRows, actionRows] = await Promise.all([
      db.select().from(issues).orderBy(desc(issues.updatedAt), desc(issues.id)),
      db.select().from(issueEvidence).orderBy(desc(issueEvidence.id)),
      db.select().from(actionItems).orderBy(desc(actionItems.id)),
    ]);
    const result = issueRows.map((issue) => ({
      ...issue,
      evidence: evidenceRows.filter((item) => item.issueId === issue.id),
      actions: actionRows.filter((item) => item.issueId === issue.id),
    }));
    return Response.json({ issues: result });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const db = getDb();
    const existing = await db.select({ id: issues.id }).from(issues).limit(1);
    if (existing.length > 0) return Response.json({ seeded: false });

    for (let index = 0; index < demoIssues.length; index += 1) {
      const [created] = await db.insert(issues).values(demoIssues[index]).returning();
      if (!created) continue;
      await Promise.all([
        db.insert(issueEvidence).values(demoEvidence[index].map((item) => ({ ...item, issueId: created.id }))),
        db.insert(actionItems).values(demoActions[index].map((item) => ({ ...item, issueId: created.id }))),
      ]);
    }
    return Response.json({ seeded: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
