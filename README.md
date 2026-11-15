# Chùa Online · TikTok Live overlay

Web overlay kết nối TikTok Live: người vào phòng được xếp ngồi theo hàng; ai tặng quà sẽ đứng dậy, đi lên lư hương thắp hương, vái 3 lạy rồi quay về chỗ.

## Chạy

```bash
npm install
npm start               # http://localhost:3000
# hoặc tự kết nối khi khởi động:
TIKTOK_USERNAME=ten_kenh npm start
```

- `http://localhost:3000` – khung cảnh + bảng điều khiển (kết nối, giả lập event).
- `http://localhost:3000/?overlay=1` – chỉ khung cảnh 9:16, dùng làm **Browser Source** trong OBS / TikTok LIVE Studio (1080×1920).

## Event TikTok → hành động

| Event | Hành động |
|---|---|
| `member` (vào phòng), `chat`, `like` | Được xếp ghế (hàng trên, gần lối giữa trước) |
| `gift` | Mỗi lần tặng = 1 lượt lên thắp hương (tối đa 3 người cùng lúc, còn lại xếp hàng chờ) |
| `chat` | Bong bóng lời nguyện trên đầu + log chat |
| `like` | Mỗi 100 tim thả 1 đèn hoa sen |

Hết ghế: người ngồi lâu nhất, không hoạt động và không có lượt quà chờ sẽ nhường chỗ.

## Cấu hình

- `PORT` – cổng (mặc định 3000)
- `SIGN_API_KEY` – API key Euler Stream (tuỳ chọn, giúp kết nối ổn định hơn)
- `?bg=assets/background.jpg` – thay nền vẽ sẵn bằng ảnh nền riêng (đặt file trong `public/assets/`, tỉ lệ 9:16).
- Bố cục (số hàng, số ghế, tốc độ đi, thời gian vái...) trong `CFG` ở `public/app.js`.

## API

- `POST /api/connect {username}` / `POST /api/disconnect`
- `POST /api/simulate {type, user:{id,nickname,avatar?}, gift?, text?, count?}` – bắn event giả để test.

> Dùng thư viện không chính thức `tiktok-live-connector`; TikTok có thể thay đổi giao thức bất cứ lúc nào.
