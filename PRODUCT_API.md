# توثيق API إنشاء المنتجات - Product API Documentation

هذا المستند يتضمن التوثيق الشامل والمفصل لعملية إنشاء منتج جديد عبر الـ API الخاص بـ RIVÉ (`POST /api/v1/products`) والموجه للوحة التحكم (`rive-admin`) والفرونت اند.

---

## 1. تفاصيل Endpoint

- **رابط الطلب (URL):** `/api/v1/products`
- **نوع الطلب (Method):** `POST`
- **الصلوحيات المطلوب إرسالها (Headers):**
  - `Content-Type: application/json`
  - `Authorization: Bearer <ADMIN_JWT_TOKEN>`

---

## 2. الحقول والقيود (Validation Rules)

تستخدم البيئة `ValidationPipe` في NestJS مع إعدادات حازمة:
- `whitelist: true`: يتم استبعاد أي حقل غير معرّف في DTO.
- `forbidNonWhitelisted: true`: **في حال إرسال حقل غير موجود في DTO (مثل الحقل المجهول `stock` في المستوى الأعلى للطلب)، سينتج عن ذلك خطأ 400 Bad Request برفض الطلب.**

### أ. حقول المنتج الرئيسية (Top-level Payload)

| اسم الحقل | النوع (Type) | مطلوب / اختياري | القيود والتعليمات (Validation Rules & Notes) |
|---|---|---|---|
| `name` | `string` | **مطلوب** | غير فارغ، الحد الأقصى 256 حرف. |
| `slug` | `string` | **مطلوب** | غير فارغ، الطول بين 1 و 256 حرف. يجب أن يطابق صيغة URL slug: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` (أحرف صغيرة، أرقام، وشُرَط فقط). |
| `price` | `number` | **مطلوب** | عدد بحد أقصى خانتين عشريتين، الحد الأدنى 0. (السعر الأساسي للمنتج). |
| `description` | `string` | اختياري | نص الوصف التفصيلي. الحد الأقصى 2000 حرف. (يتضمن تفاصيل وشرح المنتج وسطور الفيديو إن وجدت). |
| `shortDescription` | `string` | اختياري | الوصف المختصر. الحد الأقصى 500 حرف. |
| `seoTitle` | `string` | اختياري | عنوان SEO. الحد الأقصى 256 حرف. |
| `seoDescription` | `string` | اختياري | وصف SEO. الحد الأقصى 500 حرف. |
| `displayOrder` | `number` | اختياري | ترتيب عرض المنتج. عدد صحيح. (الافتراضي: 0). |
| `compareAtPrice` | `number` | اختياري | سعر العرض (السعر قبل الخصم). عدد بحد أقصى خانتين عشريتين، الحد الأدنى 0. عند استخدامه يصبح المنتج ضمن أعيان قسم "عروض / خصومات". |
| `isFeatured` | `boolean` | اختياري | هل المنتج مميز؟ (`true` / `false`). ينقل المنتج إلى أقسام العرض "مميز" و"وصل حديثاً". (الافتراضي: `false`). |
| `status` | `string` (Enum) | اختياري | حالة المنتج: `"DRAFT"`, `"ACTIVE"`, `"PUBLISHED"`, `"ARCHIVED"`. (الافتراضي: `"ACTIVE"`). |
| `categorySlug` | `string` | اختياري | `slug` الفئة المحصورة بالمنتج (مثل: `"lingerie"` أو `"under-200-egp"` أو `"new-arrivals"`). إذا لم يتم إرسال الحقل، يتم ربطه تلقائياً بالفئة الافتراضية `"uncategorized"`. |
| `images` | `Array<ProductImageDto>` | اختياري | مصفوفة الصور (حد أقصى 20 صورة). أنظر التفاصيل أدناه. |
| `variants` | `Array<ProductVariantDto>` | اختياري | مصفوفة المقاسات/الألوان والتخزين (حد أقصى 100). أنظر التفاصيل أدناه. **ملاحظة:** إذا تم إهمال المصفوفة، يتم إنشاء variant افتراضي بسعر المنتج وقيمة stock = 0 و SKU تلقائي (`{SLUG}-DEFAULT`). |

⚠️ **تنبيهات هامة للفرونت اند وروابط المجموعات/الفيديو:**
1. **لا تُرسل حقل `stock` في المستوى الأعلى من الطلب (`root`)**! تم إغلاق حقل `stock` من المستوى الأعلى في الباك اند لحساب المخزون لكل Variant بشكل دقيق. إرسال `stock` في المستوى الأعلى يؤدي لرفض الطلب برسالة `property stock should not exist`.
2. المخزون ينتمي دائماً إلى الـ **`variants`** داخل كل عنصر عبر حقل **`stock`**.
3. **أقسام العرض والمجموعات (مميز، وصل حديثًا، عروض، لانجري، أقل من 200 جنيه):**
   - **مميز / وصل حديثاً:** يتم تعيينه عبر `isFeatured: true`.
   - **عروض:** يتم تعيينه تلقائياً عند تحديد `compareAtPrice` أعلى من `price`.
   - **لانجري / أقل من 200 جنيه:** يتم تصنيفه عبر `categorySlug` (مثل `"lingerie"` أو `"under-200"`) أو عبر الاستعلام بمحرك التصفية (`minPrice`/`maxPrice`).
4. **رابط الفيديو (Video URL):** في حال وجود رابط فيديو توضيحي للمنتج، يتم تضمينه داخل حقل `description` بتنسيق HTML embedded iframe أو رابط الميديا، لضمان عدم وجود حقول غير مسموحة بـ DTO strict whitelist.

---

### ب. تفاصيل مصفوفة الصور (`images`)

كل عنصر داخل مصفوفة `images`:

| اسم الحقل | النوع | مطلوب / اختياري | القيود |
|---|---|---|---|
| `url` | `string` | **مطلوب** | رابط HTTP/HTTPS صحيح لا يتجاوز 2048 حرف. |
| `altText` | `string` | اختياري | النص البديل للصورة، حد أقصى 500 حرف. |
| `isPrimary` | `boolean` | اختياري | هل هي الصورة الرئيسية للمنتج؟ (الافتراضي: `false`). |

---

### ج. تفاصيل مصفوفة الأنواع والمخزون (`variants`)

كل عنصر داخل مصفوفة `variants`:

| اسم الحقل | النوع | مطلوب / اختياري | القيود |
|---|---|---|---|
| `sku` | `string` | **مطلوب** | رمز التخزين الفريد (SKU) للمتغير، غير فارغ، حد أقصى 128 حرف. (مثال: `LUNA-SET-S-BEIGE`). |
| `size` | `string` (Enum) | **مطلوب** | قيمة القائمة المحصورة لـ Size: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`. |
| `price` | `number` | **مطلوب** | سعر هذا المتغير المحدد (حد أقصى خانتين عشريتين، أدنى قيمة 0). |
| `colorHex` | `string` | اختياري | كود اللون بأسلوب Hex (مثال: `#945958` أو `#FFF`). (الافتراضي: `#945958`). |
| `stock` | `number` | اختياري | **كمية المخزون لهذه المتغير**. عدد صحيح غير سالب. (الافتراضي: `0`). |
| `isAvailable` | `boolean` | اختياري | حالة توفر المتغير للشراء. (الافتراضي: `true`). |

