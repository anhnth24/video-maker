# Điện Tam Phúc · TikTok Live overlay

Web overlay kết nối TikTok Live: người xem bình luận để chọn điều ước và được xếp ngồi theo khu; ai tặng quà sẽ đứng dậy, đi lên ban thờ dâng lễ rồi quay về chỗ.

## Chạy

```bash
npm install
npm start               # http://localhost:3000
# hoặc tự kết nối khi khởi động:
TIKTOK_USERNAME=ten_kenh npm start
```

- `http://localhost:3000` – khung cảnh + bảng điều khiển (kết nối, giả lập event).
- `http://localhost:3000/?overlay=1` – chỉ khung cảnh 9:16, dùng làm **Browser Source** trong OBS / TikTok LIVE Studio (1080×1920).

## Điện Tam Phúc – cách chơi

Ba ban thờ: **Thần Tài** (tài lộc) · **Đức Phật** (bình an) · **Nguyệt Lão** (tình duyên), mỗi ban một khu thảm riêng (vàng / xanh / hồng).

| Event TikTok | Hành động |
|---|---|
| Vào phòng (`member`), thả tim | Được xếp ngồi vào khu đang ít người nhất (đổi bằng `?zone=an\|tai\|tinh`) |
| Bình luận có "bình an / sức khoẻ…" | Ngồi khu **Bình An**, mặc áo lam |
| Bình luận có "tài lộc / may mắn / công danh…" | Ngồi khu **Tài Lộc**, mặc áo vàng |
| Bình luận có "tình duyên / tình yêu / hạnh phúc…" | Ngồi khu **Tình Duyên**, mặc áo hồng |
| Tặng quà | Đứng dậy → đi lên ban thờ của khu mình → vái 3 lạy → dâng lễ → về chỗ |
| Mỗi 100 tim | Thả 1 đèn hoa sen |

Loại lễ theo giá trị 1 món quà (sửa trong `TIERS` ở `public/app.js`):

| Quà | Lễ |
|---|---|
| < 5 xu (Hoa hồng…) | Dâng hoa |
| 5–29 xu, hoặc quà tên "TikTok" | Dâng hương (cắm 3 nén, có khói) |
| 30–98 xu | Dâng lễ hoa |
| 99–499 xu | Dâng mâm lễ + hào quang |
| ≥ 500 xu | Lễ trang trọng: hào quang lớn + pháo hoa |

Từ khoá điều ước sửa trong `WISHES` (so khớp không dấu). Hết ghế thì người ngồi lâu, chưa tặng quà sẽ nhường chỗ.

## Đồ hoạ 2.5D (asset render từ 3D)

Nền chùa và nhân vật **không vẽ tay** mà được dựng bằng Three.js rồi render sẵn ra ảnh:

| File | Nội dung |
|---|---|
| `public/assets/background.png` | Điện Tam Phúc 3D (tượng Phật, Thần Tài, Nguyệt Lão, bục thờ, lư hương, 2 bàn lễ, 3 thảm, đèn sen, sàn đá phản chiếu, bloom) – 1080×1920 |
| `public/assets/layout.json` | Ma trận camera + vị trí ghế/lư hương/nến (mét) để runtime đặt người đúng phối cảnh |
| `public/assets/people_0..5.png` | Sprite sheet 6 kiểu người (2 kiểu áo cho mỗi khu: vàng / lam–trắng / hồng) |
| `public/assets/sprites.json` | Thông tin frame & động tác: `sit`, `stand`, `walkB/F/L/R` (có/không cầm hương), `bow`, `plant` |

Render lại asset (sau khi sửa `tools/render/*.js`):

```bash
npm run render-assets            # cả nền và nhân vật (~3 phút)
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
