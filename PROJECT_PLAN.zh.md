# OfferBen 项目计划（简洁中文版）

> 英文完整版见 [PROJECT_PLAN.md](PROJECT_PLAN.md)；架构与铁律见 [CLAUDE.md](CLAUDE.md)。
> 这份是给中文协作者看的速览，干完活记得同步更新。

## 一句话

一份结构化档案 → 任意职位的定制简历/求职信/招聘官邮件/内推文案 + 匹配评分 + 申请追踪 +
"研究一个人"。一个 Chrome 侧栏扩展贴在职位页旁边，自动读取并评分。数据归用户自己（本地，
或同步到本人 Google Drive）。不爬取、不自动提交。

## 架构

```
apps/web/         Next.js 网页(向导 + 追踪 + 研究) + 服务端 API(密钥只在这)
apps/extension/   Chrome 侧栏扩展(纯 JS，无构建)
packages/core/    全部业务逻辑(schema/AI 抽象/prompt/解析/评分/生成/存储)
packages/db/      Supabase + RLS(可选，未接)
```
铁律：逻辑都在 core，apps 是薄壳。

## 已完成 ✅

- **网页**：建档案(可编辑) → 贴职位 → 匹配评分 → 生成(简历/信/邮件/内推/QA) → 导出 ATS PDF
- **侧栏扩展**：贴在职位页旁，自动读 JD、自动评分(按 URL 缓存)、autofill 填表(跳过敏感字段)
- **截图+视觉兜底**：DOM 读不到时截图给视觉模型(代码就绪，待配额验证)
- **Google Drive 同步**：最小权限 drive.file，档案存本人 Drive，网页+扩展共用
- **申请追踪**：存分数/状态/历史(saved→applied→面试→拒/offer)
- **研究一个人**：OpenAlex 查院校/实验室/论文 + 推断研究品味 + 联系切入点
- **可换 AI**：默认 Gemini，可一键换 OpenAI/Groq/OpenRouter/Ollama/自有模型(改 env)
- **协作底座**：CLAUDE.md/本计划/个人层 + .claude hooks(自动格式化 + 危险命令拦截) + 15 个 issue

## 下一步（详见 GitHub Issues）

- **P1**：#1 测试框架 · #2 验证视觉+评分 · #3 UI 显示配额状态
- **P2**：#4 追踪存生成物 · #5 研究喂给生成 · #6 autofill 加 Workday/Ashby · #7 侧栏内生成
- **P3**：#9 WXT 迁移 · #10 发布就绪 · #11 Drive 选简历 · #12 多数据源 · #13 托管 API · #14 Supabase · #15 面试准备

## 几个要记住的坑

- **免费配额很小**：Gemini 免费层约每天每模型 20 次，太平洋午夜重置。全 429 就是限流了 → 换模型或换 provider。
- 密钥只在服务端；client 只 import 类型；Drive 只用 drive.file；不爬取；投递有人工闸门。
- 提交前跑 `npm run typecheck`；暂无自动化测试。
