# Sailer 2D

一个可直接在浏览器里玩的 2D 帆船训练模拟器，基于 `Vite + TypeScript + PixiJS`。

## 玩法

- `A / D` 转舵
- `↑ / ↓` 调整主帆收放
- `← / →` 调整压舷
- `W / S` 调整稳向板
- 鼠标滚轮或右侧缩放条缩放视角
- 左侧栏查看并调整风/水系统
- 右侧栏查看船只状态、受力叠加和地图
- 左右侧栏都支持收起，方便腾出更多操作视野

## 本地运行

```bash
npm install
npm run dev
```

如果要在局域网里给别人一起打开：

```bash
npm run dev:host
```

## 测试与构建

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

## 项目亮点

- 左侧栏专注环境系统：真实风、视风、水流、侧滑
- 右侧栏专注船系统：航向、船速、横倾、操控状态、受力叠加、地图
- HUD 支持收放，主视野会自动避让，不再被面板硬压住
- 风流和水流粒子使用批量绘制，航迹使用对象池，运行更稳
- 纯函数物理 step 已拆分，便于继续添加阵风、波浪、失速等现实因素

## 发布到 GitHub Pages

仓库已包含 `vite.config.ts` 和 Pages 工作流。推送到 GitHub 后：

1. 在仓库设置里启用 GitHub Pages，并选择 `GitHub Actions`
2. 推送到默认分支
3. Actions 完成后即可通过 Pages 地址在线游玩

## 后续适合继续扩展的现实因素

- 阵风与风摆
- 波浪和拍浪阻力
- 帆失速与重新充气
- 大舵角减速与舵效衰减
- tack / gybe 过程中的速度损失和惯性
