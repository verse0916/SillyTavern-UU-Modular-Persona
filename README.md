# UU Modular Persona for SillyTavern

把一个 SillyTavern Persona 拆成可独立开关、排序和组合的模块。每个原生 Persona 自动对应一套 UU 数据；插件只在生成 prompt 时追加当前启用的内容，不改写原生 Persona description。

## 功能

- 原生 Persona 与 UU 数据 1:1 自动绑定
- 根级模块和单层分支
- 模块开关、分支总开关、复制、删除、折叠
- 根目录与分支之间拖拽移动，支持跨分支排序
- 使用 SillyTavern 当前主 API 和模型，把 Persona 自动拆成普通模块
- 内置“通用详细”“角色扮演”“极细分”模板，也支持自定义模块边界
- AI 结果先预览，再选择追加或替换；生成异常不会改动现有数据
- 实时显示最终注入文本
- 全量 JSON 导入和导出
- 可自定义模块分隔符
- 数据保存在 SillyTavern `extension_settings` 中，无额外后端

## 安装

在 SillyTavern 的扩展管理器中选择“安装扩展”，粘贴：

```text
https://github.com/verse0916/SillyTavern-UU-Modular-Persona
```

安装后刷新 SillyTavern，打开 Persona 管理面板，即可看到“UU 模块化管理”。

## 使用

1. 先用 SillyTavern 原生 Persona 列表选择一个 Persona。
2. 添加根级模块，或添加分支后在分支内添加模块。
3. 用每行左侧开关控制单个模块；关闭分支总开关会同时停止注入该分支内的全部模块，但保留子模块各自的开关状态。
4. 拖动左侧手柄改变顺序或归属。预览框的顺序就是最终注入顺序。
5. 修改后会自动保存；“应用当前配置”用于明确确认当前状态，下一次生成会直接使用它。

分隔符输入框支持直接输入文本，也支持用 `\\n` 表示换行。默认值是两个换行。

## AI 自动分模块

先在 SillyTavern 中选择 Persona，然后点击“✨ AI 自动分模块”。默认会读取当前原生 Persona description；也可以改为手动粘贴另一份文本，并把拆分结果应用到当前 Persona。

1. 选择输入来源、模块模板和清洗程度。
2. 普通模式直接使用内置模板；高级自定义模式可以逐行填写模块名，也可以用“模块名称 / 模块用途 / 包含内容 / 不包含内容”描述边界。
3. 需要保留特殊措辞时，可以在补充 Prompt 中写明要求。
4. 点击“开始分模块”，检查每个模块的名称和正文。
5. 选择“追加到当前模块”或“替换当前模块”，再点击应用。替换会先要求确认；取消确认不会修改原数据。

AI 请求直接调用 SillyTavern 提供给扩展的 raw generation 能力，使用当前主 API、当前模型和现有连接配置，不需要单独填写 API Base、API Key 或模型名。它是一次独立生成，不会向当前聊天添加用户消息或 AI 消息。插件会优先请求结构化输出；当前后端不支持时，会自动改用严格的纯文本标记格式解析。

生成结果只会落成根级普通模块，不会自动创建或修改分支。应用后仍可用原有拖拽功能把模块移入需要的分支。如果生成期间或预览后切换了 Persona，插件会拒绝应用这份旧结果，避免写错 Persona。

## 数据备份

“导出 JSON”会导出插件内全部 Persona 的 UU 数据；导入会用文件里的数据覆盖插件当前全部 UU 数据。导入不会修改 SillyTavern 原生 Persona description。

## Prompt 注入方式

插件在 `GENERATION_AFTER_COMMANDS` 阶段临时把模块拼接结果追加到当前 Persona description，生成结束、中止、切换聊天或安全超时后立即恢复原值。这个过程只修改运行时字段，不调用设置保存，也不污染原生 description。

## 开发与测试

```bash
npm test
```

核心拼接和 AI 结果处理均有纯函数测试。测试覆盖根模块关闭、分支总开关、分支内模块开关、顺序、空内容、模板边界解析、结构化输出、纯文本 fallback、异常结果拒绝，以及追加 / 替换时对已有分支的保护。

## 兼容性

目标版本为 SillyTavern 1.16+。在 1.17+ 中插件还会使用新增的 `PERSONA_CHANGED` 事件即时刷新；1.16 会通过 Persona 卡片点击和聊天切换刷新。拖拽依赖 SillyTavern 自带的 jQuery UI Sortable；如果运行环境未提供 Sortable，其他编辑与注入能力仍可使用，界面会显示提示。

## License

MIT
