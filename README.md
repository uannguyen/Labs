# Lab — sân tập thực hành

> **Một git repo, nhiều project con.** Mỗi thư mục con là một project độc lập để thử một
> nhóm kiến thức. Hạ tầng dùng chung (Postgres, Kafka, Redis…) chạy bằng Docker ở `infra/`.
>
> Bản thân `Lab/` là git repo (remote `github.com:uannguyen/Labs.git`). Thư mục `INTERVIEW/`
> không phải git repo nên đặt repo ở đây không vướng gì.

## Cấu trúc

```
Lab/
├── infra/docker-compose.yml   # postgres luôn bật; kafka, redis, toxiproxy, jaeger bật theo --profile
├── mini-wallet/               # project chính: SQL (04), auth (02), queue (06)
├── microservices/             # 01b: wallet, payment, partner, notification
├── node-internals/            # 05: script rời, không cần app
└── <topic>/                   # thêm khi có thứ cần thử
```

- Mỗi project tự chạy được, có `README.md` ngắn: thử kiến thức gì, chạy thế nào, thấy gì.
- Project chỉ dùng chung **infra**, không dùng chung code. Cần code của project khác thì copy
  sang (ví dụ `microservices/wallet` khởi đầu bằng bản copy của `mini-wallet`).
- Mỗi project dùng database riêng trên cùng một Postgres (`CREATE DATABASE <project>`), không
  cần mỗi project một container.
- Chỉ tạo project mới khi có một câu hỏi cụ thể cần trả lời bằng thực nghiệm. Không tạo sẵn
  thư mục rỗng.

## Vì sao project chính là bài toán ví

Tái dùng đúng bài toán của `wallet-management` PoC bạn **đã làm ở FV** (NestJS + Postgres +
TypeORM, chuyển tiền giữa ví). Lý do:

1. **Không tốn thời gian nghĩ nghiệp vụ.** Bạn đã hiểu domain này. Toàn bộ thời gian lab dồn
   vào thứ cần học, không vào việc bịa ra một cái to-do app.
2. **Một bài toán phủ 4/6 topic**: SQL (transaction, isolation, index, deadlock, lock),
   auth (JWT + HMAC signature), idempotency, queue. Không cần 4 project.
3. **Kể được trong phỏng vấn.** "Tôi làm lại một engine transfer để đào sâu SQL" nghe có
   mục đích hơn là "tôi làm project học tập".

## Nguyên tắc

- **Không có gì trong repo này liên quan tới dữ liệu công ty.** Schema tự nghĩ, dữ liệu
  seed giả. Nhờ vậy đưa lên GitHub công khai được, làm bằng chứng kỹ thuật cho CV.
- **Xấu cũng được, chạy được là đủ.** Đây là lab, không phải portfolio showcase. Chủ nghĩa
  cầu toàn ở đây là kẻ thù.
- **Trong cùng một project, mỗi topic thêm một lớp, không viết lại từ đầu.**
- Commit sau mỗi phiên, message ghi rõ phiên nào. Git log chính là bằng chứng tiến độ.

## Lộ trình — thêm dần theo topic

### Từ `On-tap/04-sql-quan-he.md` — 3 phiên cuối tuần (làm trước)

| Phiên | Thêm gì |
|---|---|
| 1 | Docker Postgres. Schema `users` / `wallets` / `transactions` có FK thật. Seed ~100k dòng. 5 query SQL thuần + `EXPLAIN ANALYZE` |
| 2 | Index cho query chậm + đo trước/sau. Composite index thử 2 thứ tự cột. Tái hiện N+1 bằng TypeORM rồi sửa |
| 3 | API transfer có transaction + `SELECT FOR UPDATE`. **Tái hiện deadlock rồi sửa bằng lock ordering.** Bắn 1000 transfer đồng thời, kiểm số dư |

### Từ `On-tap/05-nodejs-internals.md` — 3 phiên cuối tuần

Project `node-internals/`, các script độc lập (không cần tích hợp vào app):
thứ tự event loop · `UV_THREADPOOL_SIZE` với crypto vs HTTP · endpoint blocking rồi sửa bằng
stream · ghi file không chờ `drain` rồi sửa bằng `pipeline` · leak bằng `Map` global + heap
snapshot · CPU-bound chuyển sang `worker_threads`.

### Từ `On-tap/02-auth-va-ma-hoa.md` — nếu còn thời gian *(tùy chọn)*

JWT RS256 (tự sinh cặp khóa) · HMAC-SHA256 request signing với canonical request giống cách
bạn làm ở FV · chống replay: timestamp window + nonce dedupe trong Redis. Mục đích: dựng lại
bằng tay thứ đã làm ở công ty, để giải thích được cơ chế chứ không chỉ mô tả.

