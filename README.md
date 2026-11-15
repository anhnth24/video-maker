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

## Đồ hoạ: 2 bộ cảnh

| Bộ cảnh | Mở bằng | Nền | Vị trí ghế / đường đi |
|---|---|---|---|
| `ai` (mặc định) | `/?overlay=1` | `public/assets/ai/background.jpg` – tranh AI 1080×1920 | Đo trực tiếp trên ảnh, sinh bởi `tools/layout-ai.js` |
| `3d` | `/?overlay=1&scene=3d` | `public/assets/3d/background.png` – render từ Three.js | Ma trận camera xuất kèm khi render |

Nhân vật ở cả 2 bộ là sprite render từ model 3D (`people_0..5.png`: 2 kiểu áo cho mỗi khu; động tác `sit`, `stand`, `walk*`, `bow*`, `plant*`). Bộ `ai` dùng góc nhìn thấp (20°) và được tăng độ đậm màu lúc tải (`spriteFilter` trong layout) cho hợp với nền.

### Đổi ảnh nền AI

1. Tạo ảnh 9:16 **không có người, không có chữ**, lưu đè `public/assets/ai/background.jpg` (1080×1920).
2. Nếu bố cục khác ảnh hiện tại: sửa các số đo (đường chân trời, mép thảm, chỗ đứng dâng lễ, miệng lư hương, mặt bàn lễ…) trong `tools/layout-ai.js`.
3. `node tools/layout-ai.js` để sinh lại `layout.json`.

### Render lại asset 3D

```bash
npm run render-assets               # cảnh 3D + người cho cả 2 bộ (~6 phút)
npm run render-assets -- temple     # chỉ nền 3D
npm run render-assets -- sprites:ai # chỉ người cho bộ ai
npm run render-assets -- sprites:3d # chỉ người cho bộ 3d
```

Cần Chromium cho Playwright (`npx playwright install chromium` nếu máy chưa có).

## Cấu hình

- `PORT` – cổng (mặc định 3000)
- `SIGN_API_KEY` – API key Euler Stream (tuỳ chọn, giúp kết nối ổn định hơn)
- Bộ `ai`: số hàng/ghế, vị trí trong `tools/layout-ai.js`. Bộ `3d`: `WORLD` và `makeCamera()` trong `tools/render/temple.js` (render lại sau khi sửa).
- Tốc độ đi, số lạy, thời gian cháy hương: `CFG` trong `public/app.js`.

## API

- `POST /api/connect {username}` / `POST /api/disconnect`
- `POST /api/simulate {type, user:{id,nickname,avatar?}, gift?, text?, count?}` – bắn event giả để test.

> Dùng thư viện không chính thức `tiktok-live-connector`; TikTok có thể thay đổi giao thức bất cứ lúc nào.
