# تقرير مراجعة الكود الشامل — rive-backend

مراجعة مستقلة لكامل المستودع في وضعه الحالي على `main`. لا يحتوي هذا التقرير على أي حلول مفصلة، فقط تشخيص. كل قسم مرتب من الأعلى خطورة إلى الأقل: Critical ثم High ثم Medium ثم Low.

---

## 1. الأمان (Security)

### Critical
لا توجد ملاحظات بمستوى Critical في هذا القسم.

### High
لا توجد ملاحظات بمستوى High في هذا القسم.

### Medium
1. **`src/orders/internal-orders.controller.ts:32-38`** و **`src/seed/seed.controller.ts:36-42`** — endpoints داخلية (`expire-reservations`, `seed-database`) لا تستخدم `JwtAuthGuard` وتعتمد فقط على مقارنة `INTERNAL_CRON_SECRET` عبر `timingSafeStringEqual`. القرار موثّق ومقصود، لكن تسريب أو نسيان ضبط هذا السر في env يفتح endpoint حساس (خصوصًا seed-database) بدون طبقة auth قياسية.
2. **`src/auth/jwt.strategy.ts:6`** — `const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret'` قيمة افتراضية ثابتة (hardcoded fallback) موجودة في الكود؛ الاعتماد الوحيد على فحص `isLocalOnlyEnvironment()` (سطر 20) لمنع استخدامها في الإنتاج يجعله نقطة فشل واحدة (single point of failure).

### Low
3. **`src/auth/optional-jwt-auth.guard.ts:6-16`** — إذا وُجد Header `Authorization` لكن التوكن غير صالح/منتهي، يُرمى `UnauthorizedException` بدل معاملة الطلب كزائر مجهول؛ غموض في العقد السلوكي لاسم "Optional".
4. **`src/auth/auth.service.ts:69-83`** (`issueTokenPair`) — Refresh token يُدوَّر بشكل صحيح لكن لا توجد آلية صريحة لاكتشاف "إعادة استخدام" توكن مُبطَل سابقًا (refresh token reuse detection) لإبطال كل جلسات المستخدم عند الاشتباه بسرقة توكن.
5. **`src/payment/payment.controller.ts:55`** — `const rawBody = req.body as Buffer` بدون فحص نوع فعلي وقت التشغيل، يعتمد كليًا على تسجيل middleware الـ raw body في `app.config.ts:29-31`.

### إيجابيات ملحوظة (بدون خطورة)
- `src/app.config.ts:61-67` — `ValidationPipe` عام بـ `whitelist/forbidNonWhitelisted/forbidUnknownValues/transform` يمنع mass assignment على مستوى الـ framework لكل الـ endpoints.
- `src/products/products.controller.ts:40-64`, `admin-products.controller.ts:16-17`, `categories.controller.ts:31-56`, `upload/upload.controller.ts:28-30` — كل routes الإدارة محمية بـ `JwtAuthGuard + RolesGuard + @Roles('ADMIN')`.
- `src/auth/auth.service.ts:27,39-52` — `sanitizeUser` يستبعد كل الحقول الحساسة (`passwordHash`, `emailVerificationToken`, `passwordResetToken`, `failedLoginAttempts`, `lockedUntil`) من أي استجابة.
- `src/orders/orders.service.ts:332`, `orders.controller.ts:21-35` — فحص ملكية الطلب (`isOrderOwnedByActor` + `timingSafeStringEqual`) يمنع IDOR على الطلبات.

---

## 2. معالجة الأخطاء (Error Handling)

### Critical
1. **`src/products/products.service.ts:172-195`** (`update`) — `try/catch` عام يحوّل **أي** خطأ (بما فيه P2002 تعارض unique على `slug`) إلى `NotFoundException` (404) بدل `ConflictException` (409). تشخيص خاطئ للعميل وإخفاء للخطأ الحقيقي.
2. **`src/products/products.service.ts:197-220`** (`archive`) — نفس النمط بالضبط: أي استثناء يتحول لـ 404 دون تمييز نوع الخطأ الفعلي.

### High
3. **`src/products/products.service.ts:112-170`** (`create`) — لا يوجد أي `try/catch` حول `product.create` رغم وجود قيود unique على `slug` وvariant `sku`؛ تعارض slug مكرر يمر كخطأ Prisma خام للفلتر العام ويرجع 500 بدل 409.
4. **`src/categories/categories.service.ts:38-61`** (`create`) — لا معالجة لـ P2002 على `slug` مكرر؛ يرجع 500 عام بدل 409.
5. **`src/payment/payment.service.ts:62-77`** (استرجاع جلسة Stripe الحالية) — `catch` عام يحوّل أي خطأ (شبكة، Stripe API، مهلة) إلى `BadRequestException` واحد، فيفقد التمييز بين خطأ عابر (retryable) وخطأ طلب فعلي.
6. **`src/payment/payment.service.ts:93-137`** (إنشاء جلسة Stripe) — نفس نمط الـ catch-all حول استدعاء Stripe API عند الإنشاء.

