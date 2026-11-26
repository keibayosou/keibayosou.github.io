/* シミュ予想のページ（index.html / shushi.html 共通）。data/latest.json → data/<日付>.json を1分ごとに読み直す */
const App = (() => {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const yen = x => x.toLocaleString("ja-JP") + "円";
  const $ = id => document.getElementById(id);
  let D = null, sel = { jyo: null, key: null }, userPicked = false, forcedDay = null;
  const GTXT = { A: "自信あり", B: "やや自信", C: "普通", D: "やや混戦", E: "混戦" };

  function postDate(r) {
    if (!D || !r.post) return null;
    const d = D.date;
    return new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +r.post.slice(0, 2), +r.post.slice(3, 5));
  }
  function nextRace() {
    if (!D) return null;
    const now = new Date();
    const up = D.races.filter(r => { const p = postDate(r); return p && p > now; });
    return up.length ? up[0] : null;
  }
  function tick() {
    const n = new Date();
    $("clock").textContent = n.toLocaleTimeString("ja-JP", { hour12: false });
    $("today").textContent = n.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
    const nx = nextRace(), el = $("next");
    if (!nx) { el.innerHTML = `<span class="lab">次のレース</span><b>${D ? "本日は終了" : "—"}</b>`; return; }
    const ms = postDate(nx) - n, m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
    const cd = m >= 60 ? `あと${Math.floor(m / 60)}時間${m % 60}分` : `あと${m}分${String(s).padStart(2, "0")}秒`;
    el.innerHTML = `<span class="lab">次のレース</span><b>${esc(nx.jname)}${nx.rn}R ${esc(nx.post)}</b><span class="cd">${cd}</span>`;
  }
  async function load() {
    const bust = "?t=" + Date.now();
    let day = forcedDay;
    if (!day) { const L = await (await fetch("data/latest.json" + bust)).json(); day = L.date; App.days = L.days; }
    D = await (await fetch(`data/${day}.json` + bust)).json();
    $("upd").textContent = `データ更新 ${D.updated}`;
  }
  const wk = (w) => `<span class="wk w${w || 0}">`;
  function horseLine(h, r) {
    return `<div class="pick"><div class="mk">${esc(h.mark)}</div>${wk(h.waku)}${h.uma}</span>
      <div class="nm">${esc(h.name)}<small>平均${h.avg.toFixed(1)}着${h.jockey ? "・" + esc(h.jockey) : ""}</small></div>
      <div class="pr">勝率 <b>${pct(h.p1)}</b><br>3着内 ${pct(h.p3, 0)}
      <div class="bar"><i style="width:${Math.min(100, h.p3 * 100)}%"></i></div></div></div>`;
  }
  function betBlock(b, res) {
    const hitSet = new Set();
    let ret = null;
    if (res) {
      const rb = res.bets.find(x => x.id === b.id); ret = rb ? rb.ret : 0;
      const pays = (b.id === "①" ? res.tan : (b.id === "②" || b.id === "④") ? res.umaren : res.sanrenpuku) || [];
      pays.forEach(([k]) => hitSet.add(k.slice().sort((a, c) => a - c).join("-")));
    }
    const pts = b.points.map(p => { const k = p.join("-"); return `<span class="${hitSet.has(k) ? "hit" : ""}">${k}</span>`; }).join("");
    const rt = ret === null ? "" : `<span class="ret ${ret > 0 ? "win" : "lose"}">${ret > 0 ? "的中 " + yen(ret) : "はずれ"}</span>`;
    return `<div class="bet"><div class="bh"><b>${esc(b.id)} ${esc(b.name)}</b><span>${b.points.length}点×${yen(b.unit || 100)}＝${yen(b.cost)} ${rt}</span></div>
      <div class="pts">${pts}</div>
      <div class="past">過去の回収率（2026年・この等級）${b.past}%／全体 ${b.past_all}%</div></div>`;
  }
  function raceCard(r) {
    const stageTxt = r.stage === "30分前" ? `30分前の予想・買い目確定（${esc(r.made)}）`
      : r.stage === "前日" ? `前日の予想（当日8:30と発走30分前に出し直します）` : `当日朝の予想（発走30分前に出し直して確定します）`;
    const SN = { "前日": "前日", "朝": "朝", "30分前": "確定" };
    const hist = (r.hist || []).length > 1 ? `<div class="muted" style="margin-top:4px;font-size:11.5px">◎の変化：${r.hist.map(([s, u]) => `${SN[s] || esc(s)} ${u}番`).join(" → ")}</div>` : "";
    const notes = (r.notes || []).map(n => `<div class="note">${esc(n)}</div>`).join("");
    const top5 = r.horses.slice(0, 5).map(h => horseLine(h, r)).join("");
    const res = r.result;
    const resHtml = res ? `<section class="card"><h2>結果</h2><div class="res">${res.order.map((u, i) => `<span class="o">${i + 1}着</span>${wk((r.horses.find(h => h.uma === u) || {}).waku)}${u}</span>`).join("")}
       <span class="o">◎は${res.hon_fin ? res.hon_fin + "着" : "—"}</span></div>
       <div class="muted" style="margin-top:6px">単勝 ${res.tan.map(([k, v]) => k.join("") + "番 " + yen(v)).join("・")}　馬連 ${res.umaren.map(([k, v]) => k.join("-") + " " + yen(v)).join("・")}　三連複 ${res.sanrenpuku.map(([k, v]) => k.join("-") + " " + yen(v)).join("・")}</div></section>` : "";
    const rows = r.horses.map(h => `<tr class="${h.srk <= 5 ? "top5" : ""}"><td>${h.srk}</td><td class="l">${esc(h.mark)}</td><td>${wk(h.waku)}${h.uma}</span></td>
        <td class="nmc">${esc(h.name)}</td><td>${pct(h.p1)}</td><td>${pct(h.p2, 0)}</td><td>${pct(h.p3, 0)}</td><td>${h.avg.toFixed(1)}</td></tr>`).join("");
    const why = r.reasons.map(t => `<li class="${t.startsWith("⚠") ? "w" : ""}">${esc(t)}</li>`).join("");
    const crs = (r.course.lines || []).map(t => `<li>${esc(t)}</li>`).join("");
    return `
    <section class="card">
      <div class="race-h"><div>
        <div class="rt">${esc(r.jname)} ${r.rn}R <span style="font-weight:600">${esc(r.post)}発走</span></div>
        <div class="rs">${esc(r.title)}　${esc(r.surf)}${r.dist}m・${r.n}頭${r.going ? "・馬場 " + esc(r.going) : ""}</div>
        <span class="stage ${r.stage === "30分前" ? "" : "morning"}">${stageTxt}</span>${hist}${notes}
      </div>
      <div class="grade g${esc(r.grade)}"><span>自信</span><b>${esc(r.grade)}</b><span>${GTXT[r.grade] || ""}</span></div></div>
    </section>
    ${resHtml}
    <section class="card"><h2>推奨馬（シミュレーションの上位5頭）</h2>${top5}</section>
    <section class="card"><h2>おすすめの買い目（各2,000円）</h2>${r.bets.map(b => betBlock(b, res)).join("")}</section>
    <section class="card"><h2>◎ ${r.horses[0].uma} ${esc(r.horses[0].name)} を推す根拠</h2><ul class="why">${why}</ul></section>
    <section class="card"><h2>確率一覧（1万回のシミュレーション）</h2><div class="scroll"><table class="pt">
      <thead><tr><th>順</th><th class="l">印</th><th>馬番</th><th class="l">馬名</th><th>勝率</th><th>2着内</th><th>3着内</th><th>平均着順</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="card course"><h2>コースの解説　${esc(r.course.title)}</h2><ul class="why">${crs}</ul></section>
    ${babaCard(r)}
    ${memoCard(r)}`;
  }
  function babaCard(r) {      // 馬場レポート（参考に反映）
    const b = r.baba; if (!b) return "";
    return `<section class="card"><h2>馬場レポート（参考に反映）</h2>
      <div class="memo"><div class="mt"><b>レポート</b>　${esc(b.report)}</div><div class="mt"><b>シミュの見込み</b>　${esc(b.sim)}</div>
      <div class="mt" style="color:var(--accent)">→ ${esc(b.act)}</div>
      ${(b.lines || []).length ? `<div class="mc">${b.lines.map(esc).join("<br>")}</div>` : ""}</div></section>`;
  }
  function memoCard(r) {      // メモ馬（表示だけ・予想には入れていない）
    if (!D.memo_on) return "";
    const ms = r.memo || [];
    const body = ms.length ? ms.map(m => {
      const h = r.horses.find(x => x.uma === m.uma) || {};
      return `<div class="memo ${m.pick ? "pk" : ""}"><div class="mh">${m.pick ? `<b class="star">★厳選${m.pick}</b>` : ""}${wk(h.waku)}${m.uma || "?"}</span> <b>${esc(m.name)}</b>${h.srk ? `<span class="muted">（シミュ${h.srk}位）</span>` : ""}</div>
        ${m.memo ? `<div class="mt">次走条件　${esc(m.memo)}</div>` : ""}${m.card ? `<div class="mc">📝 ${esc(m.card)}</div>` : ""}</div>`;
    }).join("") : `<p class="muted" style="margin:0">このレースにメモ馬はいません</p>`;
    return `<section class="card"><h2>メモ馬（参考・予想には入れていません）</h2>${body}</section>`;
  }
  function renderNav() {
    const ven = [...new Set(D.races.map(r => r.jname))];
    if (!sel.jyo || !ven.includes(sel.jyo)) sel.jyo = ven[0];
    $("venues").innerHTML = ven.map(v => `<button class="${v === sel.jyo ? "on" : ""}" data-v="${esc(v)}">${esc(v)}</button>`).join("");
    const rs = D.races.filter(r => r.jname === sel.jyo).sort((a, b) => a.rn - b.rn);
    const now = new Date();
    $("rnums").innerHTML = rs.map(r => `<button class="${r.key === sel.key ? "on" : ""} ${postDate(r) && postDate(r) < now ? "done" : ""}" data-k="${r.key}">${r.rn}R<small>${esc(r.post)}</small></button>`).join("");
    document.querySelectorAll("#venues button").forEach(b => b.onclick = () => { sel.jyo = b.dataset.v; const f = D.races.filter(r => r.jname === sel.jyo); const nx = nextRace(); sel.key = (nx && nx.jname === sel.jyo ? nx : f.sort((a, c) => a.rn - c.rn)[0]).key; userPicked = true; render(); });
    document.querySelectorAll("#rnums button").forEach(b => b.onclick = () => { sel.key = b.dataset.k; userPicked = true; render(); });
  }
  function render() {
    if (!D || !D.races.length) { $("main").innerHTML = `<p class="pad muted">この日の予想はまだありません。</p>`; return; }
    if (!userPicked || !D.races.find(r => r.key === sel.key)) {
      const nx = nextRace() || D.races[D.races.length - 1]; sel.key = nx.key; sel.jyo = nx.jname;
    }
    renderNav();
    const r = D.races.find(x => x.key === sel.key);
    $("main").innerHTML = raceCard(r);
  }
  async function page() {
    const q = new URLSearchParams(location.search); forcedDay = q.get("d");
    setInterval(tick, 1000);
    try { await load(); } catch (e) { $("main").innerHTML = `<p class="pad muted">データを読めませんでした。</p>`; return; }
    tick(); render();
    setInterval(async () => { try { await load(); render(); } catch (e) { } }, 60000);
  }
  // ---------------- 収支
  function shushiRender() {
    const T = D.total, names = D.bet_names;
    let C = 0, Rt = 0;
    const rows = Object.keys(T).map((k, i) => {
      const t = T[k]; C += t.cost; Rt += t.ret;
      const rr = t.cost ? (t.ret / t.cost * 100).toFixed(1) + "%" : "—", pl = t.ret - t.cost;
      return `<tr><td class="l">${esc(k)} ${esc(names[k])}</td><td>${t.n}R</td><td>${t.hit}</td><td>${yen(t.cost)}</td><td>${yen(t.ret)}</td><td class="${pl >= 0 ? "plus" : "minus"}">${pl >= 0 ? "+" : ""}${yen(pl)}</td><td><b>${rr}</b></td><td class="muted">${D.past_all[i]}%</td></tr>`;
    }).join("");
    const done = D.races.filter(r => r.result);
    const kpi = `<div class="kpi"><div><span>結果が出たレース</span><b>${done.length} / ${D.races.length}R</b></div><div><span>5つ合計の投資</span><b>${yen(C)}</b></div>
      <div><span>5つ合計の払戻</span><b>${yen(Rt)}</b></div><div><span>5つ合計の回収率</span><b>${C ? (Rt / C * 100).toFixed(1) + "%" : "—"}</b></div></div>`;
    const rr = done.map(r => `<tr><td class="l">${esc(r.jname)}${r.rn}R</td><td>${r.grade}</td><td>${r.horses[0].uma}</td><td>${r.result.hon_fin ? r.result.hon_fin + "着" : "—"}</td>${r.result.bets.map(b => `<td class="${b.ret > 0 ? "plus" : "muted"}">${b.ret > 0 ? b.ret.toLocaleString() : "·"}</td>`).join("")}</tr>`).join("");
    $("main").innerHTML = `
      <section class="card"><h2>${D.date.slice(4, 6)}月${D.date.slice(6, 8)}日の収支</h2>${kpi}</section>
      <section class="card"><h2>買い方ごと</h2><div class="scroll"><table class="pt"><thead><tr><th class="l">買い方</th><th>R</th><th>的中</th><th>投資</th><th>払戻</th><th>収支</th><th>回収率</th><th>過去</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="muted">「過去」は2026年1/4〜11/23（2,754R）のシミュレーションでの回収率。</p></section>
      <section class="card"><h2>レースごとの払戻（円）</h2><div class="scroll"><table class="pt"><thead><tr><th class="l">レース</th><th>等級</th><th>◎</th><th>◎着順</th><th>①</th><th>②</th><th>③</th><th>④</th><th>⑤</th></tr></thead><tbody>${rr || `<tr><td class="l muted" colspan="9">まだ結果がありません</td></tr>`}</tbody></table></div></section>
      <div id="hist"></div>`;
    histRender();
  }
  // ---------------- 年間・開催ごと・日別（data/history.json）
  let H = null, hMode = "pl";
  const WD = "日月火水木金土";
  const dObj = d => new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
  const md = d => `${+d.slice(4, 6)}/${+d.slice(6, 8)}(${WD[dObj(d).getDay()]})`;
  const man = x => Math.abs(x) >= 10000 ? (x / 10000).toFixed(Math.abs(x) >= 1e6 ? 0 : 1) + "万" : x.toLocaleString("ja-JP");
  const sign = x => (x >= 0 ? "+" : "") + man(x);
  const SHORT = { "①": "単勝", "②": "馬連2点", "③": "三連複◎軸", "④": "馬連BOX", "⑤": "三連複BOX" };
  function sumDays(ds) {
    const s = { n: 0, b: {} };
    Object.keys(H.bet_names).forEach(k => s.b[k] = [0, 0, 0]);
    ds.forEach(d => { s.n += d.n; Object.keys(d.b).forEach(k => { for (let i = 0; i < 3; i++) s.b[k][i] += d.b[k][i]; }); });
    return s;
  }
  function cell(c, r) {
    if (!c) return `<td class="muted">—</td>`;
    if (hMode === "pl") return `<td class="${r - c >= 0 ? "plus" : "minus"}">${sign(r - c)}</td>`;
    const p = r / c * 100; return `<td class="${p >= 100 ? "plus" : ""}">${p.toFixed(0)}%</td>`;
  }
  function rowCells(s) {
    let C = 0, R = 0;
    const cs = Object.keys(H.bet_names).map(k => { const [c, r] = s.b[k]; C += c; R += r; return cell(c, r); }).join("");
    return cs + cell(C, R).replace("<td", `<td style="font-weight:800"`);
  }
  function groups() {   // 開催ごと：2日以内に続く日をひとまとめ（土日・3日開催）
    const G = []; let cur = null;
    H.days.forEach(d => {
      if (cur && (dObj(d.d) - dObj(cur.at(-1).d)) / 864e5 <= 2) cur.push(d); else { cur = [d]; G.push(cur); }
    });
    return G;
  }
  function histRender() {
    const el = $("hist"); if (!el || !H) return;
    const K = Object.keys(H.bet_names);
    const head = `<tr><th class="l">${"{L}"}</th><th>R</th>${K.map(k => `<th>${k}</th>`).join("")}<th>合計</th></tr>`;
    const Y = sumDays(H.days);
    let C = 0, R = 0;
    const yr = K.map(k => {
      const [c, r, h] = Y.b[k]; C += c; R += r;
      return `<tr><td class="l" style="white-space:nowrap">${esc(k)} ${esc(SHORT[k] || "")}</td><td>${(h / Y.n * 100).toFixed(1)}%</td><td>${man(c)}</td><td>${man(r)}</td><td class="${r - c >= 0 ? "plus" : "minus"}">${sign(r - c)}</td><td><b>${(r / c * 100).toFixed(1)}%</b></td></tr>`;
    }).join("");
    const first = H.days[0].d, last = H.days.at(-1).d, live = H.days.filter(d => d.src === "実戦");
    const tag = ds => ds.some(d => d.src === "実戦") ? ` <span class="stage" style="margin:0;padding:1px 6px">実戦</span>` : "";
    const G = groups().reverse();
    const glab = g => { const a = g[0].d, b = g.at(-1).d; if (g.length === 1) return md(a); return md(a) + "〜" + (a.slice(4, 6) === b.slice(4, 6) ? md(b).replace(/^\d+\//, "") : md(b)); };
    const gr = G.map(g => `<tr><td class="l">${glab(g)}${tag(g)}<br><small class="muted">${[...new Set(g.flatMap(d => d.v))].join("・")}</small></td><td>${g.reduce((a, d) => a + d.n, 0)}</td>${rowCells(sumDays(g))}</tr>`).join("");
    let lastM = "";
    const dr = H.days.slice().reverse().map(d => {
      const m = d.d.slice(4, 6), mh = m !== lastM ? `<tr><td class="l" colspan="${K.length + 3}" style="background:var(--chip);font-weight:700">${+m}月</td></tr>` : ""; lastM = m;
      return mh + `<tr><td class="l">${md(d.d)}${tag([d])}<br><small class="muted">${d.v.join("・")}</small></td><td>${d.n}</td>${rowCells(d)}</tr>`;
    }).join("");
    const tog = `<div class="row" style="margin-bottom:8px"><button class="btn ${hMode === "pl" ? "" : "ghost"}" data-m="pl" style="padding:6px 12px">収支（円）</button><button class="btn ${hMode === "rr" ? "" : "ghost"}" data-m="rr" style="padding:6px 12px">回収率</button></div>`;
    el.innerHTML = `
      <section class="card"><h2>2026年の通算（${md(first)}〜${md(last)}・${H.days.length}日・${Y.n.toLocaleString()}R）</h2>
        <div class="kpi"><div><span>5つ合計の投資</span><b>${yen(C)}</b></div><div><span>5つ合計の払戻</span><b>${yen(R)}</b></div>
        <div><span>5つ合計の収支</span><b class="${R - C >= 0 ? "plus" : "minus"}">${sign(R - C)}円</b></div><div><span>5つ合計の回収率</span><b>${(R / C * 100).toFixed(1)}%</b></div></div>
        <div class="scroll" style="margin-top:10px"><table class="pt"><thead><tr><th class="l">買い方</th><th>的中率</th><th>投資</th><th>払戻</th><th>収支</th><th>回収率</th></tr></thead><tbody>${yr}</tbody></table></div>
        <p class="muted">金額は円（万＝1万円）。各買い方とも1R 2,000円。② ◎-2位,3位　③ ◎軸で2〜6位へ10点　④ 1〜5位のBOX　⑤ 1〜5位のBOX</p>
        <p class="muted">${live.length ? `実戦は${md(live[0].d)}から。それより前は` : ""}過去のシミュレーション（予想の作り方は本番と同じ・朝の情報まで）を、実際の払戻で計算したもの。新馬戦・障害は含みません。</p></section>
      <section class="card"><h2>開催ごと（土日・3日開催はまとめて）</h2>${tog}<div class="scroll"><table class="pt h"><thead>${head.replace("{L}", "開催")}</thead><tbody>${gr}</tbody></table></div></section>
      <section class="card"><h2>日別</h2>${tog}<div class="scroll"><table class="pt h"><thead>${head.replace("{L}", "日付")}</thead><tbody>${dr}</tbody></table></div></section>`;
    el.querySelectorAll("button[data-m]").forEach(b => b.onclick = () => { hMode = b.dataset.m; histRender(); });
  }
  async function loadHist() { try { H = await (await fetch("data/history.json?t=" + Date.now())).json(); } catch (e) { H = null; } }
  async function shushi() {
    setInterval(tick, 1000);
    await loadHist();
    try { await load(); } catch (e) { $("main").innerHTML = `<p class="pad muted">データを読めませんでした。</p>`; return; }
    const s = $("day");
    s.innerHTML = (App.days || [D.date]).map(d => `<option value="${d}">${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}</option>`).join("");
    s.value = D.date;
    s.onchange = async () => { forcedDay = s.value; await load(); shushiRender(); };
    tick(); shushiRender();
    setInterval(async () => { try { await loadHist(); await load(); shushiRender(); } catch (e) { } }, 60000);
  }
  return { page, shushi, days: null };
})();
