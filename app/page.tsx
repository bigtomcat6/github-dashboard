import { shouldShowRepositoryDetails } from "@/lib/auth";
import { formatBytes, formatNumber, getDashboardData } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 86400;

export default async function Home() {
  try {
    const data = await getDashboardData();
    const showRepositoryDetails = shouldShowRepositoryDetails();
    const repos = showRepositoryDetails ? [...data.repositories]
      .sort((a, b) => b.languageBytes - a.languageBytes || b.stars - a.stars || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) : [];

    return (
      <main className="shell">
        <section className="hero card">
          <img src={data.profile.avatar_url} alt={`${data.profile.login} avatar`} />
          <div>
            <p className="eyebrow">GitHub Dashboard MVP</p>
            <h1>{data.profile.name || data.profile.login}</h1>
            <p className="muted">{data.profile.bio || "Privacy-aware GitHub language and repository summary."}</p>
            <div className="chips">
              <span>{data.profile.followers} followers</span>
              <span>{data.meta.privateRepositoriesIncluded ? "private enabled" : "public only"}</span>
              <span>generated {new Date(data.meta.generatedAt).toLocaleString()}</span>
            </div>
          </div>
        </section>

        <section className="stats">
          <Stat label="Repositories" value={formatNumber(data.stats.repositoryCount)} note={`${data.stats.publicRepositoryCount} public / ${data.stats.privateRepositoryCount} private`} />
          <Stat label="Stars" value={formatNumber(data.stats.totalStars)} note="Across indexed repositories" />
          <Stat label="Forks" value={formatNumber(data.stats.totalForks)} note="Across indexed repositories" />
          <Stat label="Language bytes" value={formatBytes(data.stats.totalLanguageBytes)} note={`${data.languages.length} languages detected`} />
        </section>

        <section className="grid">
          <div className="card">
            <div className="section-title">
              <p className="eyebrow">Language aggregation</p>
              <h2>All repository languages</h2>
            </div>
            <div className="language-bar" aria-label="Language percentage bar">
              {data.languages.slice(0, 12).map((lang) => (
                <span key={lang.name} style={{ width: `${lang.percentage}%`, background: lang.color }} title={`${lang.name}: ${lang.percentage.toFixed(1)}%`} />
              ))}
            </div>
            <div className="language-list">
              {data.languages.map((lang) => (
                <div key={lang.name} className="language-row">
                  <span className="dot" style={{ background: lang.color }} />
                  <strong>{lang.name}</strong>
                  <span>{lang.percentage.toFixed(1)}%</span>
                  <span>{formatBytes(lang.bytes)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <p className="eyebrow">Security posture</p>
              <h2>Private repo handling</h2>
            </div>
            <ul className="clean-list">
              <li>GitHub access is handled on the server side.</li>
              <li>The public API is fixed to one configured username.</li>
              <li>Private repository names are {data.meta.privateRepositoryNamesExposed ? "visible" : "masked"}.</li>
              <li>Repository detail visibility is {showRepositoryDetails ? "enabled" : "disabled"}.</li>
              <li>Cache period: {data.meta.revalidateSeconds}s.</li>
            </ul>
            {data.meta.warnings.length > 0 && (
              <div className="warning">
                {data.meta.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            )}
          </div>
        </section>

        {showRepositoryDetails ? (
          <section className="card repo-details-section">
            <div className="section-title split-title">
              <div>
                <p className="eyebrow">Detailed breakdown</p>
                <h2>Every indexed repository</h2>
              </div>
              <p className="muted small-muted">Sorted by indexed language bytes. Each row shows the repo-level language distribution returned by GitHub.</p>
            </div>
            <div className="repo-details">
              {repos.map((repo) => (
                <article key={repo.id} className="repo-detail-card">
                  <div className="repo-detail-header">
                    <div>
                      <h3>{repo.url ? <a href={repo.url}>{repo.fullName}</a> : repo.fullName}</h3>
                      <p>{repo.description || (repo.isPrivate ? "Repository details are hidden." : "No description.")}</p>
                    </div>
                    <div className="repo-size">
                      <strong>{formatBytes(repo.languageBytes)}</strong>
                      <span>{repo.languages.length} languages</span>
                    </div>
                  </div>

                  <div className="mini-language-bar" aria-label={`${repo.fullName} language percentage bar`}>
                    {repo.languages.length > 0 ? repo.languages.map((lang) => (
                      <span key={lang.name} style={{ width: `${lang.percentage}%`, background: lang.color }} title={`${lang.name}: ${lang.percentage.toFixed(1)}%`} />
                    )) : <span className="empty-segment" />}
                  </div>

                  {repo.languages.length > 0 ? (
                    <div className="repo-language-list">
                      {repo.languages.map((lang) => (
                        <div key={lang.name} className="repo-language-row">
                          <span className="dot" style={{ background: lang.color }} />
                          <strong>{lang.name}</strong>
                          <span>{lang.percentage.toFixed(1)}%</span>
                          <span>{formatBytes(lang.bytes)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No language bytes were returned for this repository.</p>
                  )}

                  <div className="repo-meta">
                    <span>{repo.primaryLanguage || "Unknown primary"}</span>
                    <span>Stars {repo.stars}</span>
                    <span>Forks {repo.forks}</span>
                    {repo.isPrivate && <span>Hidden name</span>}
                    {repo.isFork && <span>Fork</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="card repo-details-section">
            <p className="eyebrow">Detailed breakdown hidden</p>
            <h2>Repository-level details are disabled</h2>
            <p className="muted">Set SHOW_REPOSITORY_DETAILS=true to show every indexed repository and its language breakdown.</p>
          </section>
        )}
      </main>
    );
  } catch (error) {
    return <main className="shell"><section className="card error"><h1>Unable to load GitHub data</h1><p>{error instanceof Error ? error.message : "Unknown error"}</p></section></main>;
  }
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="stat card"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>;
}
