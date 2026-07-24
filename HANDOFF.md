# 内部 AI Agent 交接说明

## 目标与边界

该应用是服务器硬件维护人员的 WeLink 消息巡检工具。网页只负责配置、触发、查看报告和确认发送。**浏览器绝不能直接执行 `welink-cli`，也不能保存 WeLink 或模型凭证。** 所有真实通信在公司内网桥接服务中完成。

当前界面是安全演示模式，示例数据仅用于展示交互，未实际读取、保存或发送企业消息。问题卡片、证据和行动项可保存到本地 D1 台账；真实 WeLink 消息接入后再将演示数据替换为实际数据。

## 已实现内容

- 网页：`app/page.tsx`，支持新增、编辑、删除、启停消息源；一键分析、发送预览、自动化规则、问题闭环台账、行动项和流式智能追问。
- 样式：`app/globals.css`。
- 持久化结构：`db/schema.ts` 定义消息源、报告、问题、证据与行动项表；迁移位于 `drizzle/`。
- API：`app/api/analyze/route.ts`、`app/api/chat/route.ts`、`app/api/issues/`；聊天接口以流式文本返回，浏览器端渲染 Markdown 与表格。
- 本地运行：`scripts/run-local.sh`（macOS/Linux）、`start-windows.cmd`（Windows 根目录一键入口，内部调用 `scripts/run-local.cmd`）会初始化 `.wrangler/state/` 中的本地 D1 数据库，再启动网页。Windows 脚本会检查 Node.js 22.13+、自动安装依赖、生成 `.env` 并延迟打开浏览器。该方式没有 ChatGPT、Google 或外部网页登录门禁。
- 配置模板：`.env.example`。真实 `.env` 必须只存在于内网服务器或受管密钥系统。
- AI 适配：`app/api/analyze/route.ts` 通过 OpenAI Chat Completions 兼容接口调用模型；密钥只从 `AI_API_KEY` 读取。

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

## 内网本地部署交接

### 启动与数据

1. Node.js 版本必须为 22.13 或更高。
2. 在项目目录复制 `.env.example` 为 `.env`，并仅在服务器文件中配置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`；设置文件权限为仅运行账户可读。
3. macOS/Linux 执行 `./scripts/run-local.sh`；Windows 双击 `start-windows.cmd`。脚本会执行 `wrangler d1 migrations apply ... --local`，数据库文件保存在 `.wrangler/state/`。
4. 单机使用时只访问 `http://127.0.0.1:4173`。多人使用时通过内网 Nginx 反向代理访问，应用进程仍只绑定 `127.0.0.1`。
5. 打包源代码使用 `./scripts/package-local.sh`；生成的包排除 `.env`、`node_modules`、`.wrangler`、构建产物和发布目录。

### OpenEuler 运行

- 完整步骤见 `deploy/OPEN_EULER_DEPLOY.md`。
- `deploy/welink-monitor.service` 适用于 systemd；应使用专用低权限账户运行。
- `deploy/nginx-welink-monitor.conf` 仅是反向代理示例。上线前按公司策略配置 TLS、访问控制、日志和审计。
- 也提供 `Dockerfile` 与 `compose.yaml`；容器卷必须持久化 `/opt/welink-monitor/.wrangler`，否则台账会在重建容器后丢失。

### 安全边界

- 本地运行不等于浏览器直接拥有 CLI 或模型凭证。所有密钥仍只在运行服务的机器上保存。
- 正式多人部署不能将个人电脑设为共享服务，也不能把 `0.0.0.0:4173` 直接暴露到不受控网段。
- 真实 WeLink CLI 只能部署在受控内网桥接机，桥接 API 必须具备服务令牌、命令白名单、输入校验、审计和最小权限。

## 执行链路

1. 读取所有 `enabled=true` 的消息源。
2. 对通报群按配置的日期范围拉取并按时间戳过滤；对讨论群按游标增量拉取。
3. 去重、清理系统消息、处理图片/文件引用，并将消息按会话分组。
4. 调用公司 AI 网关分析。提示词要求区分“已确认 / 判断中 / 待验证”。
5. 保存 `report_runs`、报告正文、每个来源的新游标和审计日志。
6. 网页展示报告；仅在用户确认或自动化规则明确允许后发送给启用的接收方。

## AI 服务配置与排障

当前已验证的服务端环境变量为：`AI_BASE_URL=https://api.deepseek.com`、`AI_MODEL=deepseek-v4-flash`、`AI_API_KEY=<仅存密钥系统>`。对 Anthropic 兼容 API，应单独实现协议适配，不能仅将地址改为 `/anthropic` 后复用 Chat Completions 请求体。

`POST /api/analyze` 接收已启用消息源的名称、类型、备注、范围和消息数量，调用模型后返回 `{ report, model }`。该接口会限制字段长度和来源数量，且不会将上游响应、请求头或密钥返回给浏览器。

当前阶段传入的是演示元数据，因此报告会明确要求模型不要虚构故障事实。接入真实 WeLink 数据后，必须在调用前完成消息脱敏、去重、时间过滤、附件处理与权限校验。

## 尚需完成

- 实现消息源、接收方、任务、报告的真实 API，并将真实消息归并为问题卡片、证据和行动项。
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
