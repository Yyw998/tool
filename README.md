# 入职资料收集工具

版本：1.1.0（GitHub Pages 静态版）

这是一个纯前端静态工具，使用 `HTML + Vue 3 + Element Plus` 实现，包含资料填写页 `index.html` 和配置管理页 `config.html`，可直接部署到 GitHub Pages。

## 1. 功能说明

- 资料填写页和配置管理页分离；
- 可配置基础字段、附件资料项、模板下载地址、示例图片地址、命名规则、邮件文案；
- 用户资料仅在浏览器本地处理，不上传服务器；
- 支持附件本地校验；
- 支持按规则重命名文件；
- 支持生成加密 ZIP；
- 支持下载 ZIP；
- 支持复制邮件标题、正文、收件邮箱；
- 支持打开本地邮件客户端，但需要用户手动添加 ZIP 附件。

## 2. 技术栈

- HTML
- Vue 3 CDN
- Element Plus CDN
- zip.js CDN
- GitHub Pages

## 3. 目录结构

```text
entry-material-collector/
├── index.html              # 资料填写页
├── config.html             # 配置管理页
├── README.md
├── assets/
│   ├── templates/
│   │   ├── 中粮贸易招聘简历模板.docx
│   │   └── 粮达网新员工信息登记表.docx
│   └── examples/
│       ├── 中粮贸易招聘简历模板示例.png
│       └── 粮达网新员工信息登记表示例.png
├── css/
│   └── style.css
└── js/
    ├── config.js
    └── app.js
```

## 4. 本地使用

直接双击 `index.html` 即可打开。

如果浏览器限制本地文件访问，可使用任意静态服务器打开，例如：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/
```

## 5. GitHub Pages 部署

1. 新建 GitHub 仓库；
2. 上传本工程全部文件；
3. 进入仓库 `Settings`；
4. 进入 `Pages`；
5. Source 选择 `Deploy from a branch`；
6. Branch 选择 `main`，目录选择 `/root`；
7. 保存后等待部署完成；
8. 访问 GitHub Pages 地址。

访问地址通常类似：

```text
https://你的GitHub用户名.github.io/仓库名/
```

## 6. 页面说明

页面分为两个独立入口：

- `index.html`：资料填写页，给用户上传资料、查看示例、生成 ZIP 使用；
- `config.html`：配置管理页，用于维护表单字段、附件项、模板下载地址、示例图片地址、命名规则和邮件信息。

## 7. 配置说明

### 发布配置给候选人

配置页的“保存草稿”只保存到 HR 当前浏览器，适合反复编辑；不会影响候选人页面。

需要发布时：

1. 在配置页点击“导出发布配置”，下载得到 `config.json`；
2. 在静态托管平台中上传或替换站点根目录的 `config.json`；
3. 候选人刷新资料收集页面后，会自动读取这份最新配置。

候选人不需要导入 JSON。若站点中不存在 `config.json`，页面会回退使用 `js/config.js` 的默认配置，便于本地预览。

配置默认保存在当前浏览器 `localStorage` 中。

### 7.1 导出配置

在配置管理页点击 `导出 JSON`，可下载当前配置。

### 7.2 导入配置

在配置管理页点击 `导入 JSON`，选择之前导出的配置文件。

### 7.3 修改默认配置

如果希望所有访问者打开页面时默认使用你的配置，需要修改：

```text
js/config.js
```

把 `window.DEFAULT_APP_CONFIG` 替换为导出的配置内容。

注意：`localStorage` 只对当前浏览器生效，不会同步给其他用户。

## 8. 模板文件和示例图片替换

当前 `assets/templates` 下的模板文件是示例模板，`assets/examples` 下的图片是示例预览图。正式使用时，请替换为真实模板和真实示例图片，并确保 `js/config.js` 或配置管理页中的地址正确。

示例模板地址：

```text
assets/templates/中粮贸易招聘简历模板.docx
assets/templates/粮达网新员工信息登记表.docx
```

示例图片地址：

```text
assets/examples/中粮贸易招聘简历模板示例.png
assets/examples/粮达网新员工信息登记表示例.png
```

配置字段为：

```text
templateUrl       # 模板下载地址
exampleImageUrl   # 示例图片地址
```

## 9. ZIP 加密说明

本工具使用 zip.js 在浏览器本地生成加密 ZIP。

使用要求：

1. 生成资料包前必须输入 ZIP 密码；
2. 页面不会保存该密码；
3. ZIP 密码不要和资料包放在同一封邮件里；
4. 生成后请用 Windows / macOS 常用解压工具验证能否正常解压。

## 10. 邮件发送说明

纯静态网页不能安全地自动发送邮件，也不能自动把 ZIP 附加到邮件客户端。

当前版本只提供：

- 下载 ZIP；
- 复制收件邮箱；
- 复制邮件标题；
- 复制邮件正文；
- 打开邮件客户端。

用户需要手动把 ZIP 添加为邮件附件后发送。

## 11. 注意事项

- 页面刷新后，已选择的附件会丢失；
- 不要把 SMTP 密码、邮箱授权码、接口密钥写入前端代码；
- 如果 GitHub 仓库是公开的，模板文件和配置内容也是公开的；
- 资料文件只在用户浏览器本地处理，不会上传到 GitHub。


## 常见问题

### 1. 打开页面出现 Vue compiler-30 错误

旧版本中部分 Element Plus 组件使用了自闭合写法，例如 `<el-input />`。在直接写在 `index.html` 的浏览器模板中，HTML 解析器会把这类自定义标签解析异常，导致 Vue 报 `compiler-30`。当前版本已改为显式闭合写法，例如 `<el-input></el-input>`。

### 2. 不建议直接双击 index.html 运行

虽然大部分静态内容可以直接打开，但 `file://` 协议会受到浏览器安全策略限制，可能出现 `Unsafe attempt to load URL file://...` 一类提示。

推荐本地测试方式：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/
```

正式使用时建议部署到 GitHub Pages。
