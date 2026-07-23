# 内部 AI Agent 交接说明

## 目标与边界

该应用是服务器硬件维护人员的 WeLink 消息巡检工具。网页只负责配置、触发、查看报告和确认发送。**浏览器绝不能直接执行 `welink-cli`，也不能保存 WeLink 或模型凭证。** 所有真实通信在公司内网桥接服务中完成。

当前界面是安全演示模式，示例数据仅用于展示交互，未实际读取、保存或发送企业消息。

## 已实现内容

- 网页：`app/page.tsx`，支持新增、编辑、删除、启停消息源；一键分析、发送预览和自动化规则展示。
- 样式：`app/globals.css`。
- 持久化结构：`db/schema.ts` 定义 `message_sources` 与 `report_runs` 两张 D1 表。
- 平台绑定：`.openai/hosting.json` 已声明 `DB` D1 逻辑绑定。
- 配置模板：`.env.example`。真实 `.env` 必须只存在于内网服务器或受管密钥系统。

## WeLink CLI 对接

底层命令说明位于上级目录的 `welink-cli.md`。本工具所需命令：

```bash
welink-cli auth status
welink-cli im query-recent-conversation --count 100
welink-cli im query-history-message --group-id "<群ID>" --query-count 100
welink-cli im query-history-message --user-account "<工号>" --query-count 100
welink-cli im send-to-group --group-id "<群ID>" --text "<报告>"
welink-cli im send-to-user --receiver "<工号>" --text "<报告>"
```

`query-history-message` 支持 `--message-id` 和 `--query-direction`：首次按条数分页拉取，按消息时间戳过滤近 3/5/10 天；后续用已保存的 `cursor_message_id` 增量读取。讨论群的“全量”也必须分批读取，设置最大页数、最大消息数和超时，防止超长历史造成任务失控。

桥接服务应提供下列受服务令牌保护的能力：

| 能力 | 输入 | 输出 |
| --- | --- | --- |
| 读取会话 | `sourceType`, `targetId`, `lookbackDays`, `cursor` | 标准化消息数组、`nextCursor` |
| 发送报告 | `recipientType`, `targetId`, `text` | 发送状态、远端消息 ID |
| 探测身份 | 无 | CLI 版本、认证状态、运行环境 |

标准化消息字段至少包含 `messageId`、`conversationId`、`sentAt`、`senderAccount`、`senderName`、`contentType`、`text`、`attachments`、`replyToMessageId`。需要先拿到真实 CLI 的 JSON/文本样例再完成解析器；当前 `welink-cli.md` 未给出 IM 命令的结构化输出格式。

## 执行链路

1. 读取所有 `enabled=true` 的消息源。
2. 对通报群按配置的日期范围拉取并按时间戳过滤；对讨论群按游标增量拉取。
3. 去重、清理系统消息、处理图片/文件引用，并将消息按会话分组。
4. 调用公司 AI 网关分析。提示词要求区分“已确认 / 判断中 / 待验证”。
5. 保存 `report_runs`、报告正文、每个来源的新游标和审计日志。
6. 网页展示报告；仅在用户确认或自动化规则明确允许后发送给启用的接收方。

## 尚需完成

- 生成 D1 migration 并实现消息源、接收方、任务、报告的真实 API。
- 接入公司 SSO、管理员和普通查看者角色。
- 实现桥接服务与 `welink-cli` 子进程的安全封装，禁止用户输入进入 shell。
- 将 CLI 输出转换为标准化 JSON，补齐群名到群 ID 的校验流程。
- 接入公司 AI 网关。使用服务账号或密钥管理系统；不要求、也不应使用终端用户个人 API Key。
- 加入任务队列、工作日/节假日规则、失败重试、幂等键、告警和审计。
- 明确消息数据分类、脱敏、保存期限、最小权限和自动发送审批策略。

## 验收建议

1. 用两个测试群和一个测试工号配置消息源，验证启停与时间范围。
2. 用已知问题的讨论记录核对 AI 报告是否覆盖背景、进展、根因、计划、参与者和风险。
3. 验证模型不会把“待验证”表述成事实。
4. 验证发送预览、人工确认、失败重试和重复运行不会造成重复通报。
5. 验证任何浏览器请求、日志和错误页均不泄漏 WeLink 登录态或 AI 密钥。
