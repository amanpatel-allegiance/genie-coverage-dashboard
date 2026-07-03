const express = require('express');
const path = require('path');
const app = express();

const GENIE_BASE = 'https://geniemap.net/api/v1';
const PORT = process.env.PORT || 3010;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Server-side cache: data is fetched once, then served instantly to everyone
let coverageCache = null;
let cacheFetchedAt = 0;
let cacheInProgress = null; // deduplicate concurrent requests

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function genieGet(apiPath, token) {
  const res = await fetch(`${GENIE_BASE}${apiPath}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Genie API error ${res.status} for ${apiPath}`);
  return res.json();
}

async function fetchCoverageData(token) {
  const [me, emirates, districts, amenities, config, companies] = await Promise.all([
    genieGet('/me', token),
    genieGet('/emirates', token),
    genieGet('/districts', token),
    genieGet('/amenities', token),
    genieGet('/config', token),
    genieGet('/companies', token),
  ]);

  const emirateMap = {};
  emirates.forEach(e => { emirateMap[e.id] = e.name; });

  const districtsByEmirate = {};
  districts.forEach(d => {
    const name = emirateMap[d.emirateId] || `Emirate ${d.emirateId}`;
    if (!districtsByEmirate[name]) districtsByEmirate[name] = [];
    // Strip description — it's long text not shown in the UI, just inflates response size
    districtsByEmirate[name].push({ id: d.id, name: d.name });
  });

  const topDevelopers = companies
    .filter(c => c.projectsCount > 0)
    .sort((a, b) => b.projectsCount - a.projectsCount)
    .slice(0, 20)
    .map(c => ({ name: c.name, projects: c.projectsCount, logo: c.logo?.conversions?.xs || null }));

  return {
    user: { name: me.name, company: me.company?.name, role: me.role },
    stats: {
      emirates: emirates.length,
      districts: districts.length,
      developers: companies.filter(c => c.projectsCount > 0).length,
      totalDevelopers: companies.length,
      amenities: amenities.length,
    },
    emirates: emirates.map(e => ({
      id: e.id,
      name: e.name,
      districtCount: (districtsByEmirate[e.name] || []).length,
    })),
    districtsByEmirate,
    topDevelopers,
    unitTypes: config.unitTypes,
    unitLayouts: config.unitLayouts,
    unitFeatures: config.unitFeatures,
    finishes: config.finishes,
    amenities,
    configurationTypes: config.configurationTypes,
  };
}

app.post('/api/auth', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const loginRes = await fetch(`${GENIE_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
      const body = await loginRes.json().catch(() => ({}));
      throw new Error(body.message || `Login failed (${loginRes.status})`);
    }
    const data = await loginRes.json();
    res.json({ token: data.token });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

app.get('/api/coverage', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // Return cached data if still fresh
  if (coverageCache && Date.now() - cacheFetchedAt < CACHE_TTL_MS) {
    console.log('✓ Serving from cache');
    return res.json(coverageCache);
  }

  // Deduplicate: if a fetch is already in progress, wait for it
  if (cacheInProgress) {
    try {
      const data = await cacheInProgress;
      return res.json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Fetch fresh data
  console.log('⟳  Fetching fresh data from Genie…');
  cacheInProgress = fetchCoverageData(token);

  try {
    const data = await cacheInProgress;
    coverageCache = data;
    cacheFetchedAt = Date.now();
    cacheInProgress = null;
    console.log('✓  Data cached successfully');
    res.json(data);
  } catch (e) {
    cacheInProgress = null;
    console.error('✗  Genie fetch failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Force-clear the cache (useful after data updates)
app.post('/api/refresh', (req, res) => {
  coverageCache = null;
  cacheFetchedAt = 0;
  res.json({ ok: true, message: 'Cache cleared. Next request will re-fetch from Genie.' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Genie Coverage Dashboard running at http://localhost:${PORT}`);
  console.log(`   First load: ~5-6s (fetching from Genie)`);
  console.log(`   After that: instant (30-min server cache)\n`);
});
