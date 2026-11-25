// Seed mini_wallet: in ra SQL (DROP + CREATE + COPY), pipe thẳng vào psql.
//   node seed.mjs | docker exec -i lab-postgres-1 psql -U lab -d mini_wallet -q -v ON_ERROR_STOP=1
// Cùng SEED thì ra cùng dữ liệu. Đổi SEED=42 node seed.mjs để có bộ khác.
//
// Mỗi biến số dưới đây cố ý làm lộ một lỗi query hay gặp:
// - wallets.id bắt đầu từ 1001, user có 0-3 ví   -> JOIN nhầm cột ra sai thay vì đúng nhờ trùng hợp
// - ~8% user không có ví                          -> users JOIN wallets (INNER) làm mất user
// - ví ngủ (không gửi, không nhận), ví chỉ nhận   -> LEFT JOIN + IS NULL, gửi vs nhận
// - tên trùng nhiều, ~3% name NULL                -> GROUP BY u.name gộp nhầm người; COUNT(name)
// - ví ngừng hoạt động giữa chừng (churn)         -> "có tháng 9, không có tháng 10"
// - vài ví nhận cực nhiều (merchant), gửi lệch    -> top N, HAVING, nhân dòng thấy rõ
// - giao dịch đúng mốc 00:00 01/10, 01/11, 01/12  -> > vs >=, <= vs <
// - chuyển giữa hai ví của cùng một user          -> đếm theo ví khác đếm theo user
// - giao dịch luôn cùng currency                  -> SUM(amount) theo currency có nghĩa

const SEED = Number(process.env.SEED ?? 2026);
const N_USERS = 10_000;
const N_TX = 100_000;
const START = Date.parse('2025-10-01T00:00:00Z');
const END = Date.parse('2026-12-01T00:00:00Z'); // độc quyền, trừ vài giao dịch mốc

let s = SEED >>> 0;
const rand = () => {
  // mulberry32
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();

// ---------- users ----------
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi'];
const TEN = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hùng', 'Khoa', 'Lan',
  'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Sơn', 'Thảo',
  'Trang', 'Tuấn', 'Vy', 'Yến'];

const users = [];
for (let i = 0; i < N_USERS; i++) {
  // càng về sau càng nhiều user mới (sqrt dồn về cuối khoảng)
  users.push({ created: START + (END - 20 * DAY - START) * Math.sqrt(rand()) });
}
users.sort((a, b) => a.created - b.created);
users.forEach((u, i) => {
  u.id = i + 1;
  u.name = rand() < 0.03 ? null : `${pick(HO)} ${pick(TEN)}`;
});

// ---------- wallets ----------
const wallets = [];
for (const u of users) {
  const r = rand();
  const n = r < 0.08 ? 0 : r < 0.78 ? 1 : r < 0.96 ? 2 : 3;
  let cur = rand() < 0.85 ? 'VND' : 'USD';
  for (let k = 0; k < n; k++) {
    if (k > 0) cur = rand() < 0.6 ? (cur === 'VND' ? 'USD' : 'VND') : cur;
    const created = k === 0 ? u.created + between(0, 3 * DAY) : between(u.created, END - 10 * DAY);
    wallets.push({ user: u, currency: cur, created });
  }
}
wallets.sort((a, b) => a.created - b.created);
wallets.forEach((w, i) => {
  w.id = 1001 + i;
  const p = rand();
  w.kind = p < 0.12 ? 'dormant' : p < 0.20 ? 'receive_only' : p < 0.21 ? 'merchant' : 'normal';
  // gửi lệch kiểu Pareto: đa số gửi ít, vài ví gửi rất nhiều
  w.sendW = w.kind === 'normal' ? Math.min(400, Math.pow(1 / (1 - rand()), 1.3)) : 0;
  w.recvW = w.kind === 'merchant' ? 150 : w.kind === 'dormant' ? 0 : 1;
  // 15% ví normal ngừng hoạt động ở một ngày ngẫu nhiên
  const canChurn = w.kind === 'normal' && w.created + 30 * DAY < END;
  w.activeTo = canChurn && rand() < 0.15 ? between(w.created + 30 * DAY, END) : END;
  const zero = rand() < 0.25;
  w.balance = zero ? 0
    : w.currency === 'VND' ? Math.round(Math.exp(between(9, 19)) / 1000) * 1000
    : Math.round(Math.exp(between(0, 10)) * 100) / 100;
});

