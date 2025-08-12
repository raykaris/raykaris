// scripts/generate-progress-svg.js
// Node 18+ (fetch available)
import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USER = process.env.GITHUB_USERNAME || 'raykaris';

const COMMITS_GOAL = parseInt(process.env.COMMITS_GOAL || '5000', 10);
const STARS_GOAL = parseInt(process.env.STARS_GOAL || '200', 10);
const REPOS_GOAL = parseInt(process.env.REPOS_GOAL || '100', 10);

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN is required in env');
  process.exit(1);
}

const graphql = async (query, variables = {}) => {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    console.error('GraphQL errors', JSON.stringify(data.errors, null, 2));
    throw new Error('GraphQL query failed');
  }
  return data.data;
};

async function getStats() {
  // Query user: total commit contributions (from contributionsCollection),
  // total repositories count, and stargazer counts for up to first 100 repos.
  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
        }
        repositories(first: 100, ownerAffiliations: OWNER) {
          totalCount
          nodes {
            stargazerCount
          }
        }
      }
    }
  `;
  const data = await graphql(query, { login: USER });
  const user = data.user;
  const commits = user.contributionsCollection.totalCommitContributions || 0;
  const repos = user.repositories.totalCount || 0;
  const stars = (user.repositories.nodes || []).reduce((s, r) => s + (r.stargazerCount || 0), 0);
  return { commits, repos, stars };
}

function pct(value, goal) {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((value / goal) * 100));
}

function makeRingSVG(label, value, goal, pctValue, color = '#7c3aed') {
  // Simple circular progress SVG (donut)
  const size = 160;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pctValue / 100);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}: ${value} (${pctValue}%)">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#6ee7b7"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
    <style>
      .small { font: 12px 'Segoe UI', Roboto, Arial, sans-serif; fill:#6b7280 }
      .big { font: 700 20px 'Segoe UI', Roboto, Arial, sans-serif; fill:#111827 }
    </style>
  </defs>

  <!-- Background circle -->
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e6e6e6" stroke-width="${stroke}" />

  <!-- Progress circle -->
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none"
    stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round"
    stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
    transform="rotate(-90 ${center} ${center})" />

  <!-- Text -->
  <text x="${center}" y="${center - 6}" class="big" text-anchor="middle">${value}</text>
  <text x="${center}" y="${center + 18}" class="small" text-anchor="middle">${label} • ${pctValue}% of ${goal}</text>
</svg>
`;
  return svg;
}

async function main() {
  try {
    const { commits, repos, stars } = await getStats();
    console.log('Fetched:', { commits, repos, stars });

    const commitsPct = pct(commits, COMMITS_GOAL);
    const starsPct = pct(stars, STARS_GOAL);
    const reposPct = pct(repos, REPOS_GOAL);

    const outDir = path.join(process.cwd(), 'assets');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    fs.writeFileSync(path.join(outDir, 'commits.svg'), makeRingSVG('Commits', commits, COMMITS_GOAL, commitsPct, '#ff7ab6'));
    fs.writeFileSync(path.join(outDir, 'stars.svg'), makeRingSVG('Stars', stars, STARS_GOAL, starsPct, '#f59e0b'));
    fs.writeFileSync(path.join(outDir, 'repos.svg'), makeRingSVG('Repositories', repos, REPOS_GOAL, reposPct, '#60a5fa'));

    console.log('SVGs written to assets/');
  } catch (err) {
    console.error('Error generating SVGs:', err);
    process.exit(1);
  }
}

main();
