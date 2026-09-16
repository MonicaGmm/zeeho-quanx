/*!
 * ============================================================================
 *  ZEEHO 极核 · 每日自动签到
 *  ---------------------------------------------------------------------------
 *  运行环境 : Quantumult X  →  [task_local] 定时任务
 *  接口     : https://h5.zeehoev.com/cfmotoservermine/*
 *  鉴权     : Authorization: Bearer <token>   (H5 端 token，UUID 格式)
 *  签名     : Cfmoto-X-Sign = md5( sha1(v) )
 *             v = 查询串 + 请求体 + "appId=Sw5F9uJi&nonce=<uuid>&timestamp=<ms>" + appSecret
 *
 *  接口来源 : 用户 HAR 抓包 (2026-09-15)，签名算法从 H5 前端 JS 反推并 8/8 验证通过
 *
 *  免责声明 : 仅供个人学习与自用，请勿用于商业用途、批量账号或任何违规场景。
 * ============================================================================
 */

/* ==========================================================================
 * §1  账号区   ← 只需要改这里
 * ========================================================================== */

/* Token = H5 签到页 URL 里 ?token= 后面那一段（也是请求头 Authorization: Bearer 后面的值）
 * 抓法：抓包 https://h5.zeehoev.com/activity/signin?token=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * 多个账号用逗号或换行分隔 */
const TOKENS = [
  // 把你的 token 填在这里，例如：'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
];

/* ==========================================================================
 * §2  固定参数（一般不用改；接口升级后重新抓包替换）
 * ========================================================================== */
const CFG = {
  HOST: 'https://h5.zeehoev.com',
  APP_ID: 'Sw5F9uJi',
  APP_SECRET: '46870a8f678a09109468f5b0168818b91c292845',

  /* 设备指纹：删掉 deviceId 那段也行，服务端目前不校验 */
  ZEEHO_UA: 'MOBILE|iOS|18.7|ZEEHO_APP|3.0.4|iPhone|iPhone 17 Pro|402*874|{DEVICE_ID}|unknown|iOS',
  UA: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 zeeho/3.0.4  (iPhone 17 Pro Build/27.0)iPhone',
};

/* 调试模式：打印完整请求与响应。排查问题时改成 true 即可 */
const DEBUG = false;

/* 通知里是否附带账号头像。
 * 说明：通知左侧的 App 图标是改不了的 —— iOS 只允许显示发通知的 App 自身的图标，
 * 也就是 Quantumult X 的图标。media-url 只能把图片作为「通知附件」带上，
 * 长按（或下拉展开）通知时可见。想关掉就改成 false。 */
const NOTIFY_AVATAR = true;

/* 单账号失败重试次数 */
const RETRY = 2;

/* 成功返回码（接口里 code 是字符串 "10000"） */
const OK_CODES = ['10000', '0', '200'];

/* ==========================================================================
 *  以下为逻辑实现，不需要修改
 * ========================================================================== */

const APP_NAME = 'ZEEHO';

