import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const envHits   = new Counter('env_hits');      // tagged with env_id and init_type
const throttled = new Rate('throttled');        // share of 429 responses
const status200 = new Counter('status_200');    // OK
const status429 = new Counter('status_429');    // Too Many Requests (throttled)
const statusErr = new Counter('status_other');  // anything else: 403, 5xx, 0 = network error

const URL  = __ENV.URL;
const BUSY = __ENV.BUSY || '1';                 // seconds each request holds a replica
const VUS  = Number(__ENV.VUS || 50);

const scenarios = {
  warm:  { executor: 'shared-iterations', vus: 1, iterations: 10 },
  burst: { executor: 'shared-iterations', vus: VUS, iterations: VUS * 2 },
};

export const options = {
  scenarios: { main: scenarios[__ENV.SCENARIO || 'burst'] },
};

export default function () {
  const res = http.get(`${URL}?busy=${BUSY}`);
  throttled.add(res.status === 429);
  check(res, { 'status is 200': (r) => r.status === 200 });

  if (res.status === 200) {
    status200.add(1);
    const body = res.json();
    envHits.add(1, { env_id: body.env_id, init_type: body.init_type });
  } else if (res.status === 429) {
    status429.add(1);
    sleep(1);   // back off like a well-behaved client
  } else {
    statusErr.add(1, { status: String(res.status) });
    console.warn(`HTTP ${res.status}: ${String(res.body).slice(0, 120)}`);
  }
}