import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { actionItems, issues } from "../../../../db/schema";

function asId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params;
  const id = asId(rawId);
  if (!id) return Response.json({ error: "无效的问题编号。" }, { status: 400 });

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return Response.json({ error: "更新内容无效。" }, { status: 400 });
  try {
    const db = getDb();
    if (typeof payload.actionId === "number" && typeof payload.actionStatus === "string") {
      const actionStatus = payload.actionStatus.slice(0, 30);
      await db.update(actionItems).set({ status: actionStatus, updatedAt: "刚刚" }).where(eq(actionItems.id, payload.actionId));
    } else {
      const patch: { status?: string; owner?: string; dueAt?: string; updatedAt: string; closedAt?: string | null } = { updatedAt: "刚刚" };
      if (typeof payload.status === "string") {
        patch.status = payload.status.slice(0, 30);
        patch.closedAt = payload.status === "已闭环" ? "刚刚" : null;
      }
      if (typeof payload.owner === "string") patch.owner = payload.owner.slice(0, 60);
      if (typeof payload.dueAt === "string") patch.dueAt = payload.dueAt.slice(0, 60);
      await db.update(issues).set(patch).where(eq(issues.id, id));
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "更新未保存，请稍后重试。" }, { status: 500 });
  }
}
