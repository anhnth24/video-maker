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

## Đồ hoạ 2.5D (asset render từ 3D)

Nền chùa và nhân vật **không vẽ tay** mà được dựng bằng Three.js rồi render sẵn ra ảnh:

| File | Nội dung |
|---|---|
| `public/assets/background.png` | Chính điện 3D (tượng Phật, đài sen, hào quang, bàn thờ, lư hương, cột rồng, đèn lồng, sàn đá phản chiếu, bloom) – 1080×1920 |
| `public/assets/layout.json` | Ma trận camera + vị trí ghế/lư hương/nến (mét) để runtime đặt người đúng phối cảnh |
| `public/assets/people_0..3.png` | Sprite sheet 4 kiểu người (áo tràng lam/nâu/trắng/lam đậm, tóc đen/bạc/búi) |
| `public/assets/sprites.json` | Thông tin frame & động tác: `sit`, `stand`, `walkB/F/L/R` (có/không cầm hương), `bow`, `plant` |

Luồng khi có người tặng quà: **đứng dậy → đi ra lối giữa → lên lư hương (cầm 3 nén hương) → vái 3 lạy → cắm hương → quay về → ngồi xuống**.

Render lại asset (sau khi sửa `tools/render/*.js`):

```bash
npm run render-assets            # cả nền và nhân vật
npm run render-assets -- temple  # chỉ nền
npm run render-assets -- sprites # chỉ nhân vật
```

Cần Chromium cho Playwright (`npx playwright install chromium` nếu máy chưa có).
Muốn dùng ảnh nền khác (vd. tranh AI) thì mở `?bg=assets/ten-anh.png`, lưu ý phải khớp phối cảnh với `layout.json`.

## Cấu hình

- `PORT` – cổng (mặc định 3000)
- `SIGN_API_KEY` – API key Euler Stream (tuỳ chọn, giúp kết nối ổn định hơn)
- Số hàng/ghế, vị trí camera: `WORLD` và `makeCamera()` trong `tools/render/temple.js` (render lại sau khi sửa).
- Tốc độ đi, số lạy, thời gian cháy hương: `CFG` trong `public/app.js`.

## API

- `POST /api/connect {username}` / `POST /api/disconnect`
- `POST /api/simulate {type, user:{id,nickname,avatar?}, gift?, text?, count?}` – bắn event giả để test.

> Dùng thư viện không chính thức `tiktok-live-connector`; TikTok có thể thay đổi giao thức bất cứ lúc nào.
