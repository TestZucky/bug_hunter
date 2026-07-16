import type { Challenge } from "@/types/challenge";
import { challenge } from "./_builder";

/**
 * JavaScript / TypeScript challenges.
 * Bug line numbers are 1-indexed against the `code` array.
 */
export const JAVASCRIPT_CHALLENGES: Challenge[] = [
  // ─── EASY ──────────────────────────────────────────────────────────────
  challenge({
    id: "js-off-by-one-001",
    title: "The Missing User",
    filename: "findUser.js",
    language: "javascript",
    difficulty: "easy",
    category: "loops",
    bugType: "off_by_one",
    code: [
      "function findUser(users, id) {",
      "  for (let i = 0; i <= users.length; i++) {",
      "    if (users[i].id === id) {",
      "      return users[i];",
      "    }",
      "  }",
      "  return null;",
      "}",
    ],
    bugLines: [2],
    diagnosis: [
      ["The loop reads one index past the end of the array", true],
      ["The function always returns the first user", false],
      ["The comparison should use == instead of ===", false],
    ],
    fixes: [
      ["for (let i = 0; i < users.length; i++) {", true],
      ["for (let i = 1; i <= users.length; i++) {", false],
      ["for (let i = 0; i <= users.length - 1; i--) {", false],
    ],
    explanation:
      "Array indexes run from 0 to length - 1. Using <= lets i reach users.length, so users[i] is undefined and reading .id throws a TypeError.",
    impact: {
      title: "Request failures detected",
      description:
        "Reading a property of undefined crashed every lookup that walked the full list.",
      severity: "medium",
      metric: "3,450 failed requests",
    },
    tags: ["arrays", "loops", "runtime-error"],
  }),
  challenge({
    id: "js-loose-equality-001",
    title: "Debug Mode Never Turns On",
    filename: "config.js",
    language: "javascript",
    difficulty: "easy",
    category: "conditions",
    bugType: "loose_equality",
    code: [
      "function parseConfig(env) {",
      "  return {",
      "    port: Number(env.PORT) || 3000,",
      "    debug: env.DEBUG == true,",
      "    region: env.REGION || 'us-east',",
      "  };",
      "}",
    ],
    bugLines: [4],
    diagnosis: [
      ["Comparing the string 'true' to boolean true coerces to false", true],
      ["Number() cannot parse the PORT variable", false],
      ["The region fallback overrides the real value", false],
    ],
    fixes: [
      ["debug: env.DEBUG === 'true',", true],
      ["debug: env.DEBUG = true,", false],
      ["debug: Boolean(env.DEBUG == true),", false],
    ],
    explanation:
      "Env vars are strings. 'true' == true coerces the boolean to 1 and the string to NaN, so the result is false. Compare against the string 'true' instead.",
    impact: {
      title: "Silent debug outage",
      description:
        "Debug logging never activated in staging, hiding errors for weeks.",
      severity: "low",
      metric: "2 weeks of missing logs",
    },
    tags: ["coercion", "config", "conditions"],
  }),
  challenge({
    id: "js-null-reference-001",
    title: "The Empty Cart",
    filename: "cart.js",
    language: "javascript",
    difficulty: "easy",
    category: "null_handling",
    bugType: "null_reference",
    code: [
      "function getCartTotal(cart) {",
      "  let total = 0;",
      "  for (const item of cart.items) {",
      "    total += item.price;",
      "  }",
      "  return total;",
      "}",
    ],
    bugLines: [3],
    diagnosis: [
      ["cart or cart.items may be undefined and can't be iterated", true],
      ["total is never initialized", false],
      ["item.price should be item.cost", false],
    ],
    fixes: [
      ["for (const item of cart?.items ?? []) {", true],
      ["for (const item in cart.items) {", false],
      ["for (const item of cart.items || 0) {", false],
    ],
    explanation:
      "When cart is undefined or has no items array, `for...of` throws 'cannot read properties of undefined'. Guard with optional chaining and a default empty array.",
    impact: {
      title: "Checkout crashes for new users",
      description: "Empty or missing carts threw before the page could render.",
      severity: "medium",
      metric: "1,900 broken sessions",
    },
    tags: ["null", "arrays", "defensive"],
  }),
  challenge({
    id: "js-type-mismatch-001",
    title: "Random Sort Order",
    filename: "sortUsers.js",
    language: "javascript",
    difficulty: "easy",
    category: "arrays",
    bugType: "type_mismatch",
    code: [
      "function sortByJoinDate(users) {",
      "  return users",
      "    .map((u) => ({ name: u.name, joinedAt: u.createdAt }))",
      "    .sort((a, b) => a.joinedAt - b.joinedAt);",
      "}",
    ],
    bugLines: [4],
    diagnosis: [
      ["Subtracting ISO date strings yields NaN, so order is undefined", true],
      ["map() removes the id field needed for sorting", false],
      ["sort() mutates the original array", false],
    ],
    fixes: [
      [
        "    .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));",
        true,
      ],
      ["    .sort((a, b) => a.joinedAt > b.joinedAt);", false],
      ["    .sort((a, b) => a.joinedAt.localeCompare(b));", false],
    ],
    explanation:
      "The minus operator coerces the ISO strings to NaN, so the comparator returns NaN and the sort order is unspecified. Convert to Date (or timestamps) before subtracting.",
    impact: {
      title: "Confusing list order",
      description:
        "Users appeared in random order, confusing the support team.",
      severity: "low",
      metric: "3 days of support tickets",
    },
    tags: ["sort", "dates", "coercion"],
  }),
  challenge({
    id: "js-missing-return-001",
    title: "Undefined Discount",
    filename: "pricing.js",
    language: "javascript",
    difficulty: "easy",
    category: "functions",
    bugType: "missing_return",
    code: [
      "function applyDiscount(price, percent) {",
      "  const discounted = price * (1 - percent / 100);",
      "  Math.round(discounted);",
      "}",
      "",
      "const final = applyDiscount(100, 20);",
    ],
    bugLines: [3],
    diagnosis: [
      ["The rounded value is computed but never returned", true],
      ["percent should be divided by 1000", false],
      ["Math.round cannot take a decimal", false],
    ],
    fixes: [
      ["  return Math.round(discounted);", true],
      ["  discounted = Math.round(discounted);", false],
      ["  Math.round(discounted).toFixed(2);", false],
    ],
    explanation:
      "The function computes the rounded price but drops it — with no return statement it yields undefined, so `final` is undefined.",
    impact: {
      title: "NaN prices in the UI",
      description:
        "Order totals rendered as NaN because the discount was undefined.",
      severity: "medium",
      metric: "610 orders showing NaN",
    },
    tags: ["functions", "return", "pricing"],
  }),

  // ─── MEDIUM ────────────────────────────────────────────────────────────
  challenge({
    id: "js-missing-await-001",
    title: "The Pending Profile",
    filename: "profile.js",
    language: "javascript",
    difficulty: "medium",
    category: "async",
    bugType: "missing_await",
    code: [
      "async function fetchProfile(userId) {",
      "  const cached = cache.get(userId);",
      "  if (cached) return cached;",
      "  const res = await fetch(`/api/users/${userId}`);",
      "  const data = res.json();",
      "  cache.set(userId, data);",
      "  return data;",
      "}",
    ],
    bugLines: [5],
    diagnosis: [
      ["res.json() returns a Promise that is never awaited", true],
      ["fetch() should not be awaited", false],
      ["The cache is read before it is populated", false],
    ],
    fixes: [
      ["  const data = await res.json();", true],
      ["  const data = res.json;", false],
      ["  const data = JSON.parse(res);", false],
    ],
    explanation:
      "res.json() is asynchronous. Without await, `data` holds a pending Promise, which is cached and returned instead of the parsed body.",
    impact: {
      title: "Empty profile pages",
      description:
        "Every profile rendered blank because the payload was a Promise.",
      severity: "high",
      metric: "12,000 sessions broken for 6h",
    },
    tags: ["async", "await", "fetch"],
  }),
  challenge({
    id: "js-off-by-one-002",
    title: "The Checkout Crash",
    filename: "checkout.js",
    language: "javascript",
    difficulty: "medium",
    category: "loops",
    bugType: "off_by_one",
    code: [
      "function orderTotal(items, discount) {",
      "  let subtotal = 0;",
      "  for (let i = 0; i <= items.length; i++) {",
      "    subtotal += items[i].price * items[i].qty;",
      "  }",
      "  const tax = subtotal * 0.08;",
      "  return subtotal - discount + tax;",
      "}",
    ],
    bugLines: [3],
    diagnosis: [
      [
        "The loop overshoots by one and reads items[length], which is undefined",
        true,
      ],
      ["Tax should be added before the discount", false],
      ["subtotal should start at items[0].price", false],
    ],
    fixes: [
      ["  for (let i = 0; i < items.length; i++) {", true],
      ["  for (let i = 0; i < items.length + 1; i++) {", false],
      ["  for (let i = 1; i <= items.length; i++) {", false],
    ],
    explanation:
      "On the final iteration items[items.length] is undefined, and reading .price throws — crashing the whole checkout total.",
    impact: {
      title: "Checkout throwing TypeError",
      description: "The order total crashed for any non-empty cart.",
      severity: "high",
      metric: "$180K revenue lost",
    },
    tags: ["loops", "arrays", "checkout"],
  }),
  challenge({
    id: "js-incorrect-mutation-001",
    title: "The Shared State Leak",
    filename: "useCounter.js",
    language: "javascript",
    difficulty: "medium",
    category: "state",
    bugType: "incorrect_mutation",
    code: [
      "function addTodo(state, todo) {",
      "  state.todos.push(todo);",
      "  return state;",
      "}",
      "",
      "const next = addTodo(prevState, newTodo);",
    ],
    bugLines: [2],
    diagnosis: [
      ["Mutating state.todos in place breaks change detection", true],
      ["push() returns the new length, not the array", false],
      ["todo must be cloned before pushing", false],
    ],
    fixes: [
      ["  return { ...state, todos: [...state.todos, todo] };", true],
      ["  state.todos = state.todos.concat(todo); return state;", false],
      ["  state.todos.splice(0, 0, todo); return state;", false],
    ],
    explanation:
      "Directly mutating the previous state means the reference never changes, so React/Redux skip re-rendering. Return a new object with a new array instead.",
    impact: {
      title: "UI not updating",
      description:
        "New todos were saved but never appeared until a full reload.",
      severity: "medium",
      metric: "Ghost bug reported 40+ times",
    },
    tags: ["immutability", "state", "react"],
  }),
  challenge({
    id: "js-wrong-condition-001",
    title: "Everyone Is An Admin",
    filename: "auth.js",
    language: "javascript",
    difficulty: "medium",
    category: "security",
    bugType: "authorization_error",
    code: [
      "function canDelete(user, resource) {",
      "  if (user.role = 'admin') {",
      "    return true;",
      "  }",
      "  return user.id === resource.ownerId;",
      "}",
    ],
    bugLines: [2],
    diagnosis: [
      [
        "Assignment (=) instead of comparison makes the check always true",
        true,
      ],
      ["Admins should not be allowed to delete", false],
      ["resource.ownerId is compared to the wrong field", false],
    ],
    fixes: [
      ["  if (user.role === 'admin') {", true],
      ["  if (user.role = 'admin' && true) {", false],
      ["  if (user.role == admin) {", false],
    ],
    explanation:
      "A single = assigns 'admin' to user.role and evaluates truthy, so every caller passes the admin check and can delete anything.",
    impact: {
      title: "Broken authorization",
      description:
        "Any authenticated user could delete resources they didn't own.",
      severity: "critical",
      metric: "Privilege escalation for all users",
    },
    tags: ["security", "authz", "conditions"],
  }),
  challenge({
    id: "js-unhandled-promise-001",
    title: "The Silent Failure",
    filename: "sendEmail.js",
    language: "javascript",
    difficulty: "medium",
    category: "async",
    bugType: "unhandled_promise",
    code: [
      "function notifyUser(user) {",
      "  try {",
      "    emailService.send(user.email, 'Welcome');",
      "  } catch (err) {",
      "    logger.error('email failed', err);",
      "  }",
      "}",
    ],
    bugLines: [3],
    diagnosis: [
      [
        "send() returns a Promise, so its rejection escapes the try/catch",
        true,
      ],
      ["logger.error needs a third argument", false],
      ["user.email is never validated", false],
    ],
    fixes: [
      ["    await emailService.send(user.email, 'Welcome');", true],
      ["    emailService.send(user.email, 'Welcome').then();", false],
      ["    return emailService.send(user.email, 'Welcome');", false],
    ],
    explanation:
      "A synchronous try/catch cannot catch an async rejection. Without await, the rejected Promise becomes an unhandled rejection and the catch block never runs. (The function must also be async.)",
    impact: {
      title: "Errors swallowed",
      description: "Failed welcome emails were never logged or retried.",
      severity: "medium",
      metric: "8% of signups got no email",
    },
    tags: ["async", "promises", "error-handling"],
  }),

  // ─── HARD ──────────────────────────────────────────────────────────────
  challenge({
    id: "js-race-condition-001",
    title: "The Stuck Rate Limiter",
    filename: "rateLimit.js",
    language: "javascript",
    difficulty: "hard",
    category: "performance",
    bugType: "race_condition",
    code: [
      "async function rateLimit(key, limit) {",
      "  const count = await redis.incr(key);",
      "  if (count === 1) {",
      "    await redis.expire(key, 60);",
      "  }",
      "  return count <= limit;",
      "}",
    ],
    bugLines: [3],
    diagnosis: [
      [
        "Under concurrency the TTL may never be set, so the key never expires",
        true,
      ],
      ["incr should be decr for rate limiting", false],
      ["The limit comparison should be strictly less-than", false],
    ],
    fixes: [
      [
        "  if (count >= 1 && count <= limit) { await redis.expire(key, 60); }",
        false,
      ],
      ["  await redis.expire(key, 60); // always refresh TTL after incr", true],
      ["  if (count !== 1) { await redis.expire(key, 60); }", false],
    ],
    explanation:
      "Only the request that sees count===1 sets the TTL. If two requests increment before either sets it, no one does — the key lives forever and permanently blocks the user. Always set the expiry after incrementing.",
    impact: {
      title: "Permanent lockout",
      description:
        "A race left counters with no TTL, blocking real users indefinitely.",
      severity: "high",
      metric: "340 premium users locked out",
    },
    tags: ["race-condition", "redis", "concurrency"],
  }),
  challenge({
    id: "js-performance-001",
    title: "The N+1 Explosion",
    filename: "orders.js",
    language: "javascript",
    difficulty: "hard",
    category: "performance",
    bugType: "performance_issue",
    code: [
      "async function getOrders(userIds) {",
      "  const orders = [];",
      "  for (const id of userIds) {",
      "    const o = await db.query('SELECT * FROM orders WHERE user=$1', [id]);",
      "    orders.push(o);",
      "  }",
      "  return orders;",
      "}",
    ],
    bugLines: [4],
    diagnosis: [
      ["One awaited query per user creates an N+1 sequential bottleneck", true],
      ["The SQL is vulnerable to injection", false],
      ["orders should be a Map, not an array", false],
    ],
    fixes: [
      [
        "    const o = await db.query('SELECT * FROM orders WHERE user = ANY($1)', [userIds]);",
        true,
      ],
      [
        "    const o = db.query('SELECT * FROM orders WHERE user=$1', [id]);",
        false,
      ],
      ["    const o = await db.query('SELECT * FROM orders', []);", false],
    ],
    explanation:
      "Awaiting one query per id runs them sequentially — 500 users means 500 round-trips. Fetch them in a single query with ANY($1) (or batch/parallelize) instead. Note the correct fix replaces the loop body with one set-based query.",
    impact: {
      title: "Latency spike",
      description:
        "Dashboard load time grew linearly with the number of users.",
      severity: "high",
      metric: "p95 latency 4.2s → timeout",
    },
    tags: ["performance", "database", "n+1"],
  }),
  challenge({
    id: "js-sql-injection-001",
    title: "The Open Query",
    filename: "search.js",
    language: "javascript",
    difficulty: "hard",
    category: "security",
    bugType: "sql_injection",
    code: [
      "async function searchUsers(name) {",
      "  const sql = `SELECT * FROM users WHERE name = '${name}'`;",
      "  const rows = await db.query(sql);",
      "  return rows;",
      "}",
    ],
    bugLines: [2],
    diagnosis: [
      [
        "User input is interpolated straight into SQL, enabling injection",
        true,
      ],
      ["SELECT * is slower than selecting columns", false],
      ["The query is missing a LIMIT clause", false],
    ],
    fixes: [
      [
        "  const rows = await db.query('SELECT * FROM users WHERE name = $1', [name]);",
        true,
      ],
      [
        "  const sql = `SELECT * FROM users WHERE name = '${escape(name)}'`;",
        false,
      ],
      [
        '  const sql = "SELECT * FROM users WHERE name = \'" + name + "\'";',
        false,
      ],
    ],
    explanation:
      "Interpolating `name` into the query lets an attacker inject SQL (e.g. `' OR '1'='1`). Use a parameterized query so the driver escapes the value safely.",
    impact: {
      title: "Data breach risk",
      description: "A crafted name value could dump or delete the users table.",
      severity: "critical",
      metric: "Full table exfiltration possible",
    },
    tags: ["security", "sql", "injection"],
  }),
  challenge({
    id: "js-wrong-status-001",
    title: "The Wrong Signal",
    filename: "handler.js",
    language: "javascript",
    difficulty: "hard",
    category: "api",
    bugType: "wrong_status_code",
    code: [
      "async function getItem(req, res) {",
      "  const item = await db.find(req.params.id);",
      "  if (!item) {",
      "    return res.status(200).json({ error: 'Not found' });",
      "  }",
      "  return res.status(200).json(item);",
      "}",
    ],
    bugLines: [4],
    diagnosis: [
      ["A missing resource returns 200 instead of 404", true],
      ["The success response should be 201", false],
      ["db.find should be awaited twice", false],
    ],
    fixes: [
      ["    return res.status(404).json({ error: 'Not found' });", true],
      ["    return res.status(500).json({ error: 'Not found' });", false],
      ["    return res.status(204).json({ error: 'Not found' });", false],
    ],
    explanation:
      "Returning 200 for a missing item tells clients and caches the request succeeded. Not-found conditions should return 404 so callers can react correctly.",
    impact: {
      title: "Broken client retries",
      description: "Clients cached 'not found' as success and never retried.",
      severity: "medium",
      metric: "Stale 'ghost' items for hours",
    },
    tags: ["api", "http", "status-codes"],
  }),
  challenge({
    id: "js-memory-leak-001",
    title: "The Listener That Never Left",
    filename: "widget.js",
    language: "javascript",
    difficulty: "hard",
    category: "performance",
    bugType: "memory_leak",
    code: [
      "function mount(node) {",
      "  const onResize = () => layout(node);",
      "  window.addEventListener('resize', onResize);",
      "  return function unmount() {",
      "    node.remove();",
      "  };",
      "}",
    ],
    bugLines: [5],
    diagnosis: [
      [
        "The resize listener is never removed on unmount, leaking the node",
        true,
      ],
      ["layout(node) should run on every render", false],
      ["addEventListener needs a capture flag", false],
    ],
    fixes: [
      [
        "    window.removeEventListener('resize', onResize); node.remove();",
        true,
      ],
      ["    window.addEventListener('resize', null); node.remove();", false],
      ["    onResize = null; node.remove();", false],
    ],
    explanation:
      "unmount removes the DOM node but leaves the resize listener attached. The closure keeps `node` alive, so repeated mount/unmount cycles leak memory and stack up handlers.",
    impact: {
      title: "Growing memory footprint",
      description: "Long sessions slowed to a crawl as listeners accumulated.",
      severity: "high",
      metric: "Tab memory grew ~8MB/min",
    },
    tags: ["memory-leak", "dom", "cleanup"],
  }),
];
