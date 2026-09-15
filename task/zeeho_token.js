/*!
 * ============================================================================
 *  ZEEHO 极核 · TOKENS 获取 / 状态查看
 *  ---------------------------------------------------------------------------
 *  同一个文件，两种模式，QX 会自动判断该走哪条：
 *
 *  【重写模式】被 script-request-header 调用
 *      你在 ZEEHO App 里打开「我的」或「签到」页面时，QX 截获
 *      h5.zeehoev.com 的请求，自动把里面的 TOKEN 取出来存好并通知你。
 *      ——不需要抓包，不需要手动复制。
 *
 *  【任务模式】手动点 ▶ 运行（或按 cron 触发）
 *      查看当前保存的 TOKEN 状态。
 *
 *  抓到的 TOKEN 存在 QX 持久化变量 ZEEHO_tokens 里，签到脚本会自动读取。
 *
 *  免责声明：仅供个人学习与自用，请勿用于商业用途或任何违规场景。
 * ============================================================================
 */

var STORE_KEY = 'ZEEHO_tokens';

/* TOKEN 打码显示，避免通知栏泄露完整凭据 */
function mask(t) {
  t = String(t);
  return t.length > 16 ? t.slice(0, 8) + '…' + t.slice(-4) : '****';
}

function notify(title, sub, body, opts) {
  try { $notify(title, sub, body, opts || {}); }
  catch (e) { $notify(title, sub, body); }
}

if (typeof $request !== 'undefined') {
  /* ======================= 重写模式：从流量里抓 TOKEN ======================= */

  var token = '';
  var from = '';

  /* 来源一：请求头 Authorization: Bearer xxx */
  try {
    var H = ($request && $request.headers) || {};
    var raw = H['Authorization'] || H['authorization'] || H['AUTHORIZATION'] || '';
    if (raw) {
      token = String(raw).replace(/^\s*[Bb]earer\s+/, '').trim();
      from = '请求头';
    }
  } catch (e) {}

  /* 来源二：URL 查询串里的 ?token=xxx（H5 页面自身的地址） */
  if (!token) {
    try {
      var m = String($request.url || '').match(/[?&]token=([^&#]+)/);
      if (m) {
        token = decodeURIComponent(m[1]).trim();
        from = '页面地址';
      }
    } catch (e) {}
  }

  /* 形态校验：TOKEN 是 UUID 形态，挡掉误抓的东西 */
  if (token && /^[0-9a-zA-Z._-]{16,128}$/.test(token)) {
    var old = '';
    try { old = String($prefs.valueForKey(STORE_KEY) || ''); } catch (e) {}

    /* 值变了才通知，避免每次刷页面都弹一次 */
    if (old !== token) {
      try { $prefs.setValueForKey(token, STORE_KEY); } catch (e) {}
      notify(
        'ZEEHO 极核',
        '获取 TOKENS 成功',
        '来源：' + from +
        '\nTOKEN：' + mask(token) +
        '\n\n已保存，签到脚本会自动读取，无需手动填写。',
        { 'open-url': 'https://h5.zeehoev.com/activity/signin' }
      );
    }
  }

  /* 不改动任何请求内容，原样放行 */
  $done({});

} else {
  /* ========================== 任务模式：查看状态 ========================== */

  var saved = '';
  try { saved = String($prefs.valueForKey(STORE_KEY) || ''); } catch (e) {}

  if (saved) {
    notify(
      'ZEEHO 极核 · TOKENS',
      '已有 TOKEN',
      'TOKEN：' + mask(saved) +
      '\n\n签到脚本会自动读取，不需要手动填写。\n' +
      '想换账号：用新账号打开一次 App，会自动覆盖。',
      { 'open-url': 'https://h5.zeehoev.com/activity/signin' }
    );
  } else {
    notify(
      'ZEEHO 极核 · TOKENS',
      '还没有 TOKEN',
      '打开 ZEEHO App → 进入「我的」或「签到」页面，\n' +
      'QX 抓到请求后会自动保存并通知你。\n\n' +
      '前提：「重写」和「MitM」两个开关要是打开的。',
      { 'open-url': 'https://h5.zeehoev.com/activity/signin' }
    );
  }

  $done();
}
