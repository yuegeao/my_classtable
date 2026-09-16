<p align="center">
  <img src="课表/minimal-timetable/icons/icon-512.png" width="96" alt="极简课表图标">
</p>

<h1 align="center">极简课表 · Minimal Timetable</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.31-blue" alt="version">
  <img src="https://img.shields.io/badge/platform-Android%20%7C%20Web-PWA-green" alt="platform">
  <img src="https://img.shields.io/badge/license-未声明-orange" alt="license">
</p>

<p align="center">打开即见课表的极简课程表应用 · 零依赖 · 本地优先 · 完全离线</p>

---

## 这是什么 / What is this

**极简课表**是一款拒绝功能臃肿、追求极速启动的课程表应用。它的核心信条只有一句话：**打开就看到你的课表**，不弹广告、不加载重型库、不做多余动画。

它有两个同源形态，共用同一套网页代码：

- **网页版（PWA）**：纯静态 `index.html` + `style.css` + `app.js`，双击即用，也可「添加到主屏幕」像 App 一样离线运行。
- **安卓 App（APK）**：通过 Capacitor 把网页打包成原生安卓安装包，全部资源内置，**完全离线可用**。

> 适合学生、考研党、备考族管理每周课表，也适合用「倒数日」追踪考试 /  deadline。

---

## ✨ 功能特性

- **四页结构**：`今日` · `课表` · `倒数日` · `设置`，底部 Tab 切换，默认落在「今日」。
- **极速启动**：无开屏、无广告、无框架；首屏仅渲染必要 DOM，毫秒级出图。
- **一周七列课表**：周一~周日横向网格，表头与节次列冻结、仅上下滚动；当日整列高亮；连堂课程自动识别并以虚线角标区分。
- **下一节课实时倒计时**：「今日」页每秒刷新（上课中显示「距下课」，未上课显示「距上课」），无课显示结束语。
- **倒数日**：精确到分钟；默认按时间排序，长按拖动可手动换位；剩余天数低于预警值整卡标红。
- **课表导入**：支持 `.xlsx` / `.csv` / `.xls`（含教务系统导出格式），网格表与列表表自动识别，导入前**逐条预览校对**（冲突检测、追加 / 覆盖）。
- **主题系统**：6 套极简主题（靛蓝 / 薄荷 / 紫罗兰 / 日落 / 蔷薇 / 墨灰）+ 自定义主色调 + 深色模式（浅色 / 深色）。
- **上课提醒**：开启后浏览器通知 + 应用内提示，可设提前分钟数。
- **数据自主**：全部存浏览器 `localStorage`，一键导出 JSON 备份 / 清空；换设备前记得备份。
- **隐私本地化**：数据只在本机，不上传任何服务器。

---

## 📱 下载与安装

### 安卓 APK（最新版 v1.31）

| 方式 | 说明 |
|---|---|
| **GitHub Release（推荐）** | 到仓库 [Releases](https://github.com/watermeloncat472/minimal-timetable/releases) 页下载，链接稳定、可附更新说明 |
| **直链下载** | `https://github.com/watermeloncat472/minimal-timetable/raw/master/%E8%AF%BE%E8%A1%A8/%E6%9E%81%E7%AE%80%E8%AF%BE%E8%A1%A8-v1.31.apk` |

> 安装：把 APK 传到手机（微信 / QQ / 数据线均可）点击安装；若提示「未知来源」，在系统设置中允许安装未知应用即可。当前为 **debug 签名**，仅供个人安装使用，上架应用商店需另行配置 release 签名。

### 网页版 / PWA

无需安装，打开即用：

- 直接双击 `课表/minimal-timetable/index.html`；
- 或部署到任意静态托管（GitHub Pages、Vercel、对象存储等）后浏览器访问；
- 通过 `http/https` 打开后，浏览器菜单「添加到主屏幕」即可全屏离线使用（Service Worker 自动缓存全部资源）。

---

## 🚀 本地运行（网页版）

```bash
# 方式一：直接双击
课表/minimal-timetable/index.html

# 方式二：本地静态服务器
cd 课表/minimal-timetable
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

手机使用：将三个文件（`index.html` / `style.css` / `app.js`）放入手机，或用任意静态托管上传后浏览器打开。

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 **HTML / CSS / JavaScript**（零框架、零构建、零运行时依赖） |
| 存储 | 浏览器 `localStorage` + JSON 导出备份 |
| 离线 | **PWA**（Web App Manifest + Service Worker） |
| 安卓封装 | **Capacitor 7**（包名 `com.minimal.timetable`，`webDir` 指向网页目录） |
| 最低系统 | Android 6.0（API 23） |

---

## 📦 项目结构

```
课表/
├── minimal-timetable/        # 网页端（PWA）源码，纯静态、零构建
│   ├── index.html            # 页面骨架（顶栏 / 四视图 / Tab 栏 / 弹层）
│   ├── style.css            # 极简样式、主题 CSS 变量、网格 / 弹层 / 表单
│   ├── app.js               # 全部逻辑：数据层、渲染、倒计时、提醒、备份
│   ├── excel-import.js      # Excel/CSV/.xls 导入（按需加载，零首屏开销）
│   ├── manifest.webmanifest # PWA 安装清单
│   ├── sw.js                # Service Worker（离线缓存）
│   ├── icons/               # 应用图标（192 / 512 / 掩码 / 苹果）
│   └── README.md            # 详细产品设计文档（信息架构 / 交互 / 数据模型）
├── android-build/           # Capacitor 安卓工程
│   ├── capacitor.config.json
│   ├── android/             # 原生安卓工程（Gradle）
│   └── node_modules/
└── 极简课表-v1.31.apk         # 已构建的可安装 APK（最新版）
```

更完整的交互逻辑、数据模型、性能策略与版本记录，见 [`课表/minimal-timetable/README.md`](课表/minimal-timetable/README.md)。

---

## 🔧 打包为安卓 App（APK）

修改网页代码后重新构建：

```bat
cd 课表\android-build
npx cap sync android          :: 把 minimal-timetable 最新资源同步进安卓工程
cd android
set JAVA_HOME=D:\deepseek--harness\tools\jdk21   :: Capacitor 7 需 Java 21
set ANDROID_HOME=D:\deepseek--harness\tools\android
gradlew.bat assembleDebug --no-daemon
:: 产物：android/app/build/outputs/apk/debug/app-debug.apk
:: 复制并重命名为 课表/极简课表-vX.YY.apk
```

> ⚠️ 工程路径含中文 `课表/`，已在 `android/gradle.properties` 设 `android.overridePathCheck=true` 关闭 AGP 的非 ASCII 路径校验。若迁移到纯英文路径可删掉此行。

---

## 📄 许可 / License

本仓库**未声明开源协议**（保留所有权利）。如需用于学习、二次开发或分发，请先与作者联系。

---

<p align="center">极简课表 · 打开即见课表</p>
