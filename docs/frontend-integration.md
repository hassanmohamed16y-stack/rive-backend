# دليل تكامل الفرونت إند — RIVE Backend

مرجع مختصر لأي مطوّر فرونت إند يبدأ التكامل مع الباك إند. للتوصيف الكامل لكل endpoint (DTOs، أمثلة request/response، أكواد الأخطاء) استخدم `openapi.json` في جذر المشروع (مولَّد عبر `npm run export:openapi`، انظر `scripts/export-openapi.ts`) أو Swagger UI المباشر عند تشغيل السيرفر محليًا.

## 1. Base URL والـ prefix

| البند | القيمة |
|---|---|
| Prefix عام لكل الـ API | `/api/v1` (مضاف مباشرة في كل `@Controller(...)`، وليس عبر `app.setGlobalPrefix`) |
| استثناء | `GET /health` — بدون prefix، لفحوصات الجاهزية (load balancer / uptime monitor) |
| مثال | `https://<host>/api/v1/products`, `https://<host>/health` |

## 2. المصادقة

| البند | التفاصيل |
|---|---|
| الآلية | JSON Web Token (JWT) من نوع Bearer، يُرسَل عبر هيدر HTTP القياسي `Authorization` بالصيغة: كلمة `Bearer` متبوعة بمسافة ثم التوكن |
| الحصول على التوكن | `POST /api/v1/auth/register` أو `POST /api/v1/auth/login` يُعيدان `accessToken` + `refreshToken` |
| مدة صلاحية `accessToken` | مضبوطة عبر `JWT_EXPIRATION` (بيئة السيرفر)، افتراضيًا في `.env.example`: `24h` |
| آلية الـ refresh | `POST /api/v1/auth/refresh` مع body يحتوي `refreshToken` القديم؛ يعيد زوج توكنات جديد ويُبطل القديم (تدوير كامل، rotation) |
| تسجيل الخروج | `POST /api/v1/auth/logout` مع `refreshToken` — يُبطل التوكن فقط (لا يتطلب `Authorization`) |
| Endpoints عامة (بدون توكن) | `register`, `login`, `refresh`, `logout`, `forgot-password`, `reset-password`, `verify-email/confirm`, قوائم/تفاصيل `products` و`categories` (القراءة فقط) |
| Endpoints تتطلب `ADMIN` role | كل ما تحت `/api/v1/admin/**`، وكذلك عمليات الكتابة على `products`/`categories`/`upload/image` |
| طلبات الضيوف على الطلبات (`orders`) | لا تتطلب `Authorization`؛ تُستخدَم بدلًا منها `X-Order-Access-Token` (انظر أدناه) |

## 3. الهيدرز الخاصة

| الهيدر | الاستخدام | ملاحظة |
|---|---|---|
| `X-Order-Access-Token` | مطلوب عند جلب/إلغاء/دفع طلب أنشأه **ضيف** (بدون تسجيل دخول) عبر `GET /api/v1/orders/:orderNumber`, `POST /api/v1/orders/:orderNumber/cancel`, `POST /api/v1/payments/create-checkout-session` | يُعاد `guestAccessToken` مرة واحدة فقط عند إنشاء الطلب (`POST /api/v1/orders`) — يجب على الفرونت إند تخزينه (مثلًا في الجلسة/localStorage) لأنه لا يُعاد لاحقًا |
| `x-internal-cron-secret` | مطلوب فقط لـ `POST /api/v1/internal/expire-reservations` | **للاستخدام الداخلي فقط** (cron/scheduler خارجي عبر `INTERNAL_CRON_SECRET`) — **لا يجب أبدًا استدعاؤه من الفرونت إند** أو كشف هذا السر في كود العميل |
| `stripe-signature` | مطلوب فقط لـ `POST /api/v1/payments/webhook`، ويُرسَل حصريًا من Stripe نفسه | غير ذي صلة بالفرونت إند |

## 4. شكل استجابة الأخطاء الموحّد

كل خطأ (أي كود حالة غير 2xx) يمر عبر `HttpExceptionFilter` ويُعاد بنفس الشكل:

```json
{
  "statusCode": 400,
  "timestamp": "2026-01-01T12:00:00.000Z",
  "requestId": "b3f1c2a0-...",
  "path": "/api/v1/orders",
  "method": "POST",
  "error": "Validation failed: quantity must not be less than 1"
}
```

- `statusCode`: كود HTTP القياسي (400, 401, 403, 404, 409, 429, 503, ...).
- `requestId`: معرّف فريد لكل طلب، مفيد لربط شكوى المستخدم بسجلات السيرفر.
- `error`: رسالة نصية واحدة (سلسلة، وليست مصفوفة)، حتى عند فشل تحقق DTO بعدة حقول (تُعرَض أول رسالة فقط).
- لا تُعاد أبدًا تفاصيل داخلية (stack trace) خارج بيئة التطوير.

## 5. شكل الـ pagination الموحّد

كل قائمة (`GET /api/v1/products`, `GET /api/v1/categories`, `GET /api/v1/admin/orders`, `GET /api/v1/admin/products`, ...) تُعيد نفس البنية:

```json
{
  "data": [ /* عناصر الصفحة الحالية */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "totalPages": 7
  }
}
```

- باراميترات الاستعلام: `?page=1&limit=20` (كلاهما اختياريان؛ `limit` الافتراضي 20).
- `totalPages = Math.ceil(total / limit)`.

## 6. توثيق Swagger التفاعلي

- الرابط: `GET /api/docs`.
- **متاح محليًا فقط** (`NODE_ENV=development` أو `NODE_ENV=test`) — بعد إصلاح القفل الأخير (commit `37fd175`) يُعيد أي بيئة أخرى (`production`, `staging`, ...) استجابة `404` على هذا المسار، ولا يُعرَض في الإنتاج عمدًا لأسباب أمنية.
- للحصول على نفس التوصيف في بيئة CI/الإنتاج، استخدم ملف `openapi.json` الثابت في جذر المستودع (`npm run export:openapi` لإعادة توليده).
