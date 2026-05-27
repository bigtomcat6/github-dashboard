export type GitHubProfile = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  updated_at: string;
  owner: { login: string };
};

export type LanguageStat = {
  name: string;
  bytes: number;
  percentage: number;
  color: string;
};

export type DashboardData = {
  profile: GitHubProfile;
  stats: {
    repositoryCount: number;
    publicRepositoryCount: number;
    privateRepositoryCount: number;
    forkCount: number;
    archivedCount: number;
    totalStars: number;
    totalForks: number;
    totalLanguageBytes: number;
  };
  languages: LanguageStat[];
  repositories: Array<{
    id: number;
    name: string;
    fullName: string;
    url: string | null;
    description: string | null;
    primaryLanguage: string | null;
    stars: number;
    forks: number;
    isPrivate: boolean;
    isFork: boolean;
    updatedAt: string;
    pushedAt: string | null;
  }>;
  meta: {
    generatedAt: string;
    username: string;
    usingToken: boolean;
    privateRepositoriesIncluded: boolean;
    privateRepositoryNamesExposed: boolean;
    includeForks: boolean;
    excludedRepos: string[];
    revalidateSeconds: number;
    warnings: string[];
  };
};

type LanguageMap = Record<string, number>;

const API = "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = 10;
const LANGUAGE_CONCURRENCY = 6;
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Shell: "#89e051",
  Dockerfile: "#384d54",
};

const config = {
  username: process.env.GITHUB_USERNAME?.trim() || "bigtomcat6",
  token: process.env.GITHUB_TOKEN?.trim() || "",
  includePrivate: parseBool(process.env.INCLUDE_PRIVATE, true),
  exposePrivateRepoNames: parseBool(process.env.EXPOSE_PRIVATE_REPO_NAMES, false),
  includeForks: parseBool(process.env.INCLUDE_FORKS, false),
  repoAffiliation: process.env.GITHUB_REPO_AFFILIATION?.trim() || "owner",
  excludedRepos: parseCsv(process.env.EXCLUDED_REPOS),
  revalidateSeconds: parseIntEnv(process.env.DASHBOARD_REVALIDATE_SECONDS, 86400),
};

function parseBool(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseCsv(value: string | undefined) {
  return value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

function parseIntEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function headers(token = config.token): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bigtomcat6-github-dashboard",
  };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

function q(path: string, params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return `${path}?${search.toString()}`;
}

async function gh<T>(path: string, token = config.token): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: headers(token),
    next: { revalidate: config.revalidateSeconds },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GitHub API ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }

  return response.json() as Promise<T>;
}

async function pages<T>(pathForPage: (page: number) => string, token = config.token) {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const chunk = await gh<T[]>(pathForPage(page), token);
    items.push(...chunk);
    if (chunk.length < PER_PAGE) break;
  }
  return items;
}

async function repos(warnings: string[]) {
  if (config.token && config.includePrivate) {
    try {
      return pages<GitHubRepository>((page) => q("/user/repos", {
        visibility: "all",
        affiliation: config.repoAffiliation,
        sort: "pushed",
        direction: "desc",
        per_page: PER_PAGE,
        page,
      }));
    } catch (error) {
      warnings.push(`Authenticated repo lookup failed; falling back to public repos. ${error instanceof Error ? error.message : ""}`);
    }
  } else if (!config.token) {
    warnings.push("GITHUB_TOKEN is not configured, so only public repositories are included.");
  }

  return pages<GitHubRepository>((page) => q(`/users/${config.username}/repos`, {
    type: "owner",
    sort: "pushed",
    direction: "desc",
    per_page: PER_PAGE,
    page,
  }), "");
}

function allowed(repo: GitHubRepository) {
  const excluded = config.excludedRepos.map((repoName) => repoName.toLowerCase());
  const names = [repo.name.toLowerCase(), repo.full_name.toLowerCase()];
  if (repo.owner.login.toLowerCase() !== config.username.toLowerCase()) return false;
  if (!config.includeForks && repo.fork) return false;
  return !names.some((name) => excluded.includes(name));
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      output[current] = await fn(items[current]);
    }
  }));
  return output;
}

async function languages(repo: GitHubRepository, warnings: string[]) {
  try {
    return await gh<LanguageMap>(`/repos/${repo.full_name}/languages`);
  } catch (error) {
    const label = repo.private && !config.exposePrivateRepoNames ? "a private repository" : repo.full_name;
    warnings.push(`Skipped languages for ${label}. ${error instanceof Error ? error.message : ""}`);
    return null;
  }
}

