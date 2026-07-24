# WeLink 巡检台

用于服务器硬件维护场景的 WeLink 消息巡检界面。可配置问题通报群、问题讨论群与个人会话，选择性启用消息源，生成问题摘要，并在公司内网环境中投递给指定群或个人。

## 当前版本

当前界面已实现：消息源增删改查、单项和批量启停、讨论群/通报群不同的读取规则、分析结果展示、接收方预览和每日 08:00 自动化规则展示。

本地和外部环境均处于安全演示模式：不会连接或发送 WeLink 消息。真实执行必须部署在公司内网，并通过后端桥接服务调用 `welink-cli`。

## 无外部登录的本地／内网运行

当前外部预览链接带有平台登录门禁，仅用于演示。正式交付请使用本地运行包或公司内网服务器；此模式不依赖 ChatGPT、Google 或外部账号。

### 个人本机启动

1. 安装 Node.js 22.13 或更高版本。
2. 将 `.env.example` 复制为 `.env`，填写公司批准的 AI 服务地址、模型和服务端密钥。
3. macOS/Linux 执行：`chmod +x scripts/run-local.sh && ./scripts/run-local.sh`。
4. Windows 双击：`scripts\\run-local.cmd`。
5. 浏览器打开 `http://127.0.0.1:4173`。

首次启动会自动初始化本地问题台账；数据存放在 `.wrangler/state/`。本机模式只适用于个人使用和调试。

### 内网共享服务器

推荐将巡检台部署在一台受控内网服务器，再由 Nginx 提供内网访问。这样 AI 密钥、WeLink CLI 登录态、每日定时任务和问题台账都集中保存，用户只需打开内网地址即可使用。

OpenEuler、Docker/Podman 和 systemd 的完整步骤见 [deploy/OPEN_EULER_DEPLOY.md](./deploy/OPEN_EULER_DEPLOY.md)。

## 公司内网接入

1. 在内网服务器安装并登录 `welink-cli`，使用 `welink-cli auth status` 校验登录状态。
2. 部署一个受认证保护的桥接服务：负责执行 `query-recent-conversation`、`query-history-message`、`send-to-group`、`send-to-user`，并以 JSON 返回结果。
3. 为本应用配置 `.env` 中的 `WELINK_AGENT_BRIDGE_URL`、桥接令牌、AI 服务地址、模型名称与服务端密钥。当前 AI 适配层兼容 OpenAI Chat Completions：`AI_BASE_URL=https://api.deepseek.com`、`AI_MODEL=deepseek-v4-flash`。不要将任何凭证暴露给浏览器。
4. 在 D1 中保存消息源、游标、执行记录和报告；首轮运行拉取指定时间范围，后续运行使用 `--message-id` 与 `--query-direction` 增量读取。
5. 接入企业 SSO、角色权限、审计日志和消息保存期限策略后，再启用自动发送。

## AI 分析原则

讨论群报告至少覆盖问题背景、最新进展、根因状态、下一步计划、参与者及风险。模型输出须区分已确认事实、讨论中的判断和待验证结论；不要将推测写成根因。

网页的“一键分析”会调用服务端 `/api/analyze`，由服务端再调用 AI 服务；当前传入的是演示消息源元数据，待 WeLink 内网桥接完成后替换为真实标准化消息。详细的接口契约、运行流程与排障说明见 [HANDOFF.md](./HANDOFF.md)。
