# meta.json 结构规范（meta-json-spec）

> 本文件由 SKILL.md §5 计量分层（패턴 D）拆出；正文只保留核心字段速记，完整示例与逐字段说明以本文件为准。
> 适用时机：创建或更新 meta.json 前必读。

每个项目一份，记录项目整体状态。通过 `.gitignore` 排除，不进入版本历史。

```json
{
  "project_name": "北京旅游网站",
  "latest_version": "v3",
  "is_published": false,
  "published_version": null,
  "domain": null,
  "versions": [
    {
      "id": "v1",
      "timestamp": "2026-05-01T14:30:00+08:00",
      "based_on": null,
      "summary": "首页 + 景点列表"
    },
    {
      "id": "v2",
      "timestamp": "2026-05-05T10:30:00+08:00",
      "based_on": null,
      "summary": "风格变更为国际主义"
    },
    {
      "id": "v3",
      "timestamp": "2026-05-06T14:30:00+08:00",
      "based_on": "v1",
      "summary": "基于 V1：重新设计页面布局"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| project_name | string | 项目名称，Agent 自动生成，用户可修改 |
| latest_version | string | 当前最新版本号（如 "v5"） |
| is_published / published_version / domain | 一期默认 false / null |
| versions[].id | string | 版本号（如 "v1"） |
| versions[].timestamp | string | 创建时间（ISO 8601 带时区） |
| versions[].based_on | string \| null | 仅在恢复或基于历史版本编辑时有值，指向基准版本号；普通编辑时为 null |
| versions[].summary | string | Agent 自动生成的一句话变更摘要 |
