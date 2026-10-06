// Reads the public numbers behind the telemetry images from the GitHub API
// and writes them to data/stats.json. No dependencies.
//
// Every query asks for public data only, so the result is the same with any
// token. A token (GITHUB_TOKEN or GH_TOKEN) only raises the rate limit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOGIN = 'hudson-uchoa';
const FILE = fileURLToPath(new URL('../data/stats.json', import.meta.url));
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

async function api(path) {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': LOGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${path}`);
  return response.json();
}

async function count(kind, query) {
  const result = await api(`search/${kind}?per_page=1&q=${encodeURIComponent(query)}`);
  if (result.incomplete_results) throw new Error(`incomplete search result for: ${query}`);
  return result.total_count;
}

async function ownRepositories() {
  const all = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`users/${LOGIN}/repos?type=owner&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all.filter((repo) => !repo.fork);
  }
}

const yearAgo = new Date();
yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
const since = yearAgo.toISOString().slice(0, 10);

const user = await api(`users/${LOGIN}`);
const repositories = await ownRepositories();

const bytes = new Map();
for (const repo of repositories) {
  const languages = await api(`repos/${LOGIN}/${repo.name}/languages`);
  for (const [name, size] of Object.entries(languages)) bytes.set(name, (bytes.get(name) ?? 0) + size);
}

const stats = {
  login: LOGIN,
  commits: await count('commits', `author:${LOGIN} is:public`),
  commitsLastYear: await count('commits', `author:${LOGIN} is:public author-date:>=${since}`),
  pullRequests: await count('issues', `author:${LOGIN} type:pr is:public`),
  issues: await count('issues', `author:${LOGIN} type:issue is:public`),
  reviews: await count('issues', `reviewed-by:${LOGIN} -author:${LOGIN} type:pr is:public`),
  stars: repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0),
  followers: user.followers,
  repositories: user.public_repos,
  languages: [...bytes]
    .map(([name, size]) => ({ name, bytes: size }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)),
};

const next = `${JSON.stringify(stats, null, 2)}\n`;
const previous = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
if (next === previous) {
  console.log('data/stats.json is up to date');
} else {
  mkdirSync(fileURLToPath(new URL('../data/', import.meta.url)), { recursive: true });
  writeFileSync(FILE, next);
  console.log('data/stats.json updated');
}