### Từ `On-tap/06-message-queue.md` — nếu còn thời gian *(tùy chọn)*

Docker Kafka một broker. Publish event `transfer.completed`, hai consumer group cùng đọc →
**tự tay thấy** khác biệt với queue truyền thống. Chỉ cần chạy được, không cần làm gì hay ho.

> Hai mục "tùy chọn" ở trên **không nằm trong định nghĩa XONG** của topic tương ứng.
> Bỏ qua hoàn toàn cũng được.

### Từ `On-tap/01b_microservices-bo-cau-hoi.md` — làm sau lab SQL phiên 3

Lab này bám vào **lỗi và dữ liệu**, không bám vào cách chia service. Mỗi phiên đi theo 3 bước:
tái hiện lỗi, sửa lỗi, rồi ghi lại một câu để nói khi phỏng vấn. Mini-wallet được tách thành
4 service:

- `wallet`: là mini-wallet hiện tại, sở hữu số dư, có debit/credit kèm idempotency key.
- `payment`: orchestrator của saga, có DB riêng gồm `payments`, `outbox`, `saga_state`.
- `partner`: giả lập đối tác, chỉnh bằng env để nó fail, chạy chậm hoặc timeout.
- `notification`: consumer của event `payment.*`, có bảng `inbox` để dedupe.

Infra lấy từ `infra/` với profile `kafka` và `toxiproxy`. Mỗi service có một database riêng
trên Postgres chung (mô phỏng database-per-service). Code đặt ở `microservices/`, script tái
hiện đặt ở `microservices/scripts/Lx-repro.sh`.

| Phiên | Câu 01b | Tái hiện | Sửa |
|---|---|---|---|
| L1 ⭐ | #13 | Ghi DB xong thì `process.exit()` trước khi publish → event mất | Transactional outbox + relay polling `FOR UPDATE SKIP LOCKED` |
| L2 ⭐ | #14, #9 | Relay publish xong crash trước khi đánh dấu → notification gửi 2 lần; client retry → trừ 2 lần | Inbox với unique `message_id` ghi cùng transaction; idempotency key trả response cũ |
| L3 ⭐ | #12 | Partner fail sau khi đã debit ví | Saga orchestration + compensation (refund), đặt pivot ở cuối; kill orchestrator giữa chừng rồi resume từ `saga_state` |
| L4 | #15 | Topic 3 partition không có key → event cùng ví đến sai thứ tự | Key = `walletId` + version trên event, consumer bỏ qua event cũ |
| L5 | #8, #18 | Toxiproxy +5s vào partner, bắn tải bằng autocannon → socket và memory của payment phình lên | Timeout, retry backoff + jitter (chỉ với thao tác idempotent), circuit breaker (`opossum`) |
| L6 | #10, #7 | Truy vết một request lỗi đi qua 3 service | OpenTelemetry + Jaeger; 1 endpoint API composition |

**XONG khi** làm xong L1–L3, vì 3 phiên này phủ #12, #13, #14. L4–L6 là tùy chọn. Nếu dựng
compose mất quá một buổi tối thì bỏ Toxiproxy và Jaeger trước. Nếu máy không đủ RAM cho Kafka
thì thay bằng Redpanda (tương thích Kafka API). Làm xong mỗi phiên thì ghi 3–5 dòng vào
`On-tap/01b` theo mẫu "Tôi đã thấy X khi Y, sửa bằng Z".

Các câu #1–6, #11, #16, #17, #19–21 không cần lab, chỉ cần chuẩn bị để nói.

## Stack

Postgres + TypeORM + NestJS — giống hệt `wallet-management` PoC. Không đổi stack để học công
nghệ mới; mục tiêu là học **SQL và internals**, không phải học framework.

Stack trên áp dụng cho `mini-wallet` và `microservices`. Project thử nghiệm khác chọn stack
nhẹ nhất đủ để thấy vấn đề, script Node thuần cũng được.

Hạ tầng: `docker compose -f infra/docker-compose.yml up -d` bật Postgres. Cần thêm thì bật
theo profile, ví dụ `--profile kafka`. Không cài gì trực tiếp lên máy.

## XONG cả lab khi

Chạy được **lab phiên 3 của topic 04**: tái hiện deadlock → sửa bằng lock ordering → bắn
1000 transfer đồng thời → **số dư khớp tuyệt đối**.

Đó là mốc duy nhất bắt buộc. Mọi thứ khác là tùy chọn.

---

**Trạng thái:** chưa bắt đầu. Bắt đầu sau khi xong Giai đoạn A + topic 01, 02, 03.
