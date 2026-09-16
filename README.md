# ZEEHO 极核 · Quantumult X 任务合集

ZEEHO(极核)App 的 Quantumult X 自动化脚本合集,包含两个任务:

| 任务 | 作用 |
|---|---|
| **ZEEHO极核·获取TOKENS** | 自动从 App 流量里抓取 TOKEN,不用抓包、不用手动复制 |
| **ZEEHO极核签到** | 每天定时自动签到,推送通知 |

> 仅供个人学习与自用,请勿用于商业用途、批量账号或任何违规场景。

---

## 一、合集链接

```
https://raw.githubusercontent.com/MonicaGmm/zeeho-quanx/main/ZEEHO_Task.json
```

## 二、在 Quantumult X 里添加

1. 打开 QX → 点右下角**圆盘**图标
2. 往下划,找到「**工具 & 分析**」→「**构造 HTTP 请求**」
3. 点右上角的**图标按钮**(四个方块/列表样式的那个)
4. 点右上角「**+**」→ 把上面的**合集链接**粘进去 → 确定
5. 列表里会出现两个任务,点各自左边的「**+**」加进来

**前提**:设置里的「**外部资源**」开关、「**重写**」开关、「**MitM**」开关都要打开,
并且已安装并信任 MitM 根证书。

> 加第一个任务时,QX 会通过 `addons` 自动把一条重写规则和主机名
> (`h5.zeehoev.com`)一并导入 —— 这是抓 TOKEN 用的,不需要手动配置。

## 三、使用流程

### 第 1 步:获取 TOKEN(只需做一次)

1. 确认 QX 的「重写」「MitM」开关是打开的
2. 打开 **ZEEHO App**,进到「**我的**」或「**签到**」页面
3. 几秒内会收到通知:
   ```
   ZEEHO 极核
   获取 TOKENS 成功
   来源：请求头
   TOKEN：3f9a1c82…7b0d
   已保存，签到脚本会自动读取，无需手动填写。
   ```

如果没有弹通知,可以到「构造 HTTP 请求」列表里找到
`ZEEHO极核·获取TOKENS`,**左滑点三角**手动运行一次看看状态。

### 第 2 步:签到

TOKEN 存好之后,`ZEEHO极核签到` 会在**每天 08:30** 自动运行(QX 需在后台)。
也可以随时手动跑:在列表里找到它,**左滑点三角**。

## 四、TOKEN 存在哪

抓到的 TOKEN 存在 QX 的持久化变量 **`ZEEHO_tokens`** 里,
签到脚本会按 `BoxJs → QX 变量 → 脚本内` 的优先级自动读取。

**所以公开仓库里永远不含你的 TOKEN** —— 这也是本项目不把 TOKEN 写进脚本的原因。

多账号:手动把多个 TOKEN 用逗号或换行拼起来写进 `ZEEHO_tokens` 即可。
想换账号:用新账号打开一次 App,会自动覆盖。

查看当前存的值:QX → 圆盘 → 「工具 & 分析」→「构造 HTTP 请求」→
找到 `ZEEHO极核·获取TOKENS` 手动运行,通知里会显示打码后的 TOKEN。

## 五、⚠️ 关于分流(如果签到失败再看这条)

签到接口 `h5.zeehoev.com` 是**国内域名**。如果你的 QX 默认把流量走代理,
请求会从境外出去,轻则超时,重则被风控。

**多数配置本来就带中国域名直连规则,所以通常不用管。**
如果签到脚本通知里出现了这样的提示:

```
⚠️ 连不上 h5.zeehoev.com。
多半是这个国内域名被 QX 丢给代理了。
在 QX 配置文件的 [filter_local] 段加一行：
host-suffix, zeehoev.com, direct
```

照着加一行即可。分流决策发生在 QX 的网络层,脚本无法自己指定走哪条策略,
所以只能这么处理。

## 六、仓库结构

```
.
├── ZEEHO_Task.json               # 合集文件(QX 订阅的就是它)
├── task/
│   ├── zeeho_token.js            # 抓 TOKEN / 查看状态(一文件两用)
│   └── zeeho_checkin.js          # 签到脚本
├── rewrite/
│   └── ZEEHO_Rewrite.snippet     # 抓 TOKEN 的重写规则 + 主机名
└── README.md
```

## 七、以后怎么加新任务

在 `ZEEHO_Task.json` 的 `task` 数组里追加即可,支持两种写法:

**写法一:纯字符串(最简单)**

```json
"30 8 * * * https://raw.githubusercontent.com/你的用户名/仓库/main/task/xxx.js, tag=XXX签到, enabled=true"
```

**写法二:对象(需要额外挂重写 / 分流规则时)**

```json
{
  "config": "30 8 * * * https://raw.githubusercontent.com/你的用户名/仓库/main/task/xxx.js, tag=XXX签到, enabled=true",
  "addons": "https://raw.githubusercontent.com/你的用户名/仓库/main/rewrite/XXX.snippet"
}
```

- `cron` 支持 5 或 6 位字段(6 位是 `秒 分 时 日 月 周`)
- `tag` / `img-url` / `enabled` 都可选
- `addons` 指向一个纯文本片段,首行可选 `hostname = a.com, b.com`,
  后面每行一条重写规则,导入任务时会一并生效

改完直接提交,GitHub 上在线编辑就行,不需要本地装 git。

## 八、脚本说明

**`task/zeeho_checkin.js`**

- 纯 JS 实现 MD5 与 SHA1,QX 环境零依赖
- 内置 `Cfmoto-X-Sign` 请求签名
- 多账号、失败重试、签到前状态预判、签到后回查确认
- 通知带账号头像(media-url)
- 通知里附带:连续签到天数、今日获得积分、本月已签天数
- 网络层失败时会直接在通知里给出分流解法

> **关于「可用积分余额」**:H5 的全部 22 个接口里**没有**返回账户积分余额的接口。
> 签到接口返回的 `integralScore` 是**当天签到获得**的积分(前端源码里的提示语是
> `恭喜获得${n}积分`),不是余额。账户余额由原生 App 自己的接口提供,
> 用这里的 H5 token 取不到。通知里显示的因此是「今日 +N 积分」。

**`task/zeeho_token.js`**

- 同一个文件两种模式:被重写调用时抓 TOKEN,被定时任务调用时报告状态
- TOKEN 会打码显示,避免通知栏泄露完整凭据
- 值发生变化时才通知,不会反复弹

## 九、免责声明

本项目仅供学习研究。脚本涉及的应用与本项目无关,使用者需自行承担一切风险。
请勿用于商业用途或违反相关服务条款的场景。
