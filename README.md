# 猜数字

两个人轮流猜一个数。服务器只告诉你有几位位置是对的。

## 本地

```bash
npm install
npm test
npm run dev
```

不设置 `DATABASE_URL` 时，房间只活在这一个开发进程里，刷新页面还在，重启就没了。

## 部署到 Vercel

1. 把这个目录导入 Vercel。
2. 在 Vercel 的 Storage 里接上 Neon，它会写入 `DATABASE_URL`。
3. 部署。第一次有人进房间时，服务会自己执行根目录的 `schema.sql`。
4. 也可以在本地把生产库的连接串放进 `.env.local`，然后运行 `npm run migrate`。

用手机打开站点，点开房，把链接发给对方。匹配会把选择了相同位数的两个人放进同一间。

## 字

`public/fonts/cabinet-pixel.woff2` 裁自 Fusion Pixel 12px（TakWolf，OFL-1.1），只嵌入本游戏。许可证在 `public/fonts/OFL.txt`。
