# Claude Web × Yalp MCP: kaynaklar, OAuth uygulaması ve operasyon

## 1. Ürün durumu

| Seçenek | Durum |
| ------- | ----- |
| **A — MCP OAuth (Yalp)** | **Uygulandı:** OAuth 2.1 authorization code + PKCE, RFC8414 yetkilendirme sunucusu metadata’sı, RFC9728 korumalı kaynak metadata’sı, HTTP MCP’de Bearer access token + mevcut `yalp_` API anahtarı. |
| **B — Anthropic statik Bearer** | İsteğe bağlı gelecek; [claude-ai-mcp#112](https://github.com/anthropics/claude-ai-mcp/issues/112) ile takip edilebilir. |

Claude Web özel connector: uzak MCP URL + Advanced’te bu sayfada oluşturulan **OAuth Client ID / Secret**; kullanıcı Connect sırasında Yalp’ta oturum açar, araç çağrıları `yalp_at_…` opaque access token ile yapılır.

## 2. Resmi kaynaklar ve spesifikasyon

- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) (redirect callback notları)
- [Anthropic IP adresleri](https://platform.claude.com/docs/en/api/ip-addresses) — barındırıcı güvenlik duvarı için
- [MCP Authorization 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [anthropics/claude-ai-mcp](https://github.com/anthropics/claude-ai-mcp)

## 3. Yalp’te uygulanan uçlar

| Bileşen | Konum |
| ------- | ----- |
| Korumalı kaynak metadata | `GET /.well-known/oauth-protected-resource?resource=<MCP URL>` |
| Yetkilendirme sunucusu metadata | `GET /.well-known/oauth-authorization-server` |
| Authorize | `GET /oauth/authorize` |
| Token | `POST /api/oauth/token` (`grant_type=authorization_code`, PKCE, `client_secret`) |
| MCP HTTP | `POST /api/mcp/stream` — `Authorization: Bearer` ile OAuth token veya `yalp_` API anahtarı |

Veritabanı (Supabase migration `0012_oauth_mcp.sql`): `oauth_clients`, `oauth_authorization_codes`, `oauth_access_tokens`.

## 4. Ortam değişkenleri

- **`YALP_OAUTH_ALLOWED_REDIRECT_URIS`** — Virgül veya boşlukla ayrılmış tam redirect URI listesi. Boşsa varsayılan Anthropic callback URL’leri kullanılır.
- **`YALP_OAUTH_SECRET_PEPPER`** (isteğe bağlı) — OAuth client secret ve token hash’leri için; yoksa `YALP_API_KEY_PEPPER` kullanılır.
- **`YALP_MCP_LEGACY_AUTH_HTTP200`** — `true` ise `tools/call` kimlik hatalarında eski davranış (HTTP 200 + JSON-RPC). Varsayılan: **401** + `WWW-Authenticate`.

`NEXT_PUBLIC_SITE_URL` üretimde MCP ve metadata URL’leriyle aynı köken olmalı (tercihen `https://www.yalp.work`).

## 5. Kontrol listesi (staging / prod)

1. Supabase migration uygulandı mı?
2. `SUPABASE_SERVICE_ROLE_KEY` — token değişimi ve MCP doğrulama için sunucuda mevcut mu?
3. Claude Web ile uçtan uca: OAuth istemcisi oluştur → claude.ai connector + Connect → araç çağrısı.
4. Stdio istemcileri (Cursor, Desktop) — `yalp_` API anahtarı ile regresyon.
5. İhtiyaç halinde `YALP_MCP_LEGACY_AUTH_HTTP200=true` ile eski HTTP istemcilerini geçici destekle.

---

*Bu belge ürün ve operasyonla birlikte güncellenir.*
