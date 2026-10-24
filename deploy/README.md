# تشغيل RIVÉ كله على سيرفر واحد

المتجر + الأدمن + الباك اند + قاعدة البيانات + n8n على VPS واحد (Contabo Cloud VPS 4).
كل حاجة بتشتغل بـ Docker، وشهادات https أوتوماتيك.

## 1) اشتري السيرفر
- Contabo > Cloud VPS 4، النظام **Ubuntu 24.04**، المكان **Germany**.
- هيبعتلك على الإيميل: **عنوان IP** وكلمة سر `root`.

## 2) وجّه الدومين (egyhosting.com > إدارة DNS لـ riveeg.com)
اعمل 5 سجلات من نوع **A** كلهم بنفس الـ IP بتاع السيرفر:

| الاسم (Host) | النوع | القيمة |
|---|---|---|
| `@` | A | IP السيرفر |
| `www` | A | IP السيرفر |
| `admin` | A | IP السيرفر |
| `api` | A | IP السيرفر |
| `n8n` | A | IP السيرفر |

لو فيه سجلات A قديمة لنفس الأسماء (Vercel مثلًا) امسحها. التغيير ممكن ياخد من دقايق لساعات.

## 3) مفتاح قراءة من GitHub
الأدمن والمتجر ريبوهات خاصة، فالسيرفر محتاج مفتاح قراءة بس:
1. GitHub > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate.
2. Repository access: اختار الثلاث ريبوهات (`rive-backend`, `rive-admin`, `rive-store`).
3. Permissions > Repository > **Contents: Read-only**.
4. انسخ المفتاح (بيظهر مرة واحدة).

## 4) ادخل على السيرفر
من الموبايل: حمّل **Termius**، New Host، حط الـ IP، المستخدم `root`، وكلمة السر.

## 5) شغّل التثبيت
```
curl -fsSL https://raw.githubusercontent.com/hassanmohamed16y-stack/rive-backend/main/deploy/setup.sh -o setup.sh && bash setup.sh
```
- هيسألك عن المفتاح من الخطوة 3، وبعدين على قيم الخدمات (Paymob / Cloudinary / Resend ...). انسخها من Vercel (مشروع rive-backend > Settings > Environment Variables).
- أول بناء ياخد 10-20 دقيقة. في الآخر هيطبعلك الروابط وبيانات دخول الأدمن (`admin@rive.com` + كلمة سر مولّدة). احفظها.

> لو الدومين لسه ما شاورش على السيرفر، شهادات https هتتأخر لحد ما يشاور. مفيش ضرر.

## 6) انقل البيانات الحالية (اختياري)
لو عاوز بياناتك القديمة من Prisma Postgres:
```
bash /opt/rive/rive-backend/deploy/import-db.sh 'postgres://USER:PASS@HOST:5432/DB?sslmode=require'
```
(الرابط المباشر من Prisma Console، مش اللي بيبدأ بـ prisma+postgres). لو فيه 2FA مفعّل، حط `TWO_FACTOR_ENCRYPTION_KEY` القديم في `deploy/.env` وشغّل `update.sh`.

## 7) فعّل ربط الـ AI agent (n8n)
1. افتح `https://n8n.riveeg.com` واعمل حساب صاحب السيرفر.
2. استورد/اعمل الـ workflow P1-01. المفتاح السري بيتقري من `$env.RIVE_AGENT_WEBHOOK_SECRET` (موجود جاهز في n8n).
3. على السيرفر: `nano /opt/rive/rive-backend/deploy/.env` وغيّر `AGENT_EVENTS_ENABLED=false` إلى `true`، وبعدين:
   `cd /opt/rive/rive-backend/deploy && docker compose up -d backend`

## 8) حدّث الروابط عند الخدمات الخارجية
غيّر عنوان الـ webhook عندهم لـ `https://api.riveeg.com/...` بدل رابط Vercel القديم:
- Paymob (callback)
- WhatsApp / Meta (webhook + verify token)

## 9) نسخة احتياطية خارج السيرفر (مهم)
النسخة اليومية على السيرفر نفسه لوحدها مش كفاية: لو السيرفر اتمسح بتضيع معاه. اربطها بمكان خارجي مرة واحدة (مثلًا Backblaze B2، فيه 10 جيجا مجانًا):
1. اعمل حساب B2 وBucket خاص (Private) اسمه مثلًا `rive-backups`، وبعدها App Key جديد وانسخ `keyID` و`applicationKey`.
2. على السيرفر:
   ```
   cd /opt/rive/rive-backend/deploy
   mkdir -p rclone
   docker compose run --rm --entrypoint sh backup -c "apk add --no-cache rclone >/dev/null && rclone config"
   ```
   اختار `n` (New remote)، الاسم `b2`، النوع `Backblaze B2`، وحط `keyID` و`applicationKey`.
3. فعّل الرفع:
   ```
   echo 'BACKUP_RCLONE_REMOTE=b2:rive-backups' >> .env
   docker compose up -d backup
   docker compose exec backup sh /usr/local/bin/backup.sh
   ```
   لازم تلاقي السطر `off-server copy ok`. (ملف `deploy/rclone` فيه مفاتيحك، مش بيترفع على GitHub.)

## بعد كده
- **تحديث بعد أي تعديل:** `bash /opt/rive/rive-backend/deploy/update.sh`
- **نسخ احتياطي:** أوتوماتيك كل يوم 3:30 الصبح في `deploy/backups` (آخر 14 يوم). حمّل نسخة بعيدة من وقت للتاني.
- **حالة الخدمات:** `cd /opt/rive/rive-backend/deploy && docker compose ps`
- **لوج خدمة:** `docker compose logs --tail 100 backend`
- **ملف الإعدادات السري:** `deploy/.env` (مش في git، ماتبعتوش لحد).
