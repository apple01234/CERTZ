# 特殊交付形态规则（delivery-variants）

> 本文件由 SKILL.md §3.4 计量分层（패턴 D）拆出；正文只保留指针与核心规则，完整细则以本文件为准。
> 适用时机：多入口 HTML 项目、prototype 双文件交付、固定图片导出（小红书卡片等）任一场景出现时必读。

## 目录

- §2 多入口文件项目
- §3 Prototype 双文件交付（稳定规则）
- §4 固定图片导出项目（小红书卡片等）

---

## 2. 多入口文件项目（新增规则）

当项目包含**多个独立入口 HTML 文件**时（例如 `index.html` + `light.html`，或多个页面）：

1. **所有入口文件必须在同一 commit 中提交**（`git add .` 自然包含全部）
2. **send_file 策略：**
   - 若只有一个**主入口**（其他为辅助），默认只吐主入口
   - 若调用方 Skill 有显式要求吐出多个文件（如 prototype 双文件），按调用方要求执行
   - 禁止遗漏：所有 HTML 文件都必须被 git 追踪
3. **禁止**对项目目录调用 `ext=directory` 吐文件夹

示例（`index.html` 为主入口，`light.html` 为新增变体）：
```bash
# 同一次 commit 包含两个文件
git add index.html light.html assets/
git commit -m "V4: 新增 light 主题变体"
git tag v4
```

send_file 只吐主入口：
```json
{"title": "北京旅游网站", "ext": "web_project", "file_path": "/我的项目/北京旅游网站/index.html", "project_name": "北京旅游网站", "version": "V4"}
```

---

## 3. Prototype 双文件交付（稳定规则）

当调用方 Skill 为 `prototype.md` 且该版本包含双交付文件（可交互原型 + 流程文档）时：

1. **版本纳入范围（必做）**
   本次版本必须同时纳入并提交两个 HTML 文件（通常为 `prototype.html` 与 `flow.html`），禁止只提交其中一个。
2. **对话流输出（必做）**
   对同一版本号调用 `send_file` **两次**，分别吐出两个单文件：
   - 第一次：`prototype.html`
   - 第二次：`flow.html`
3. **卡片命名建议**
   在 `title` 中标注文件角色，便于用户区分（title 不含版本号）：
   - `{项目名}-prototype`
   - `{项目名}-flow`
4. **禁止项**
   - 禁止将 `prototype.html + flow.html` 打包为目录一次性吐出
   - 禁止只吐其中一个文件并声称已完成 prototype 双交付

示例（同一版本 V4，连续两次）：
```json
{"title":"企业客户管理后台-prototype","ext":"web_project","file_path":"/我的项目/企业客户管理后台/prototype.html","project_name":"企业客户管理后台","version":"V4"}
{"title":"企业客户管理后台-flow","ext":"web_project","file_path":"/我的项目/企业客户管理后台/flow.html","project_name":"企业客户管理后台","version":"V4"}
```

---

## 4. 固定图片导出项目（小红书卡片等，新增规则）

对于 `fixed-image` 输出目标的场景（如小红书卡片、封面图、长图），典型流程为：

1. **先生成 HTML**（设计阶段产物）→ 按常规保存到 `我的项目/{项目名}/`
2. **后执行 export** 导出图片 → 导出产物保存到 `我的项目/{项目名}/export/`
3. **版本管理：** HTML 和 `export/` 都进 Git 追踪，同一次 commit
4. **send_file 策略（必做）：**
   - **第一次：** 吐出 HTML 文件（`ext: web_project`）
   - **第二次：** 吐出 export 产物
     - 若导出为单张图片：`ext: 具体扩展名`（如 `png`、`jpg`），`file_path: /我的项目/{项目名}/export/xxx.png`
     - 若导出为文件夹（多张图）：`ext: directory`，`file_path: /我的项目/{项目名}/export/`

**关键规则：**
- HTML 和 export 产物**必须在同一个项目目录下**
- 两者**必须在同一个版本（commit）中**
- 禁止 export 产物散落在项目目录外

示例（小红书长图项目，V2）：
```bash
# 项目目录结构
cd 我的项目/小红书旅行攻略
git add .
git commit -m "V2: 优化封面配色与排版"
git tag v2
```

send_file 调用（连续两次）：
```json
{"title":"小红书旅行攻略","ext":"web_project","file_path":"/我的项目/小红书旅行攻略/index.html","project_name":"小红书旅行攻略","version":"V2"}
{"title":"小红书旅行攻略-export","ext":"directory","file_path":"/我的项目/小红书旅行攻略/export/"}
```
