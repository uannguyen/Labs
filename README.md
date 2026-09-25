# Lab — mini-wallet

> **Một repo duy nhất, lớn dần.** Không tạo project mới cho mỗi topic.
>
> Code sẽ nằm ở `Lab/mini-wallet/` như một git repo riêng. Thư mục `INTERVIEW/` không phải
> git repo nên lồng repo con vào đây không vấn đề gì.

## Vì sao là bài toán ví, không phải bài toán khác

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
- **Mỗi topic thêm một lớp, không viết lại từ đầu.**
- Commit sau mỗi phiên, message ghi rõ phiên nào. Git log chính là bằng chứng tiến độ.

## Lộ trình — thêm dần theo topic

### Từ `On-tap/04-sql-quan-he.md` — 3 phiên cuối tuần (làm trước)

| Phiên | Thêm gì |
|---|---|
| 1 | Docker Postgres. Schema `users` / `wallets` / `transactions` có FK thật. Seed ~100k dòng. 5 query SQL thuần + `EXPLAIN ANALYZE` |
| 2 | Index cho query chậm + đo trước/sau. Composite index thử 2 thứ tự cột. Tái hiện N+1 bằng TypeORM rồi sửa |
| 3 | API transfer có transaction + `SELECT FOR UPDATE`. **Tái hiện deadlock rồi sửa bằng lock ordering.** Bắn 1000 transfer đồng thời, kiểm số dư |

### Từ `On-tap/05-nodejs-internals.md` — 3 phiên cuối tuần

Thêm thư mục `internals/`, các script độc lập (không cần tích hợp vào app):
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

## Stack

Postgres + TypeORM + NestJS — giống hệt `wallet-management` PoC. Không đổi stack để học công
nghệ mới; mục tiêu là học **SQL và internals**, không phải học framework.

Postgres chạy bằng Docker (`docker run` một dòng là đủ, không cần docker-compose).

## XONG cả lab khi

Chạy được **lab phiên 3 của topic 04**: tái hiện deadlock → sửa bằng lock ordering → bắn
1000 transfer đồng thời → **số dư khớp tuyệt đối**.

Đó là mốc duy nhất bắt buộc. Mọi thứ khác là tùy chọn.

---

**Trạng thái:** chưa bắt đầu. Bắt đầu sau khi xong Giai đoạn A + topic 01, 02, 03.