### Medium
7. **`src/payment/payment.service.ts:151-155`** (`constructEvent` للـ webhook) — `catch { throw BadRequestException('Webhook verification failed') }` يخفي أيضًا أخطاء برمجية غير متعلقة بالتوقيع (مثل `webhookSecret` غير معرف) تحت نفس الرسالة.
8. **`src/payment/payment.service.ts:204-209`** (catch حول transaction الـ webhook) — يعالج P2002 فقط (idempotency)؛ أي خطأ آخر (مثل P2025) يُعاد رميه خامًا ليصل للفلتر العام كـ 500.
9. **`src/auth/auth.service.ts:209-219`** (`requestEmailVerification`) — `catch { throw NotFoundException }` عام حول `user.update`، لا يتحقق تحديدًا من كود P2025 فيخفي أي خطأ DB آخر.
10. **`src/products/products.service.ts:362-370`** (`removeImage`) — `findFirst` للتحقق ثم `delete` مباشر بدون `try/catch`؛ حذف متزامن بين الفحص والتنفيذ الفعلي يرمي P2025 خام يتحول لـ 500 بدل 404.
11. **`src/common/filters/http-exception.filter.ts:1-53`** — الفلتر العام لا يترجم أكواد Prisma (`P2002`, `P2025`, ...) إطلاقًا؛ كل الاعتماد على معالجة كل service لأخطائه بنفسه، وهو غير متسق فعليًا كما تُظهر البنود أعلاه (رغم أنه لا يسرّب stack trace، وهذا إيجابي أمنيًا).
12. **`src/audit-log/audit-log.service.ts:18-33`** (`record`) — فشل تسجيل الـ audit log يُبتلع بالكامل (تسجيل log فقط، بلا استثناء)، فلا توجد رؤية/تنبيه عند فشل تسجيل audit حرج.

### Low
لا توجد ملاحظات إضافية بمستوى Low في هذا القسم (بعد استبعاد ما هو مصنّف Medium أعلاه).

### إيجابيات ملحوظة (بدون خطورة)
- `src/orders/orders.service.ts` (`assertTransition`, `markPaidInTransaction`, `cancelPendingOrderInTransaction`) — التعامل مع 404/403/409 هنا متسق وصريح، الأفضل في المستودع.

---

## 3. جودة الكود العامة

### Critical
لا توجد ملاحظات بمستوى Critical في هذا القسم.

### High
1. **`src/orders/orders.service.ts:173-226`** (`transitionStatus`) — سلسلة `if/else if` تتفرع لمسارات مختلفة تمامًا (استعادة مخزون، عدم استعادة، تفويض لـ `markPaidInTransaction`) حسب `nextStatus`؛ يصعب تتبع كل الآثار الجانبية من مكان واحد.
2. **`src/payment/payment.service.ts:175-203`** (`handleWebhook`) — تفرّع حسب `eventType` و`payment_status` مع عدة نقاط `return` بأشكال استجابة مختلفة؛ يصعب تدقيق كل المسارات، خصوصًا حالة "حدث completed لكن غير مدفوع".
3. **`src/auth/jwt-auth.guard.ts:6`** — `handleRequest(err: any, user: any, _info: any, _context)`؛ كل بارامترات callback الخاصة بـ Passport من نوع `any`، يفقد type safety في مسار المصادقة بالكامل.
4. **`src/auth/optional-jwt-auth.guard.ts:11`** — `handleRequest<TUser = any>(err: any, user: TUser, _info: any, ..., _status?: any)`؛ generic يقبل `any` افتراضيًا مع بارامترات إضافية غير مُنمَّطة.

### Medium
5. **`src/payment/payment.service.ts:29-77`** (بداية `createCheckoutSession`) — منطق التحقق من جلسة Stripe موجودة مسبقًا (إعادة استخدام مقابل إنشاء جديدة) متداخل مع catch/throw بشكل يصعب قراءته مباشرة.
6. **`src/payment/payment.service.ts:95-126`** (`createCheckoutSession`) — Race condition نظري: جلسة Stripe تُنشأ خارج أي قفل على `paymentSessionId`، ثم يُحدَّث الطلب بشرط أن يكون الحقل فارغًا؛ طلبان متزامنان على نفس `orderId` قد ينشئا جلستي Stripe مختلفتين ويفشل أحدهما رغم منطق الاسترداد الموجود.
7. **`src/payment/payment.service.ts:158`** — `event.data.object as Stripe.Checkout.Session` تحويل قسري دون التحقق من أن `event.type` فعلًا من نوع checkout.session.* قبل الوصول لحقول الجلسة.
8. **`src/common/filters/http-exception.filter.ts:33-35`** — `(responseBody as any)?.message` و `(responseBody as any).message[0]` بدون type guard؛ لو اختلف شكل الاستجابة يمكن أن يفشل الوصول بصمت أو يقرأ خاصية خاطئة.
9. **`src/audit-log/audit-log.service.ts:25`** — `entry.changes as Prisma.InputJsonValue` تحويل قيمة `unknown` قادمة من مستدعي الخدمة دون تحقق أنها قابلة للتسلسل (serializable) فعلاً.

