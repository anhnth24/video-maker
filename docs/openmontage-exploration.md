# Khám phá OpenMontage (calesthio/OpenMontage)

> Báo cáo khám phá repo https://github.com/calesthio/OpenMontage — commit HEAD ngày clone: 2026-09-01.
> Nguồn: đọc trực tiếp README.md, PROJECT_CONTEXT.md, AGENT_GUIDE.md, cấu trúc thư mục `tools/`, `pipeline_defs/`, `skills/` trong repo.

## OpenMontage là gì

OpenMontage tự mô tả là **"hệ thống sản xuất video agentic mã nguồn mở đầu tiên"** (license AGPLv3). Ý tưởng cốt lõi: biến AI coding assistant (Claude Code, Cursor, Copilot, Windsurf, Codex) thành một **studio sản xuất video hoàn chỉnh**. Bạn mô tả video bằng ngôn ngữ tự nhiên, agent lo toàn bộ: research → viết kịch bản → sinh asset (ảnh/video/giọng đọc/nhạc) → dựng → render.

Điểm khác biệt so với các stack "AI video free" thông thường: ngoài video từ ảnh tĩnh (Ken Burns), nó dựng được **video từ footage thật** — build corpus từ stock footage miễn phí và kho lưu trữ mở (Archive.org, NASA, Wikimedia, Pexels...), tìm kiếm semantic bằng CLIP, cắt dựng thành timeline hoàn chỉnh.

## Kiến trúc: Agent-first, không có orchestrator bằng code

**AI agent chính là orchestrator.** Python chỉ cung cấp tools và persistence. Toàn bộ logic điều phối, quyết định sáng tạo, review, chuyển stage nằm trong file hướng dẫn (YAML manifest + Markdown skill) mà agent đọc và làm theo:

```
Agent đọc pipeline manifest (YAML)  →  đọc stage director skill (MD)
→ gọi Python tools (BaseTool)       →  tự review (meta skill)
→ checkpoint (JSON, resumable)      →  trình con người phê duyệt
```

Kiến trúc tri thức 3 lớp:

| Lớp | Vị trí | Vai trò |
|-----|--------|---------|
| 1 | `tools/` + `pipeline_defs/` | "Có gì" — năng lực thực thi + playbook điều phối |
| 2 | `skills/` | "Dùng thế nào" — quy ước và chuẩn chất lượng của OpenMontage |
| 3 | `.agents/skills/` | "Công nghệ hoạt động ra sao" — knowledge pack về công nghệ bên ngoài |

Mỗi stage của pipeline có một **director skill** (file Markdown) dạy agent cách thực thi stage đó. Mọi flow đều theo state machine: `research → proposal → script → scene_plan → assets → edit → compose`.

## 13 pipeline có sẵn (`pipeline_defs/`)

| Pipeline | Sản phẩm |
|----------|----------|
| `animated-explainer` | Video giải thích AI-generated: research, narration, visual, nhạc |
| `animation` | Motion graphics, kinetic typography |
| `avatar-spokesperson` | Video người dẫn dạng avatar |
| `character-animation` | Hoạt hình nhân vật local: rig SVG, pose library, GSAP timeline |
| `cinematic` | Trailer, teaser, mood-driven edit |
| `clip-factory` | Batch clip ngắn được xếp hạng từ một nguồn dài (repurpose cho social) |
| `documentary-montage` | Montage từ corpus footage thật (CLIP-indexed), không cần API trả phí |
| `hybrid` | Footage gốc + visual AI hỗ trợ |
| `localization-dub` | Phụ đề, lồng tiếng, dịch video có sẵn |
| `podcast-repurpose` | Highlight podcast thành video |
| `screen-demo` | Screen recording / walkthrough phần mềm |
| `talking-head` | Video speaker dựa trên footage |
| `framework-smoke` | Test harness |

## Kho công cụ (~100+ tool, 60+ provider)

Tổ chức theo capability, mẫu thiết kế "selector + provider" (1 tool router + 1 tool cho mỗi provider):

- **`tools/video/`** (45 file): Kling (fal.ai + official), Veo, Runway Gen-4, Seedance, MiniMax, Hunyuan, LTX, CogVideo, Grok, HeyGen, Wan local (GPU)...; kèm corpus builder + CLIP clip search, stitch, compose, auto-reframe, green screen.
- **`tools/audio/`**: TTS (ElevenLabs, Google 700+ giọng, OpenAI, Azure, Piper offline miễn phí...), nhạc (Suno, ElevenLabs, Pixabay, Freesound), mixing, enhance.
- **`tools/graphics/`**: FLUX, Imagen, Seedream, Recraft, GPT Image, Grok, local diffusion...; diagram, code snippet, math animation; **3D**: Three.js world, Blender 4.5, Tripo/Hunyuan 3D text-to-3D.
- **`tools/analysis/`**: transcription (WhisperX...), scene detect, frame sampling, video downloader/analyzer, visual QA.
- **`tools/enhancement/`**: upscale, bg remove, face enhance/restore, color grade.
- **`tools/avatar/`, `tools/subtitle/`, `tools/capture/`, `tools/character/`**: talking head, lip sync, sinh SRT/VTT word-level, screen record, hoạt hình nhân vật.