function aggregate(maps: LanguageMap[]): LanguageStat[] {
  const totals = new Map<string, number>();
  for (const map of maps) {
    for (const [name, bytes] of Object.entries(map)) {
      totals.set(name, (totals.get(name) || 0) + bytes);
    }
  }
  const total = [...totals.values()].reduce((sum, bytes) => sum + bytes, 0);
  return [...totals.entries()]
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: total > 0 ? (bytes / total) * 100 : 0,
      color: LANGUAGE_COLORS[name] || "#94a3b8",
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

function repoName(repo: GitHubRepository) {
  if (!repo.private || config.exposePrivateRepoNames) return repo.name;
  return "Private repository";
}

function fullName(repo: GitHubRepository) {
  if (!repo.private || config.exposePrivateRepoNames) return repo.full_name;
  return `${config.username}/private`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const warnings: string[] = [];
  const [profile, allRepos] = await Promise.all([
    gh<GitHubProfile>(`/users/${config.username}`, ""),
    repos(warnings),
  ]);
  const filtered = allRepos.filter(allowed);
  const maps = (await mapLimit(filtered, LANGUAGE_CONCURRENCY, (repo) => languages(repo, warnings))).filter((value): value is LanguageMap => value !== null);
  const langStats = aggregate(maps);
  const languageBytes = langStats.reduce((sum, lang) => sum + lang.bytes, 0);
  const publicCount = filtered.filter((repo) => !repo.private).length;
  const privateCount = filtered.length - publicCount;

  return {
    profile,
    stats: {
      repositoryCount: filtered.length,
      publicRepositoryCount: publicCount,
      privateRepositoryCount: privateCount,
      forkCount: filtered.filter((repo) => repo.fork).length,
      archivedCount: filtered.filter((repo) => repo.archived).length,
      totalStars: filtered.reduce((sum, repo) => sum + repo.stargazers_count, 0),
      totalForks: filtered.reduce((sum, repo) => sum + repo.forks_count, 0),
      totalLanguageBytes: languageBytes,
    },
    languages: langStats,
    repositories: filtered.map((repo) => ({
      id: repo.id,
      name: repoName(repo),
      fullName: fullName(repo),
      url: repo.private && !config.exposePrivateRepoNames ? null : repo.html_url,
      description: repo.private && !config.exposePrivateRepoNames ? null : repo.description,
      primaryLanguage: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      isPrivate: repo.private,
      isFork: repo.fork,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
    })),
    meta: {
      generatedAt: new Date().toISOString(),
      username: config.username,
      usingToken: Boolean(config.token),
      privateRepositoriesIncluded: Boolean(config.token && config.includePrivate),
      privateRepositoryNamesExposed: config.exposePrivateRepoNames,
      includeForks: config.includeForks,
      excludedRepos: [...config.excludedRepos],
      revalidateSeconds: config.revalidateSeconds,
      warnings,
    },
  };
}

export function cacheHeaders(): HeadersInit {
  return {
    "Cache-Control": `public, s-maxage=${config.revalidateSeconds}, stale-while-revalidate=${config.revalidateSeconds}`,
  };
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

export function formatBytes(value: number) {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function svgCard(data: DashboardData) {
  const top = data.languages.slice(0, 6);
  const rows = top.map((lang, i) => {
    const y = 78 + i * 20;
    return `<circle cx="26" cy="${y - 4}" r="5" fill="${lang.color}"/><text x="40" y="${y}" fill="#cbd5e1" font-size="13">${escapeXml(lang.name)}</text><text x="430" y="${y}" text-anchor="end" fill="#94a3b8" font-size="13">${lang.percentage.toFixed(1)}%</text>`;
  }).join("");
  const bars = top.reduce((parts, lang) => {
    const width = Math.max(1, (lang.percentage / 100) * 412);
    const x = parts.x;
    parts.html += `<rect x="${x.toFixed(1)}" y="45" width="${width.toFixed(1)}" height="10" fill="${lang.color}"/>`;
    parts.x += width;
    return parts;
  }, { x: 24, html: "" }).html;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="210" role="img" aria-label="GitHub language dashboard"><rect width="460" height="210" rx="18" fill="#0f172a"/><text x="24" y="30" fill="#f8fafc" font-family="Arial" font-size="18" font-weight="700">${escapeXml(data.meta.username)} language profile</text><clipPath id="bar"><rect x="24" y="45" width="412" height="10" rx="5"/></clipPath><g clip-path="url(#bar)">${bars}</g>${rows}<text x="24" y="192" fill="#64748b" font-size="11">${data.stats.repositoryCount} repos · ${formatBytes(data.stats.totalLanguageBytes)} indexed</text></svg>`;
}

function escapeXml(value: string) {
  return value.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[char] || char));
}