---

## 3. أمثلة للطلبات (JSON Examples)

### أ. مثال أبسط طلب ممكن (Minimal Payload - الحقول المطلوبة فقط)

```json
{
  "name": "فستان حرير أسود",
  "slug": "black-silk-dress",
  "price": 450
}
```

### ب. مثال طلب كامل ومتقدم (Full Payload)

يتضمن جميع الحقول الاختيارية والمستويات الفرعية (الصور، المخزون، المقاسات، سعر العرض، أقسام العرض، الفئة، رابط الفيديو داخل الوصف):

```json
{
  "name": "طقم لونا الحريري",
  "slug": "luna-silk-set",
  "description": "طقم أنيق مصنوع من أنقى أنواع الحرير الطبيعي لراحة وأناقة فاخرة.\n\n<iframe src=\"https://www.youtube.com/embed/example-video-id\"></iframe>",
  "shortDescription": "طقم حريري لمس فاخر - عرض خاص أقل من 200 جنيه",
  "seoTitle": "طقم لونا الحريري | RIVÉ",
  "seoDescription": "تسوقي طقم لونا الحريري الفاخر من تشكيلة RIVÉ الجديدة.",
  "price": 180,
  "compareAtPrice": 250,
  "isFeatured": true,
  "status": "ACTIVE",
  "displayOrder": 1,
  "categorySlug": "lingerie",
  "images": [
    {
      "url": "https://images.example.com/luna-front.jpg",
      "altText": "طقم لونا الحريري - العرض الأمامي",
      "isPrimary": true
    },
    {
      "url": "https://images.example.com/luna-back.jpg",
      "altText": "طقم لونا الحريري - العرض الخلفي",
      "isPrimary": false
    }
  ],
  "variants": [
    {
      "sku": "LUNA-SILK-S",
      "size": "S",
      "colorHex": "#945958",
      "price": 180,
      "stock": 15,
      "isAvailable": true
    },
    {
      "sku": "LUNA-SILK-M",
      "size": "M",
      "colorHex": "#945958",
      "price": 180,
      "stock": 20,
      "isAvailable": true
    },
    {
      "sku": "LUNA-SILK-L",
      "size": "L",
      "colorHex": "#945958",
      "price": 180,
      "stock": 10,
      "isAvailable": true
    }
  ]
}
```

---

## 4. أسباب الأخطاء الشائعة وحلها للفرونت اند

1. **خطأ `property stock should not exist` (400 Bad Request):**
   - **السبب:** إرسال حقل `stock` في أعلى مستوى للطلب JSON.
   - **الحل:** إزالة `stock` من الأعلى ووضعه داخل عناصر المصفوفة `variants: [{ sku: "...", size: "S", price: 180, stock: 10 }]`.

2. **خطأ `sku should not be empty` أو `size must be one of...` (400 Bad Request):**
   - **السبب:** عند إرسال مصفوفة `variants` بدون إدخال `sku` أو إرسال مقاس غير موجود في القائمة المحصورة (`Size` enum).
   - **الحل:** تأكد من إرسال `sku` و `size` و `price` لكل variant. المقاسات المقبولة حالياً هي: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`.

3. **خطأ `Category "..." was not found` (404 Not Found):**
   - **السبب:** إرسال `categorySlug` لفئة غير موجودة بقاعدة البيانات.
   - **الحل:** تأكد من إرسال `categorySlug` صحيح موجِد مسبقاً، أو اتركه فارغاً لربط المنتج تلقائياً بفئة `"uncategorized"`.
