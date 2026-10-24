# 发布到 GitHub

这个目录是一份独立整理的公开源码，不包含个人论文、笔记、原托管项目配置或原仓库的 Git 历史。

## 发布前

1. 确认使用哪一个 GitHub 账号。仓库和提交会显示该账号的公开用户名。
2. 如果不想公开私人邮箱，在 GitHub **Settings → Emails** 中开启邮箱隐私，复制 GitHub 提供的 no-reply 地址。
3. 项目署名为 **Paperloom contributors**。不要为了填写 README 提交私人邮箱、真实姓名或个人网站。
4. 运行 `npm test` 和 `npm run check`。

说明：[GitHub 提交邮箱设置](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)。

## 推荐：创建一个空仓库

在 GitHub 选择 **New repository**：

- Repository name：`paperloom`，也可以使用你选择的名称。
- Visibility：**Public**。
- 不勾选自动创建 README、`.gitignore` 或许可证；这些文件已经包含在此目录中。
- 不需要把账号密码或访问 Token 发送给任何协作者。

创建后可以选择以下一种上传方式。

### GitHub Desktop

登录官方 GitHub Desktop。选择 **File → Add local repository**，选中这个目录；如果提示不是 Git 仓库，按提示在此目录初始化。提交前检查 Name / Email 使用你希望公开的署名和 GitHub no-reply 地址，再选择 **Publish repository** 并公开。

如果已经创建同名空仓库，可以先通过 GitHub Desktop 克隆该空仓库，再把本目录内容复制进去，提交并 Push。

### Git 命令行

在本目录终端中运行。将大写占位文字替换为你自己的公开用户名、GitHub 提供的 no-reply 邮箱，以及真实空仓库 URL；不要把这些占位文字原样用于提交。

```bash
git init -b main
git config user.name "YOUR_PUBLIC_GITHUB_NAME"
git config user.email "YOUR_GITHUB_NOREPLY_EMAIL"
git add .
git diff --cached --stat
git commit -m "Initial open-source release"
git remote add origin YOUR_EMPTY_REPOSITORY_URL
git push -u origin main
```

通过官方工具完成 GitHub 登录授权。这个流程不需要向聊天或 README 提供密码、Token、SSH 私钥。

### 网页上传

解压公开源码压缩包，把**目录内的文件与文件夹**上传到空仓库。不要只把整个 ZIP 当作一个文件上传，否则 GitHub 不会自动展开源码和 README。网页上传时检查 `.github/`、`.gitignore` 和 `.env.example` 等隐藏文件是否包含。

## 仓库展示设置

推荐 Description：

> A local-first paper library with an interactive research graph, PDF annotations and on-device translation.

推荐 Topics：

```text
paper-management research knowledge-graph pdf-reader local-first literature-review
```

- README 已包含中英文入口、真实功能截图、快速开始、数据说明和路线图。
- 可将 `docs/assets/hero.svg` 作为品牌素材参考。GitHub 社交预览如要求栅格格式，可在发布时另导出 PNG。
- 首次发布后检查 README 图片、中英文链接和 Actions 测试结果。
- 启用 GitHub Private vulnerability reporting，与 [SECURITY.md](../SECURITY.md) 中的入口保持一致。
- 当前没有公众在线演示地址；本机合成演示通过 `npm run demo` 运行。

公开仓库会展示所属账号。隐藏私人姓名、邮箱和原部署信息，并不等于隐藏 GitHub 用户名。
