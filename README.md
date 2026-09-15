# ZEEHO 极核 · Quantumult X 任务合集

ZEEHO(极核)App 每日自动签到脚本,以 QX 任务合集(JSON Gallery)的形式发布,
在 Quantumult X 里粘贴一条链接就能按需下载。

> 仅供个人学习与自用,请勿用于商业用途、批量账号或任何违规场景。

---

## 一、合集链接

```
https://raw.githubusercontent.com/MonicaGmm/zeeho-quanx/main/ZEEHO_Task.json
```

把它复制到 Quantumult X 里,就能看到并勾选本合集下的任务(见下一节)。

## 二、在 Quantumult X 里添加

1. 打开 QX → 点右下角**圆盘**图标
2. 往下划,找到「**工具 & 分析**」→「**构造 HTTP 请求**」
3. 点右上角的**图标按钮**(四个方块/列表样式的那个)
4. 点右上角「**+**」→ 把上面的**合集链接**粘进去 → 确定
5. 列表里会出现 `ZEEHO极核签到`,点它左边的「**+**」加进来
6. 回到「构造 HTTP 请求」列表,找到 `ZEEHO极核签到`,**左滑点三角**手动跑一次验证

前提:QX 设置里的「**外部资源**」开关要打开。

## 三、Token 怎么拿

脚本需要你的 H5 签到 token(一个 UUID)。拿法:

1. 在 ZEEHO App 里进一次「签到」页面
2. 抓包(Stream / Charles / QX 自带 MITM),找 `h5.zeehoev.com` 的任意请求
3. 二选一:
   - 看请求 URL:`https://h5.zeehoev.com/activity/signin?token=` **后面那段 UUID**
   - 看请求头 `Authorization: Bearer ` **后面的部分**

然后填进 `task/zeeho_checkin.js` 的 §1 账号区:

```js
const TOKENS = [
  '这里是你的 token',
];
```

多账号用逗号或换行分隔。

**也可以不改脚本**,用 QX 的持久化变量存 token:
在「构造 HTTP 请求」里新建任务,`resource` 填 `ZEEHO_tokens`,值为你的 token。
脚本会按 `BoxJs → QX 变量 → 脚本内` 的优先级读取。

## 四、⚠️ 一定要加的一条分流规则(重要)

签到接口 `h5.zeehoev.com` 是**国内域名**。如果你的 QX 把流量默认走了代理,
请求会从境外出去,轻则超时,重则被风控。

在 QX 配置文件的 `[filter_local]` 段加一行,让它走直连:

```ini
[filter_local]
host-suffix, zeehoev.com, direct
```

## 五、仓库结构

```
.
├── ZEEHO_Task.json            # 合集文件(QX 订阅的就是它)
├── task/
│   └── zeeho_checkin.js       # 签到脚本本体
└── README.md
```

## 六、以后怎么加新任务

在 `ZEEHO_Task.json` 的 `task` 数组里追加字符串即可,一条就是一个任务:

```json
"cron 脚本URL, tag=任务名, img-url=图标URL, enabled=true"
```

- `cron` 支持 5 或 6 位字段(6 位是 `秒 分 时 日 月 周`)
- `tag` / `img-url` / `enabled` 都可选
- 注意整条是一个字符串,各部分用逗号分隔

例子:

```json
"0 9 * * * https://raw.githubusercontent.com/你的用户名/仓库/main/task/xxx.js, tag=XXX签到, enabled=true"
```

改完直接提交,GitHub 上在线编辑就行,不需要本地装 git。

## 七、脚本说明

`task/zeeho_checkin.js` 的实现细节(接口档案、签名算法、踩坑记录)见原项目文档。
核心特点:

- 纯 JS 实现 MD5 与 SHA1,QX 环境零依赖
- 内置 `Cfmoto-X-Sign` 请求签名
- 多账号、失败重试、签到前状态预判、签到后回查确认
- 通知带账号头像(media-url)

## 八、免责声明

本项目仅供学习研究。脚本涉及的应用与本项目无关,使用者需自行承担一切风险。
请勿用于商业用途或违反相关服务条款的场景。
