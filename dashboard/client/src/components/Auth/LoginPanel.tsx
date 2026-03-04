import { useState } from "react";
import { useAuth } from "../../hooks/useAuth.js";

export function LoginPanel() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className="text-green text-sm font-bold tracking-wider mb-4">
        {">"} AUTHENTICATE<span className="cursor-blink">█</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-text-dim text-xs block mb-1">USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-sm focus:border-green focus:outline-none font-mono"
            placeholder="enter username"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="text-text-dim text-xs block mb-1">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-sm focus:border-green focus:outline-none font-mono"
            placeholder="enter password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="text-red text-xs py-1">
            ERR: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2.5 bg-green/15 border border-green/40 text-green font-bold text-sm rounded tracking-wider hover:bg-green/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span>PROCESSING<span className="cursor-blink">_</span></span>
          ) : (
            "> LOGIN"
          )}
        </button>
      </form>

      <div className="mt-4 text-center">
        <span className="text-text-dim text-xs">registration coming soon</span>
      </div>
    </div>
  );
}
