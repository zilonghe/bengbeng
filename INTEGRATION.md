# 平台接入

当前版本可在 GitHub Pages 运行。未配置平台时，排行榜仅记录本机成绩；广告、支付不产生真实请求或收入。当前优先交付游戏内容，微信小游戏 SDK 的接入留在这个边界。

## 本地测试

用 `?preview=1` 显式进入测试模式。测试广告必须在测试弹窗中主动完成；关闭、失败和超时均不发奖励。测试补给不会扣费，收据带 `preview-` 前缀。测试存档与正常存档隔离，测试成绩不得提交云端。

```sh
node services.test.js
```

## 广告

在 `main.js` 前注入 `window.BengbengPlatform`，实现以下接口。`showRewarded` 的 placement 为 `revive`、`reroll` 或 `daily_coins`；`signal` 在超时后取消。只有平台 SDK 明确报告完整播放时，才能返回 `completed:true`。关闭事件不等于播放完成。

```js
window.BengbengPlatform = {
  async showRewarded(placement, { signal }) {
    // 对接平台 SDK。完成时返回唯一收据；无填充/取消时返回 false。
    return { completed: false };
    // 成功形状：{ completed: true, receiptId: 'server-unique-reward-id' }
  },
};
```

收据 ID 仅允许字母、数字、下划线和连字符，长度 1–100，需由服务端把平台凭证映射为该格式。同一时刻只允许一个广告或支付操作；45 秒超时，迟到回调不发奖励；同一会话的重复广告收据被拒绝。生产环境需要服务端奖励回调校验与持久去重，本地集合无法阻止跨设备重放。

## 支付

只有同时实现 `getProducts`、`purchase`、`verifyPurchase` 才开放真实支付。展示价格必须来自平台商品信息，不能在前端编造金额。商品 ID 与币数固定：

| 商品 ID | 内容 |
| --- | --- |
| `supplies_600` | 600 金币 |
| `supplies_1800` | 1800 金币 |

```js
Object.assign(window.BengbengPlatform, {
  async getProducts() {
    // 从平台读取已配置商品的本地化价格。
    return [{ id: 'supplies_600', displayPrice: '平台返回的价格' }];
  },
  async purchase(productId, { signal }) {
    // 调用 SDK，返回交易凭证；取消返回 {cancelled:true}。
    throw new Error('接入平台支付 SDK 后实现');
  },
  async verifyPurchase({ productId, purchase }, { signal }) {
    // 发给可信服务端；由服务端向支付平台校验、去重并发货。
    // 不得在浏览器内直接返回 verified:true。
    throw new Error('接入服务端验单后实现');
    // 成功形状：{
    //   verified:true, productId, receiptId:'server-order-id',
    //   entitlements:{coins:600}
    // }
  },
});
```

`BBServices.purchase()` 只有验单结果包含正确商品、唯一收据及对应币数时，才返回 `{ok:true,verified:true,productId,receiptId,coins,entitlements,preview:false}`。调用端还必须通过 `BBMeta.fulfill` 的持久收据去重，再保存存档。

这是一层接入契约，不是支付服务。当前金币、招募和存档均在浏览器，用户可以修改；上线真实付费前必须把账户身份、余额、抽卡随机与保底、订单及发货迁到可信服务端，并提供订单查询/补发。网络超时可能代表订单状态未知，不能通过重新生成订单替代查询原订单。

## 云排行榜

同时实现 `listLeaderboard(mode)` 与 `submitScore(entry)` 后才开放云榜。mode 为 `pure`（未携开局卡、未重抽、未复活）或 `assisted`（使用任一辅助）。免费重抽也属于辅助。测试模式始终关闭云榜。

```js
Object.assign(window.BengbengPlatform, {
  async listLeaderboard(mode) {
    return { entries: [] }; // 读取服务端榜单
  },
  async submitScore(entry) {
    // 服务端验证账号、局次、关卡、用时及成绩后再接收。
    return { accepted: false };
  },
});
```

成绩形状为 `{runId,name,stage,kills,level,assisted,createdAt}`：`stage` 0–60，`name` 不超过 20 字，`createdAt` 为毫秒时间戳。显示昵称时使用 `textContent`。适配器会过滤非法字段、按通关数/击杀数/等级排序，但无法证明客户端上报成绩真实；没有服务端校验的榜单不能用于竞技奖励。

## 接口返回

服务实例由 `BBServices.create({provider,preview,previewRewarded,previewPurchase,timeoutMs})` 创建。`rewardAvailable`、`paymentAvailable`、`cloudAvailable` 决定入口是否可用。

所有异步方法返回 `{ok,...}`。调用端只有在 `ok:true` 时应用奖励；`showRewarded` 还必须检查 `completed:true`。常见错误为 `busy`、`timeout`、`cancelled`、`ads_unavailable`、`ad_incomplete`、`payments_unavailable`、`unverified_purchase`、`duplicate_receipt`、`cloud_unavailable`。未接入服务时使用本地玩法及本机榜单，不能生成虚构玩家或成功交易。
