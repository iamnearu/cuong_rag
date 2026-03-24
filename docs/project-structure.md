# Project Structure

Cấu trúc chính của thư mục `cuong_rag`.

```text
cuong_rag/
├── .env.example
├── docker-compose.yml
├── Makefile
├── README.md
├── INSTRUCTION.md
├── RUNBOOK_12GB_CAMTAY.md
├── RUNBOOK_LOGIC.md
├── TONG_HOP_LOI_VA_CACH_XU_LY.md
├── TAI_LIEU_TOI_UU_MO_RONG_HE_THONG_TUONG_LAI.md
├── docs/
│   ├── README.md
│   ├── infrastructure.md
│   ├── guide.md
│   ├── logic.md
│   ├── technologies.md
│   ├── api-reference.md
│   └── project-structure.md
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── WorkspacesPage.jsx
│   │   │   ├── DocumentsPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── KnowledgeGraphPage.jsx
│   │   │   └── AnalyticsPage.jsx
│   │   ├── api/client.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── public/
│       ├── bot-avatar.svg
│       ├── favicon.ico
│       ├── favicon.png
│       └── manifest.json
├── rag-service/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── Dockerfile
├── ingestion-service/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── utils/
│   ├── requirements.txt
│   └── Dockerfile
├── kg-service/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── Dockerfile
└── skills/
    ├── design-md/
    ├── enhance-prompt/
    ├── react-components/
    ├── remotion/
    ├── shadcn-ui/
    ├── stitch-design/
    └── stitch-loop/
```

## Mô tả ngắn các module

- `frontend`: giao diện người dùng, gọi API backend qua `/api/v1`.
- `rag-service`: service trung tâm cho workspace/docs/chat/query.
- `ingestion-service`: service ingest tài liệu và pipeline parse/index.
- `kg-service`: service đồ thị tri thức.
- `skills`: thư viện kỹ năng/tài nguyên prompt & UI hỗ trợ.
- `docs`: bộ tài liệu vận hành/kỹ thuật được tách theo chủ đề.
