# WeLink 巡检台：公司内网本地部署

本部署方式不使用 ChatGPT、Google 或任何外部网页登录门禁。网页、问题台账、AI 调用和未来的 WeLink CLI 桥接均运行在公司内网。

## 运行模式

- **个人本机**：在电脑上运行 `scripts/run-local.sh`（Windows 使用 `scripts\\run-local.cmd`），浏览器访问 `http://127.0.0.1:4173`。
- **内网共享服务器（推荐）**：在一台受控的 OpenEuler 服务器上运行服务，同事通过内网反向代理地址访问；WeLink CLI 仅安装并登录在该服务器或独立桥接机上。

请勿将本应用直接暴露到互联网。

## 前置条件

1. Node.js 22.13 或更高版本；推荐使用公司内网制品库提供的 Node.js 22 LTS。
2. 项目目录中包含 `package-lock.json`；首次安装依赖需要访问公司制品库或已准备好的离线 npm 缓存。
3. 复制 `.env.example` 为 `.env`，仅在服务器保存真实 AI 配置。执行：

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

4. 当前外网 AI 地址仅作演示。公司内网应将 `AI_BASE_URL` 修改为公司批准的模型网关；不要把密钥写入浏览器、源码或数据库。

## 本机启动

```bash
chmod +x scripts/run-local.sh
./scripts/run-local.sh
```

首次启动会安装依赖、创建本地 D1 数据库、应用 `drizzle/` 下的迁移，再在 `http://127.0.0.1:4173` 启动。数据保存在 `.wrangler/state/`，重启不会丢失。

如需让同网段同事访问，使用受控服务器部署；不要在个人电脑上直接监听所有网卡。

## OpenEuler systemd 部署

以下示例假设程序目录为 `/opt/welink-monitor`，运行用户为 `welink`：

```bash
sudo useradd --system --home /opt/welink-monitor --shell /sbin/nologin welink
sudo chown -R welink:welink /opt/welink-monitor
sudo install -d -o welink -g welink /var/log/welink-monitor
sudo cp deploy/welink-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now welink-monitor
sudo systemctl status welink-monitor
```

服务默认只监听 `127.0.0.1:4173`。将 `deploy/nginx-welink-monitor.conf` 配置到公司内网 Nginx 后，再让同事通过内部域名访问。Nginx 必须位于受控内网，并按公司要求配置 TLS、访问控制和审计。

## Docker / Podman 部署

在已安装 Docker 或 Podman Compose 的内网服务器中：

```bash
cp .env.example .env
# 编辑 .env，填入公司模型网关配置
docker compose up -d --build
```

容器的 `.wrangler` 数据目录通过命名卷持久化；备份时请同时备份该卷和 `.env`（密钥需按公司密钥规范保管）。

## WeLink CLI 桥接

本项目当前已完成 UI、AI 分析和本地问题台账。要读取和发送真实 WeLink 消息，还需在内网部署桥接服务：

1. 在桥接机安装并登录 `welink-cli`。
2. 桥接服务只向巡检台暴露受认证的 HTTPS API，并执行白名单中的读取／发送命令。
3. 在巡检台服务器 `.env` 配置桥接服务地址和令牌。
4. 先以只读方式试运行；完成审计、权限和消息保留策略后，再启用自动发送。

详细接口要求见项目根目录 `HANDOFF.md`。
