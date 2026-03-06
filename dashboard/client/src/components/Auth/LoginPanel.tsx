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
      <div className="text-green text-sm font-bold tracking-wider mb-5" style={{ textShadow: '0 0 12px rgba(0,255,65,0.3)' }}>
        {">"} AUTHENTICATE<span className="cursor-blink">{"\u2588"}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-3 rounded border border-[#1e2a35]/40 bg-[#151b23]/20">
        <div>
          <label className="text-text-dim text-xs block mb-1.5 tracking-wider">USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2.5 text-text text-sm focus:border-green/60 focus:outline-none font-mono transition-all duration-300 focus:shadow-[0_0_8px_rgba(0,255,65,0.12),inset_0_1px_4px_rgba(0,0,0,0.4)]"
            style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)' }}
            placeholder="enter username"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="text-text-dim text-xs block mb-1.5 tracking-wider">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2.5 text-text text-sm focus:border-green/60 focus:outline-none font-mono transition-all duration-300 focus:shadow-[0_0_8px_rgba(0,255,65,0.12),inset_0_1px_4px_rgba(0,0,0,0.4)]"
            style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)' }}
            placeholder="enter password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="text-red text-xs py-1.5 px-2.5 bg-red/5 border-l-2 border-red/40 rounded-r">
            ERR: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-3 bg-green/10 border border-green/30 text-green font-bold text-sm rounded tracking-wider hover:bg-green/20 hover:border-green/50 hover:shadow-[0_0_16px_rgba(0,255,65,0.15)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}
        >
          {loading ? (
            <span>PROCESSING<span className="cursor-blink">_</span></span>
          ) : (
            "> LOGIN"
          )}
        </button>
      </form>

      <div className="mt-5 text-center">
        <span className="text-text-dim text-[10px] tracking-wider px-3 py-1 rounded-full border border-[#1e2a35]/30 bg-[#151b23]/20">registration coming soon</span>
      </div>
    </div>
  );
}
