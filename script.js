// 데이터는 data.js 에 들어 있습니다 (LINES 변수). index.html 에서 data.js 를 먼저 불러옵니다.

const MIN_PER_STOP = 2; // 역 하나 지날 때 걸리는 평균 시간(분). 숫자를 바꾸면 전체가 바뀝니다.

// ===== 혼잡도 기준표 (엑셀 '혼잡도_판정_기준표' 시트, 서울시 자료 기준) =====
function level(n) {
  if (n < 15000) return "여유";
  if (n < 35000) return "보통";
  if (n < 80000) return "혼잡";
  return "매우혼잡";
}
const CLASS = {"여유":"lv1","보통":"lv2","혼잡":"lv3","매우혼잡":"lv4"};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");
let offset = 0; // 표를 위/아래로 몇 시간 옮겼는지

// ===== 호선 / 역 선택칸 채우기 =====
for (const l of Object.keys(LINES).sort((a, b) => a.localeCompare(b, "ko", {numeric: true}))) $("lineSelect").add(new Option(l, l));

function fillStations() {
  const line = LINES[$("lineSelect").value];
  for (const id of ["fromStation","toStation"]) {
    $(id).innerHTML = "";
    line.n.forEach((s, i) => $(id).add(new Option(s, i))); // 값은 역 번호(0,1,2...)
  }
  $("fromStation").value = 0;
  $("toStation").value = Math.min(line.n.length - 1, 3);
  $("lineNote").textContent = line.ok ? "" :
    "※ 이 노선은 자료에 적힌 역 순서로 이동시간을 계산해서 실제와 다를 수 있어요.";
}

// ===== 역 사이 정거장 수 (연결된 역을 따라 가장 짧은 길을 찾음) =====
function countStops(line, a, b) {
  const n = line.n.length;
  const adj = Array.from({length: n}, () => []);
  const edges = line.e || Array.from({length: n - 1}, (_, i) => [i, i + 1]);
  for (const [x, y] of edges) { adj[x].push(y); adj[y].push(x); }
  const dist = Array(n).fill(-1);
  dist[a] = 0;
  const q = [a];
  while (q.length) {
    const c = q.shift();
    for (const nx of adj[c]) if (dist[nx] < 0) { dist[nx] = dist[c] + 1; q.push(nx); }
  }
  return dist[b];
}

function hourLabel(h){ h=((h%24)+24)%24; return pad(h)+"-"+pad((h+1)%24)+"시"; }

// ===== 계산해서 화면에 그리는 메인 함수 =====
function update() {
  const line = LINES[$("lineSelect").value];
  const from = parseInt($("fromStation").value), to = parseInt($("toStation").value);
  const hh = parseInt($("hour").value), mm = parseInt($("minute").value);
  const err = $("error");
  err.textContent = "";
  if (from === to) { err.textContent = "승차역과 하차역이 같아요. 다른 역을 골라주세요."; return; }
  if (isNaN(hh)||isNaN(mm)||hh<0||hh>23||mm<0||mm>59) { err.textContent = "시(0~23)와 분(0~59)을 숫자로 입력해주세요."; return; }

  const travel = countStops(line, from, to) * MIN_PER_STOP;
  const total = hh*60 + mm + travel;
  const arrH = Math.floor(total/60) % 24, arrM = total % 60;
  $("travel").textContent = travel + "분";
  $("arrive").textContent = arrH + "시 " + pad(arrM) + "분";

  drawList("listFrom", "badgeFrom", "nameFrom", line.n[from], line.b[from], hh);
  drawList("listTo",   "badgeTo",   "nameTo",   line.n[to],   line.a[to],   arrH);
}

function drawList(listId, badgeId, nameId, name, values, baseHour) {
  $(nameId).textContent = name;
  const box = $(listId);
  box.innerHTML = "";
  for (let i = -3; i <= 3; i++) {
    const h = ((baseHour + i + offset) % 24 + 24) % 24;
    const idx = (h - 4 + 24) % 24;          // 데이터 목록에서의 위치 (04시가 0번)
    const lv = level(values[idx]);
    const isNow = ((i + offset) % 24 === 0); // 한 바퀴(24시간) 돌아도 현재 시간으로 표시
    const row = document.createElement("div");
    row.className = "row " + CLASS[lv] + (isNow ? " now" : "");
    row.textContent = hourLabel(h) + ": " + lv;
    box.appendChild(row);
    if (isNow) { const b = $(badgeId); b.textContent = lv; b.className = "badge " + CLASS[lv]; }
  }
}

function shift(d){ offset += d; update(); }
function resetShift(){ offset = 0; update(); }

$("lineSelect").addEventListener("input", () => { offset = 0; fillStations(); update(); });
for (const id of ["fromStation","toStation","hour","minute"]) {
  $(id).addEventListener("input", () => { offset = 0; update(); });
}

// 처음 실행: 1호선 기본값 (신설동 → 시청)
$("lineSelect").value = "1호선";
fillStations();
$("fromStation").value = LINES["1호선"].n.indexOf("신설동");
$("toStation").value = LINES["1호선"].n.indexOf("시청");
update();

// ===== 마우스 휠 / 터치 스크롤로 시간대 이동 =====
// 혼잡도 표 위에서 휠을 굴리면 페이지 대신 표가 이동합니다. (아래로 굴리면 이후 시간, 위로 굴리면 이전 시간)
const listsBox = document.querySelector(".lists");
let lastWheel = 0;
listsBox.addEventListener("wheel", e => {
  e.preventDefault();                      // 페이지 자체가 스크롤되는 것을 막음
  const now = Date.now();
  if (now - lastWheel < 120) return;       // 너무 빠르게 넘어가지 않도록 간격 두기
  lastWheel = now;
  shift(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

// 휴대폰: 표 위에서 손가락을 위/아래로 밀기
let touchY = null;
listsBox.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
listsBox.addEventListener("touchmove", e => {
  if (touchY === null) return;
  const dy = touchY - e.touches[0].clientY;
  if (Math.abs(dy) > 30) {                 // 30px 이상 밀면 한 칸 이동
    e.preventDefault();
    shift(dy > 0 ? 1 : -1);
    touchY = e.touches[0].clientY;
  }
}, { passive: false });