### Low
10. **`src/orders/orders.service.ts:115-123`** (`create`) — تخفيض المخزون آمن فعليًا (يستخدم `updateMany` بشرط `stock: {gte: quantity}` بشكل ذري ضمن `$transaction`)، لكنه يتم عبر حلقة تسلسلية لكل عنصر بدل عملية دفعة واحدة (batch)؛ ضعف بسيط في الكفاءة لا في الصحة.
11. **`src/common/middleware/request-logging.middleware.ts:10`** — `request as RequestWithContext` بدون تحقق أن الخصائص الإضافية موجودة فعلًا (مخفف بالوصول الآمن `?.` لاحقًا).

### إيجابيات ملحوظة (بدون خطورة)
- `src/payment/payment.service.ts` webhook transaction — الحماية من إعادة معالجة نفس حدث Stripe جيدة (unique constraint على `stripeEventId` + catch لـ P2002)، نمط idempotency صحيح.

---

## 4. قاعدة البيانات (Prisma)

### Critical
لا توجد ملاحظات بمستوى Critical في هذا القسم.

### High
1. **`prisma/schema.prisma:79-101`** (`Product`) — لا يوجد `@@index([status])` ولا `@@index([isFeatured])` رغم أن `src/products/products.service.ts:39-51` يفلتر بشكل متكرر بـ `status` (كل استعلامات المنتجات العامة تستخدم `status: ACTIVE`) و`isFeatured`؛ مع نمو عدد المنتجات هذه full scans متكررة على الاستعلام الأكثر استخدامًا في المتجر.

### Medium
2. **`prisma/schema.prisma`** (`Product.name/description/shortDescription`) مقابل **`src/products/products.service.ts:53-60`** — البحث النصي (`contains`, `mode: insensitive`) بدون أي فهرسة نصية (`pg_trgm`/GIN index)؛ سيتحول لـ sequential scan في Postgres مع نمو البيانات.

### Low
3. **`prisma/schema.prisma:64-77`** (`Category`) — لا `@@index([isFeatured])` رغم استخدامه كفلتر في `src/categories/categories.service.ts:16-20`؛ تأثير محدود حاليًا لصغر عدد الفئات المعتاد.
4. **`src/orders/orders.service.ts:312-318`** (`cancelPendingOrderInTransaction`) — حلقة `for (const item of items) await tx.productVariant.update(...)` تنفذ استعلام كتابة منفصل لكل عنصر طلب بدل عملية مُجمَّعة (batched)؛ يزيد round-trips لقاعدة البيانات مع الطلبات كبيرة العدد.
5. **`prisma/schema.prisma:196-208`** (`AuditLog`) — لا `@@index([createdAt])` رغم احتمال الفرز/الفلترة الزمنية على سجلات تدقيق كبيرة الحجم مستقبلًا.

### إيجابيات ملحوظة (بدون خطورة)
- `prisma/schema.prisma:82` (`Product.slug`) — `@unique` يولّد index تلقائيًا، مغطى بالكامل.
- `prisma/schema.prisma:133-154` (`Order`) — موجود `@@index([userId])` و`@@index([status, reservationExpiresAt])`، الأخير مصمم خصيصًا لدعم `expirePendingReservations` (`src/orders/orders.service.ts:253-257`)، جيد ومدروس.
- `src/products/products.service.ts:12-20` (`productInclude`) و`src/orders/orders.service.ts:22-32` (`orderInclude`) — استخدام `include` لجلب العلاقات المتداخلة (category/images/variants أو items/productVariant/product) في استعلام Prisma واحد بدل حلقة استعلامات منفصلة؛ لا يوجد نمط N+1 فعلي ملحوظ في مسارات القراءة الرئيسية.

---

## ملخص عددي

| القسم | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1. الأمان | 0 | 0 | 2 | 3 |
| 2. معالجة الأخطاء | 2 | 4 | 6 | 0 |
| 3. جودة الكود | 0 | 4 | 5 | 2 |
| 4. قاعدة البيانات | 0 | 1 | 1 | 3 |
| **الإجمالي** | **2** | **9** | **14** | **8** |

هذا تشخيص فقط دون حلول مفصّلة، بانتظار تحديد أيها يستحق الإصلاح أولاً.
