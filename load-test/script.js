import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 virtual users over 30s
    { duration: '1m', target: 20 },  // Hold at 20 virtual users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 virtual users over 30s
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USER_EMAIL = __ENV.USER_EMAIL || 'user@rive.com';
const USER_PASSWORD =
  __ENV.USER_PASSWORD ||
  __ENV.USER_INITIAL_PASSWORD ||
  'development-only-user-password';

export function setup() {
  // Pre-fetch product list to obtain product slugs and available variant IDs with sufficient stock
  const setupHeaders = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': '10.255.255.1',
  };
  const res = http.get(`${BASE_URL}/api/v1/products`, { headers: setupHeaders });
  let products = [];
  let variantIds = [];

  if (res.status === 200) {
    try {
      const json = res.json();
      if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
        products = json.data;
        const allVariants = [];
        for (const prod of products) {
          if (prod.variants && Array.isArray(prod.variants)) {
            for (const v of prod.variants) {
              if (v.id && (v.stock === undefined || v.stock >= 5)) {
                allVariants.push(v);
              }
            }
          }
        }
        // Prefer variants with higher available stock for sustained order creation load
        allVariants.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        variantIds = allVariants.map((v) => v.id);
      }
    } catch (e) {
      // Setup payload parsing fallback
    }
  }

  return {
    products: products.map((p) => ({ id: p.id, slug: p.slug })),
    variantIds,
  };
}

export default function (data) {
  // Generate a distinct IP address per request so reverse proxy / ThrottlerGuard tracks distinct traffic
  const clientIp = `10.${__VU % 200}.${Math.floor(Math.random() * 200) + 1}.${(__ITER % 250) + 1}`;
  const baseHeaders = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': clientIp,
  };

  const rand = Math.random();

  if (rand < 0.55) {
    // Flow A: GET /api/v1/products (browsing product list) — highest weight (55%)
    const res = http.get(`${BASE_URL}/api/v1/products`, { headers: baseHeaders });
    check(res, {
      'GET /products status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.75) {
    // Flow B: GET /api/v1/products/:id (viewing a single product by slug) — 20% weight
    let slug = 'luna-silk-set';
    if (data && data.products && data.products.length > 0) {
      const randomProd = data.products[Math.floor(Math.random() * data.products.length)];
      slug = randomProd.slug || randomProd.id;
    }
    const res = http.get(`${BASE_URL}/api/v1/products/${slug}`, { headers: baseHeaders });
    check(res, {
      'GET /products/:id status is 200': (r) => r.status === 200,
    });
  } else if (rand < 0.90) {
    // Flow C & D: POST /api/v1/auth/login + GET /api/v1/auth/me — 15% weight
    const loginPayload = JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
      headers: baseHeaders,
    });

    const loginSuccess = check(loginRes, {
      'POST /auth/login status is 201': (r) => r.status === 201,
    });

    if (loginSuccess) {
      const token = loginRes.json('accessToken');
      if (token) {
        const meRes = http.get(`${BASE_URL}/api/v1/auth/me`, {
          headers: {
            ...baseHeaders,
            Authorization: `Bearer ${token}`,
          },
        });
        check(meRes, {
          'GET /auth/me status is 200': (r) => r.status === 200,
        });
      }
    }
  } else {
    // Flow E: POST /api/v1/orders (creating a test order) — 10% weight
    if (data && data.variantIds && data.variantIds.length > 0) {
      const randomVariantId = data.variantIds[Math.floor(Math.random() * data.variantIds.length)];
      const orderPayload = JSON.stringify({
        customerName: 'Load Test Customer',
        customerEmail: USER_EMAIL,
        items: [
          {
            productVariantId: randomVariantId,
            quantity: 1,
          },
        ],
      });

      const orderRes = http.post(`${BASE_URL}/api/v1/orders`, orderPayload, {
        headers: baseHeaders,
      });

      check(orderRes, {
        'POST /orders status is 201': (r) => r.status === 201,
      });
    } else {
      // Fallback if no variant ID was fetched in setup
      const res = http.get(`${BASE_URL}/api/v1/products`, { headers: baseHeaders });
      check(res, {
        'GET /products status is 200': (r) => r.status === 200,
      });
    }
  }

  // Realistic user pacing / think time (0.1s to 0.6s) between user actions
  sleep(Math.random() * 0.5 + 0.1);
}
