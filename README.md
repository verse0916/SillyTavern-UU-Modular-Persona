# UU Modular Persona for SillyTavern

把一个 SillyTavern Persona 拆成可独立开关、排序和组合的模块。每个原生 Persona 自动对应一套 UU 数据；插件只在生成 prompt 时追加当前启用的内容，不改写原生 Persona description。

## 功能

- 原生 Persona 与 UU 数据 1:1 自动绑定
- 根级模块和单层分支
- 模块开关、分支总开关、复制、删除、折叠
- 根目录与分支之间拖拽移动，支持跨分支排序
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

## 数据备份

“导出 JSON”会导出插件内全部 Persona 的 UU 数据；导入会用文件里的数据覆盖插件当前全部 UU 数据。导入不会修改 SillyTavern 原生 Persona description。

## Prompt 注入方式

插件在 `GENERATION_AFTER_COMMANDS` 阶段临时把模块拼接结果追加到当前 Persona description，生成结束、中止、切换聊天或安全超时后立即恢复原值。这个过程只修改运行时字段，不调用设置保存，也不污染原生 description。

## 开发与测试

```bash
npm test
```

核心拼接函数是纯函数，测试覆盖根模块关闭、分支总开关、分支内模块开关、顺序与空内容。

## 兼容性

目标版本为 SillyTavern 1.16+。在 1.17+ 中插件还会使用新增的 `PERSONA_CHANGED` 事件即时刷新；1.16 会通过 Persona 卡片点击和聊天切换刷新。拖拽依赖 SillyTavern 自带的 jQuery UI Sortable；如果运行环境未提供 Sortable，其他编辑与注入能力仍可使用，界面会显示提示。

## License

MIT