Provider được chọn tự động bằng **scored selector** chấm 7 chiều (task fit, chất lượng, control, reliability, chi phí, latency, continuity), quyết định có log audit đầy đủ. Không lock-in vendor.

## Hai runtime composition

- **Remotion** (React) — mặc định cho explainer data-driven: spring animation, text/stat card, chart, caption word-level kiểu TikTok. Thư mục `remotion-composer/`.
- **HyperFrames** (HTML/CSS/GSAP) — cho brief nặng motion graphics: kinetic typography, product promo, website-to-video, rig nhân vật SVG.

Hệ thống tự chọn runtime lúc proposal (khóa vào `render_runtime`). Hậu kỳ bằng FFmpeg.

## Governance & chất lượng (điểm đáng chú ý)

- **Budget governance** (`config.yaml` + `tools/cost_tracker.py`): mode observe/warn/cap, trần tổng chi (mặc định $10), ngưỡng phê duyệt từng action ($0.50), bắt buộc hỏi trước khi dùng tool trả phí mới.
- **Approval gate**: mọi quyết định sáng tạo (script, storyboard, asset) dừng chờ con người duyệt.
- **Self-review sau render**: ffprobe validation, frame sampling, phân tích audio level, kiểm tra "delivery promise" (chặn render trông như slideshow), kiểm tra phụ đề — video chỉ được trình ra nếu pass.
- **Backlot** (`backlot/`): dashboard local "living storyboard" — xem pipeline chạy realtime, contact sheet duyệt asset theo scene, chi phí từng asset, replay run. Chạy bằng `python -m backlot open`.

## Chạy không cần API key nào

`make setup` là đủ để làm video thật:

| Năng lực | Tool miễn phí |
|----------|---------------|
| Giọng đọc | Piper TTS (offline) |
| Footage mở | Archive.org, NASA, Wikimedia Commons |
| Stock thêm | Pexels, Unsplash, Pixabay (key free) |
| Composition | Remotion / HyperFrames |
| Hậu kỳ + phụ đề | FFmpeg + caption word-level built-in |

Có GPU thì `make install-gpu` mở khóa video generation local (Wan 2.1/2.2, Hunyuan 1.5, LTX2, CogVideo). Chi phí tham khảo từ các demo trong README: phim hoạt hình 60s kiểu Pixar ~$1.33; explainer full setup ~$1–$3.

## Yêu cầu & cách dùng

- Python 3.10+, FFmpeg, Node.js 18+, một AI coding assistant.
- `git clone` → `make setup` → mở project trong AI assistant → gõ prompt, ví dụ:
  - "Make a 60-second animated explainer about how neural networks learn"
  - "Make a 90-second documentary montage about what a city feels like at 4am. Use real footage only."
  - Dán link YouTube/Short/Reel/TikTok làm video tham chiếu → agent phân tích pacing/hook/cấu trúc và đề xuất 2–3 concept kèm ước tính chi phí.
- API key trong `.env` đều optional — thêm key nào mở khóa provider đó (FAL, Atlas Cloud, Kling, ElevenLabs, Suno, OpenAI, Google, Runway, HeyGen...).

## Liên hệ với repo video-maker

`video-maker` hiện mới chỉ có README. Nếu mục tiêu là xây pipeline làm video bằng AI, OpenMontage đáng dùng theo một trong hai cách:

1. **Dùng trực tiếp**: clone/fork OpenMontage, `make setup`, mở bằng Claude Code và prompt — nhanh nhất để có video đầu ra.
2. **Học kiến trúc**: mẫu "agent-first, instruction-driven" (YAML manifest + Markdown director skill + Python tool mỏng + checkpoint JSON + budget governance) là khung tham khảo tốt nếu muốn tự xây video-maker riêng gọn hơn.

Lưu ý license: **AGPLv3** — nếu dựa trên code của nó và cung cấp dưới dạng dịch vụ mạng thì phải mở mã nguồn phần dẫn xuất.

## Ghi chú về việc fork

Session này chỉ có quyền GitHub trên `anhnth24/video-maker` nên không fork được `calesthio/OpenMontage` qua API từ đây (đã thử, bị từ chối). Repo đã được clone local để khám phá. Để fork thật về tài khoản `anhnth24`: bấm **Fork** trên trang GitHub của repo, hoặc mở session Claude Code mới với OpenMontage làm source repo.