// ---------- transactions ----------
function cumulative(list, weight) {
  const items = [], cum = [];
  let total = 0;
  for (const x of list) {
    const wgt = weight(x);
    if (wgt > 0) { total += wgt; items.push(x); cum.push(total); }
  }
  return {
    draw() {
      const target = rand() * total;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid; }
      return items[lo];
    },
  };
}
// nhân với số ngày hoạt động: ví sống lâu gửi nhiều hơn, mật độ theo tháng chỉ tăng theo số user
const senders = cumulative(wallets, (w) => w.sendW * (w.activeTo - w.created) / DAY);
const receivers = {
  VND: cumulative(wallets.filter((w) => w.currency === 'VND'), (w) => w.recvW),
  USD: cumulative(wallets.filter((w) => w.currency === 'USD'), (w) => w.recvW),
};
const ownWallets = new Map();
for (const w of wallets) {
  if (!ownWallets.has(w.user.id)) ownWallets.set(w.user.id, []);
  ownWallets.get(w.user.id).push(w);
}
const amountFor = (cur) => cur === 'VND'
  ? Math.max(1000, Math.round(Math.exp(between(8.5, rand() < 0.005 ? 19 : 16.5)) / 1000) * 1000)
  : Math.round(Math.exp(between(0, 8)) * 100) / 100;

const txs = [];
const addTx = (from, to, at) => txs.push({ from: from.id, to: to.id, at, amount: amountFor(from.currency) });

while (txs.length < N_TX) {
  const from = senders.draw();
  const at = between(from.created, from.activeTo);
  let to = null;
  const own = ownWallets.get(from.user.id).filter((w) => w !== from && w.currency === from.currency && w.created <= at);
  if (own.length && rand() < 0.3) to = pick(own); // chuyển giữa hai ví của chính mình
  for (let tries = 0; !to && tries < 20; tries++) {
    const c = receivers[from.currency].draw();
    if (c !== from && c.created <= at) to = c;
  }
  if (to) addTx(from, to, at);
}

// giao dịch nằm đúng mốc tháng, để lộ lỗi > / >= và <= / <
const active = wallets.filter((w) => w.kind === 'normal' && w.created < Date.parse('2026-09-01T00:00:00Z'));
const mates = (w) => wallets.filter((x) => x !== w && x.currency === w.currency && x.kind !== 'dormant' && x.created < w.created + DAY).slice(0, 50);
for (const [stamp, count] of [['2026-10-01T00:00:00Z', 15], ['2026-09-30T23:59:59.999Z', 10], ['2026-11-01T00:00:00Z', 10], ['2026-12-01T00:00:00Z', 10]]) {
  for (let i = 0; i < count; i++) {
    const from = pick(active);
    const to = pick(mates(from));
    if (to) addTx(from, to, Date.parse(stamp));
  }
}
txs.sort((a, b) => a.at - b.at);

// ---------- SQL ----------
const out = [];
const copyRow = (...cols) => cols.map((c) => (c === null ? '\\N' : String(c))).join('\t');

out.push(`
DROP TABLE IF EXISTS transactions, wallets, users;
CREATE TABLE users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wallets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id),
  balance    numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency   text NOT NULL CHECK (currency IN ('VND', 'USD')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE transactions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_wallet_id bigint NOT NULL REFERENCES wallets(id),
  to_wallet_id   bigint NOT NULL REFERENCES wallets(id),
  amount         numeric(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);`);

out.push('COPY users (id, email, name, created_at) FROM stdin;');
for (const u of users) out.push(copyRow(u.id, `user${u.id}@example.com`, u.name, iso(u.created)));
out.push('\\.');

out.push('COPY wallets (id, user_id, balance, currency, created_at) FROM stdin;');
for (const w of wallets) out.push(copyRow(w.id, w.user.id, w.balance.toFixed(2), w.currency, iso(w.created)));
out.push('\\.');

out.push('COPY transactions (id, from_wallet_id, to_wallet_id, amount, created_at) FROM stdin;');
txs.forEach((t, i) => out.push(copyRow(i + 1, t.from, t.to, t.amount.toFixed(2), iso(t.at))));
out.push('\\.');

out.push(`
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('wallets', 'id'), (SELECT max(id) FROM wallets));
SELECT setval(pg_get_serial_sequence('transactions', 'id'), (SELECT max(id) FROM transactions));
ANALYZE;`);

process.stdout.write(out.join('\n') + '\n');