/* ------------------------------ 编码 / 哈希 ------------------------------ */
function utf8Bytes(input) {
  var bytes = [];
  for (var i = 0; i < input.length; i++) {
    var c = input.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c < 0xdc00 && i + 1 < input.length) {
      var cp = 0x10000 + (((c & 0x3ff) << 10) | (input.charCodeAt(++i) & 0x3ff));
      bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

/* MD5 —— 小端序输出 */
function md5(input) {
  var bytes = utf8Bytes(input);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var lo = bitLen >>> 0, hi = Math.floor(bitLen / 4294967296);
  for (var j = 0; j < 4; j++) bytes.push((lo >>> (8 * j)) & 0xff);
  for (var k = 0; k < 4; k++) bytes.push((hi >>> (8 * k)) & 0xff);

  var S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  var K = [];
  for (var n = 0; n < 64; n++) K[n] = Math.floor(Math.abs(Math.sin(n + 1)) * 4294967296);

  function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
  function hexLE(x) {
    var s = '';
    for (var p = 0; p < 4; p++) s += ('0' + ((x >>> (8 * p)) & 0xff).toString(16)).slice(-2);
    return s;
  }

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var off = 0; off < bytes.length; off += 64) {
    var M = [];
    for (var m = 0; m < 16; m++) {
      M[m] = bytes[off + m * 4] | (bytes[off + m * 4 + 1] << 8) |
             (bytes[off + m * 4 + 2] << 16) | (bytes[off + m * 4 + 3] << 24);
    }
    var A = a0, B = b0, C = c0, D = d0;
    for (var t = 0; t < 64; t++) {
      var F, g;
      if (t < 16) { F = (B & C) | (~B & D); g = t; }
      else if (t < 32) { F = (D & B) | (~D & C); g = (5 * t + 1) % 16; }
      else if (t < 48) { F = B ^ C ^ D; g = (3 * t + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * t) % 16; }
      F = (F + A + K[t] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, S[t])) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return hexLE(a0) + hexLE(b0) + hexLE(c0) + hexLE(d0);
}

/* SHA1 —— 大端序输出 */
function sha1(input) {
  var bytes = utf8Bytes(input);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
  for (var i = 3; i >= 0; i--) bytes.push((hi >>> (8 * i)) & 0xff);
  for (var i2 = 3; i2 >= 0; i2--) bytes.push((lo >>> (8 * i2)) & 0xff);

  function hexBE(x) {
    var s = '';
    for (var p = 3; p >= 0; p--) s += ('0' + ((x >>> (8 * p)) & 0xff).toString(16)).slice(-2);
    return s;
  }

  var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  var w = new Array(80);
  for (var off = 0; off < bytes.length; off += 64) {
    for (var t = 0; t < 16; t++) {
      w[t] = (bytes[off + t * 4] << 24) | (bytes[off + t * 4 + 1] << 16) |
             (bytes[off + t * 4 + 2] << 8) | bytes[off + t * 4 + 3];
    }
    for (var t2 = 16; t2 < 80; t2++) {
      var v = w[t2 - 3] ^ w[t2 - 8] ^ w[t2 - 14] ^ w[t2 - 16];
      w[t2] = (v << 1) | (v >>> 31);
    }
    var a = h0, b = h1, c = h2, d = h3, e = h4;
    for (var t3 = 0; t3 < 80; t3++) {
      var f, kk;
      if (t3 < 20) { f = (b & c) | (~b & d); kk = 0x5a827999; }
      else if (t3 < 40) { f = b ^ c ^ d; kk = 0x6ed9eba1; }
      else if (t3 < 60) { f = (b & c) | (b & d) | (c & d); kk = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; kk = 0xca62c1d6; }
      var tmp = ((((a << 5) | (a >>> 27)) + f + e + kk + w[t3]) | 0);
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return hexBE(h0) + hexBE(h1) + hexBE(h2) + hexBE(h3) + hexBE(h4);
}

/* ------------------------------ 小工具 ------------------------------ */
function log(msg) { console.log('[ZEEHO] ' + msg); }

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

/* 只保留非空参数，按后端规则拼串（encode:false） */
function stringifyQuery(params) {
  if (!params) return '';
  var keys = Object.keys(params).filter(function (k) {
    return params[k] !== undefined && params[k] !== null;
  });
  if (!keys.length) return '';
  return keys.map(function (k) { return k + '=' + params[k]; }).join('&');
}

function todayStr() {
  var d = new Date();
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function monthStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1);
}

function pick(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce(function (o, k) {
    return (o === null || o === undefined) ? undefined : o[k];
  }, obj);
}

function readStore(key) {
  try { return $prefs.valueForKey(key); } catch (e) { return null; }
}

/* BoxJs → QX 变量 → 硬编码 */
function loadTokens() {
  try {
    var raw = readStore('chavy_boxjs_userCfgs');
    if (raw) {
      var box = JSON.parse(raw);
      var node = box && box.data && box.data[APP_NAME];
      if (node && node.tokens) {
        var list = Array.isArray(node.tokens) ? node.tokens : String(node.tokens).split(/[\n,]+/);
        list = list.map(function (s) { return String(s).trim(); }).filter(Boolean);
        if (list.length) { log('账号来源: BoxJs (' + list.length + ' 个)'); return list; }
      }
    }
  } catch (e) { log('BoxJs 读取失败: ' + e.message); }

  try {
    var plain = readStore(APP_NAME + '_tokens');
    if (plain) {
      var arr = String(plain).split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (arr.length) { log('账号来源: QX 变量 (' + arr.length + ' 个)'); return arr; }
    }
  } catch (e) {}

  var hard = TOKENS.map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (hard.length) log('账号来源: 脚本内硬编码 (' + hard.length + ' 个)');
  return hard;
}

/* ------------------------------ 请求层 ------------------------------ */
/* 完全复刻 H5 拦截器 79795 的签名逻辑 */
function buildHeaders(token, queryStr, bodyStr) {
  var nonce = uuidv4();
  var ts = String(Date.now());
  var v = queryStr + bodyStr + 'appId=' + CFG.APP_ID + '&nonce=' + nonce + '&timestamp=' + ts + CFG.APP_SECRET;
  return {
    'Content-Type': 'application/json;charset=UTF-8',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Origin': CFG.HOST,
    'Referer': CFG.HOST + '/activity/signin',
    'User-Agent': CFG.UA,
    'Zeeho-User-Agent': CFG.ZEEHO_UA.replace('{DEVICE_ID}', uuidv4().toUpperCase()),
    'Authorization': 'Bearer ' + token,
    'Cfmoto-X-Sign': md5(sha1(v)),
    'Cfmoto-X-Sign-Type': '0',
    'Cfmoto-X-Param': 'appId=' + CFG.APP_ID + '&nonce=' + nonce + '&timestamp=' + ts,
  };
}

function api(path, method, token, query, bodyObj) {
  var queryStr = stringifyQuery(query);
  var bodyStr = (bodyObj === undefined || bodyObj === null) ? '' :
                (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj));
  var url = CFG.HOST + path + (queryStr ? '?' + queryStr : '');

  var opt = {
    url: url,
    method: method,
    headers: buildHeaders(token, queryStr, bodyStr),
  };
  if (method !== 'GET' && method !== 'DELETE') opt.body = bodyStr;

  if (DEBUG) log('→ ' + method + ' ' + url + '\n' + JSON.stringify(opt.headers, null, 2));

  return $task.fetch(opt).then(function (resp) {
    if (DEBUG) log('← ' + resp.statusCode + '\n' + resp.body);
    var json = null;
    try { json = JSON.parse(resp.body); } catch (e) {}
    return { status: resp.statusCode, raw: resp.body, json: json };
  }).catch(function (e) {
    return { status: 0, raw: '', json: null, err: String((e && e.message) || e) };
  });
}

function apiRetry(path, method, token, query, body) {
  var attempt = 0;
  function run() {
    return api(path, method, token, query, body).then(function (res) {
      var bad = res.status === 0 || res.status >= 500 || res.json === null;
      if (bad && attempt < RETRY) {
        attempt++;
        log('第 ' + attempt + ' 次重试…');
        return new Promise(function (r) { setTimeout(r, 1500); }).then(run);
      }
      return res;
    });
  }
  return run();
}

function isOk(json) {
  if (!json) return false;
  var code = json.code !== undefined ? json.code : json.status;
  return OK_CODES.indexOf(String(code)) >= 0;
}

/* 拉本月签到日历，统计「今日获得积分」「本月已签天数」
 * 注意：integralScore 是「当天签到获得」的积分，不是账户总余额。
 * 账户余额不在 H5 的接口里（H5 全部 22 个接口已逐一核过），
 * 那是由原生 App 自己的接口返回的。 */
function fetchCalendar(token) {
  return apiRetry('/cfmotoservermine/signin/info', 'GET', token, { month: monthStr() })
    .then(function (res) {
      if (!res.json || !isOk(res.json)) return null;
      var list = pick(res.json, 'data.nowSignDetailVos') || [];
      var today = todayStr();
      var todayScore = null;
      var signed = 0;
      list.forEach(function (d) {
        if (!d) return;
        if (Number(d.signStatue) === 3) signed++;
        if (String(d.createDate) === today) {
          var s = d.integralScore;
          if (s !== null && s !== undefined && s !== '') todayScore = s;
        }
      });
      return { todayScore: todayScore, monthSigned: signed };
    })
    .catch(function () { return null; });
}

/* ------------------------------ 单账号流程 ------------------------------ */
function runOne(token, idx) {
  var tag = '账号' + (idx + 1);
  var result = { tag: tag, ok: false, msg: '' };

  var nickname = null;

  /* 1. 拉用户信息（顺便拿 uid 和昵称；此接口不需要 user_id 头） */
  return apiRetry('/cfmotoservermine/baseInfo', 'GET', token).then(function (r1) {
    if (r1.json === null) {
      /* 第一个请求就挂了 —— 多半是分流把国内域名丢给代理了 */
      result.netFail = true;
      result.msg = (r1.status ? 'HTTP ' + r1.status : '请求发不出去') +
                   (r1.err ? '（' + r1.err + '）' : '');
      return result;
    }
    if (isOk(r1.json)) {
      nickname = pick(r1.json, 'data.nickName');
      if (nickname) result.tag = '账号' + (idx + 1) + '(' + nickname + ')';
      result.avatar = pick(r1.json, 'data.avatar') || '';
    } else if (r1.status === 401 || r1.status === 403) {
      result.msg = 'Token 失效，请重新抓包';
      return result;
    }

    /* 2. 查签到状态，判断今天是否已签 */
    return apiRetry('/cfmotoservermine/signin', 'GET', token).then(function (r2) {
      if (r2.json && isOk(r2.json)) {
        var last = pick(r2.json, 'data.lastTime') || '';
        result.days = pick(r2.json, 'data.continueDays');
        if (String(last).indexOf(todayStr()) === 0) {
          result.ok = true;
          result.dup = true;
          result.msg = '今日已签到';
          return result;
        }
      }

      /* 3. 执行签到
       * 注意：签到接口的返回码不可信 —— 新签和重复签都可能是
       *   code "10000"                  新签到成功
       *   code "repeatedly_operation"   重复操作 / 太频繁
       * 所以这里不看返回码下结论，一律回查真实签到状态。 */
      return apiRetry('/cfmotoservermine/signin', 'POST', token).then(function (r3) {
        var postCode = (r3.json && r3.json.code !== undefined) ? String(r3.json.code) : '';
        var postMsg = (r3.json && (r3.json.message || r3.json.msg)) || '';

        if (r3.json === null) {
          result.msg = 'HTTP ' + r3.status + ' 返回非 JSON';
          return result;
        }

        /* 4. 回查签到状态，以它为准 */
        return apiRetry('/cfmotoservermine/signin', 'GET', token).then(function (r4) {
          var last2 = r4.json ? String(pick(r4.json, 'data.lastTime') || '') : '';
          result.days = r4.json ? pick(r4.json, 'data.continueDays') : undefined;

          if (last2.indexOf(todayStr()) === 0) {
            result.ok = true;
            if (postCode === '' || OK_CODES.indexOf(postCode) >= 0) {
              result.msg = '签到成功';
            } else {
              result.dup = true;
              result.msg = '今日已签到';
            }
            return result;
          }

          result.ok = false;
          result.msg = '签到未生效：' + (postMsg || '未知') +
                       (postCode ? ' (code ' + postCode + ')' : '');
          return result;
        });
      });
    });
  }).then(function (r) {
    /* 5. 补一次本月日历，拿到「今日获得积分」和「本月已签天数」 */
    return fetchCalendar(token).then(function (cal) {
      if (cal) {
        r.todayScore = cal.todayScore;
        r.monthSigned = cal.monthSigned;
      }
      return r;
    });
  }).catch(function (e) {
    result.msg = '异常: ' + ((e && e.message) || e);
    return result;
  });
}

/* ------------------------------ 主入口 ------------------------------ */
function main() {
  var tokens = loadTokens();
  if (!tokens.length) {
    log('未配置 Token');
    $notify('ZEEHO 极核', '未配置 Token', '请在脚本 §1 账号区填入抓包得到的 token');
    return $done();
  }

  var chain = Promise.resolve();
  var results = [];
  tokens.forEach(function (tk, i) {
    chain = chain.then(function () {
      return runOne(tk, i).then(function (r) {
        results.push(r);
        log(r.tag + ' → ' + (r.ok ? '成功' : '失败') + ' ' + r.msg);
      });
    });
  });

  chain.then(function () {
    var total = results.length;
    var okCount = results.filter(function (r) { return r.ok; }).length;
    var allDup = okCount > 0 && results.every(function (r) { return r.dup; });

    var title;
    if (okCount === 0) title = '签到失败 (0/' + total + ')';
    else if (allDup) title = '今日已签到 (' + okCount + '/' + total + ')';
    else if (okCount === total) title = '签到成功 (' + okCount + '/' + total + ')';
    else title = '部分成功 (' + okCount + '/' + total + ')';

    var body = results.map(function (r) {
      var extra = [];
      if (r.days !== undefined && r.days !== null) extra.push('连续 ' + r.days + ' 天');
      if (r.todayScore !== undefined && r.todayScore !== null && r.todayScore !== '') {
        extra.push('今日 +' + r.todayScore + ' 积分');
      }
      if (r.monthSigned !== undefined) extra.push('本月已签 ' + r.monthSigned + ' 天');
      var line = r.tag + ': ' + (r.ok ? (r.dup ? '·' : '+') : '×') + ' ' + r.msg;
      return extra.length ? line + '\n　　 ' + extra.join(' · ') : line;
    }).join('\n');

    /* 网络层失败时直接在通知里给出解法，省得回去翻文档 */
    if (results.some(function (r) { return r.netFail; })) {
      body += '\n\n⚠️ 连不上 h5.zeehoev.com。\n' +
              '多半是这个国内域名被 QX 丢给代理了。\n' +
              '在 QX 配置文件的 [filter_local] 段加一行：\n' +
              'host-suffix, zeehoev.com, direct';
    }

    log(title + '\n' + body);

    /* 通知附件：用账号头像当 media-url，长按通知可见 */
    var opts = { 'open-url': CFG.HOST + '/activity/signin' };
    if (NOTIFY_AVATAR) {
      var avatar = results.map(function (r) { return r.avatar; }).filter(Boolean)[0];
      if (avatar) opts['media-url'] = avatar;
    }

    $notify('ZEEHO 极核 · 每日签到', title, body, opts);
    $done();
  }).catch(function (e) {
    log('主流程异常: ' + ((e && e.message) || e));
    $notify('ZEEHO 极核 · 每日签到', '脚本异常', String((e && e.message) || e));
    $done();
  });
}

main();
