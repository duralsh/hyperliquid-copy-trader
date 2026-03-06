import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth.js";

type WizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<WizardStep, string> = {
  1: "PRIVATE KEY",
  2: "REGISTER AGENT",
  3: "CLAIM AGENT",
  4: "COMPLETE SETUP",
};

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {([1, 2, 3, 4] as WizardStep[]).map((s) => {
        const isActive = s === current;
        const isDone = s < current;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`
                w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300
                ${isActive ? "border-green bg-green/15 text-green" : ""}
                ${isDone ? "border-green/40 bg-green/10 text-green/60" : ""}
                ${!isActive && !isDone ? "border-[#1e2a35] bg-[#0a0e14] text-text-dim" : ""}
              `}
              style={isActive ? { boxShadow: '0 0 10px rgba(0,255,65,0.25)' } : undefined}
            >
              {isDone ? "\u2713" : s}
            </div>
            {s < 4 && (
              <div
                className={`w-6 h-px transition-colors duration-300 ${s < current ? "bg-green/40" : "bg-[#1e2a35]"}`}
                style={s < current ? { boxShadow: '0 0 4px rgba(0,255,65,0.15)' } : undefined}
              />
            )}
          </div>
        );
      })}
      <span className="text-text-dim text-[10px] ml-2 tracking-wider">
        STEP {current}/4 &mdash; {STEP_LABELS[current]}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-[10px] px-2.5 py-1 border rounded font-bold tracking-wider transition-all duration-300 ${
        copied
          ? "border-green/40 text-green bg-green/10"
          : "border-[#1e2a35] text-text-dim hover:text-amber hover:border-amber/40 hover:bg-amber/5"
      }`}
    >
      {copied ? "COPIED" : "COPY"}
    </button>
  );
}

export function OnboardingPanel() {
  const { registerAgent, completeOnboarding, user } = useAuth();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1: Private key
  const [privateKey, setPrivateKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Step 2: Agent details
  const [agentName, setAgentName] = useState("");
  const [agentHandle, setAgentHandle] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Step 2 result / Step 3 display
  const [apiKey, setApiKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  // Step 4: Completion
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [finalWalletAddress, setFinalWalletAddress] = useState("");

  // Auto-derive handle from name
  useEffect(() => {
    if (agentName) {
      setAgentHandle(
        agentName
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_{2,}/g, "_")
          .replace(/^_|_$/g, ""),
      );
    }
  }, [agentName]);

  // Step 1 -> Step 2
  const handleNextToRegister = () => {
    if (!privateKey.trim()) return;
    setStep(2);
  };

  // Step 2 -> Step 3
  const handleRegisterAgent = async () => {
    setRegisterError("");
    setRegisterLoading(true);
    try {
      const result = await registerAgent(privateKey, agentName, agentHandle);
      setApiKey(result.apiKey);
      setVerificationCode(result.verificationCode);
      setWalletAddress(result.walletAddress);
      setStep(3);
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Agent registration failed",
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  // Step 3 -> Step 4 (auto-complete)
  const handleClaimed = () => {
    setStep(4);
  };

  // Step 4: auto-run completion
  useEffect(() => {
    if (step !== 4) return;
    if (finalWalletAddress) return; // already done
    if (completeLoading) return;

    let cancelled = false;
    const run = async () => {
      setCompleteLoading(true);
      setCompleteError("");
      try {
        const result = await completeOnboarding(privateKey, apiKey);
        if (!cancelled) {
          setFinalWalletAddress(result.walletAddress);
        }
      } catch (err) {
        if (!cancelled) {
          setCompleteError(
            err instanceof Error ? err.message : "Onboarding completion failed",
          );
        }
      } finally {
        if (!cancelled) {
          setCompleteLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryComplete = async () => {
    setCompleteLoading(true);
    setCompleteError("");
    try {
      const result = await completeOnboarding(privateKey, apiKey);
      setFinalWalletAddress(result.walletAddress);
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : "Onboarding completion failed",
      );
    } finally {
      setCompleteLoading(false);
    }
  };

  const claimText = `I'm claiming my AI Agent "${agentName}"
Verification Code: ${verificationCode}`;

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="text-green text-sm font-bold tracking-wider mb-1" style={{ textShadow: '0 0 12px rgba(0,255,65,0.3)' }}>
        {">"} ARENA ONBOARDING
        <span className="cursor-blink">_</span>
      </div>
      <div className="text-text-dim text-xs mb-4">
        Welcome, <span className="text-amber" style={{ textShadow: '0 0 6px rgba(255,176,0,0.2)' }}>{user?.username}</span>. Complete
        setup to start copy-trading.
      </div>

      <StepIndicator current={step} />

      {/* -- Step 1: Private Key -- */}
      {step === 1 && (
        <div className="flex flex-col gap-3 p-3 rounded border border-[#1e2a35]/40 bg-[#151b23]/20">
          <div>
            <label className="text-text-dim text-xs block mb-1.5 tracking-wider">
              PRIVATE KEY
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2.5 text-text text-sm focus:border-green/60 focus:outline-none font-mono pr-14 transition-all duration-300 focus:shadow-[0_0_8px_rgba(0,255,65,0.12),inset_0_1px_4px_rgba(0,0,0,0.4)]"
                style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)' }}
                placeholder="0x..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-amber text-[10px] font-bold tracking-wider transition-all duration-300 px-1.5 py-0.5 rounded hover:bg-amber/10"
              >
                {showKey ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <div className="text-text-dim text-[10px] flex items-center gap-1.5 px-2 py-1.5 rounded bg-[#0a0e14]/50 border border-[#1e2a35]/20">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="7" width="10" height="7" rx="1" />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" />
            </svg>
            Your key is encrypted with AES-256-GCM at rest
          </div>

          <button
            type="button"
            onClick={handleNextToRegister}
            disabled={!privateKey.trim()}
            className="w-full py-3 bg-green/10 border border-green/30 text-green font-bold text-sm rounded tracking-wider hover:bg-green/20 hover:border-green/50 hover:shadow-[0_0_16px_rgba(0,255,65,0.15)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}
          >
            {">"} NEXT
          </button>
        </div>
      )}

      {/* -- Step 2: Register Agent -- */}
      {step === 2 && (
        <div className="flex flex-col gap-3 p-3 rounded border border-[#1e2a35]/40 bg-[#151b23]/20">
          <div>
            <label className="text-text-dim text-xs block mb-1.5 tracking-wider">
              AGENT NAME
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2.5 text-text text-sm focus:border-green/60 focus:outline-none font-mono transition-all duration-300 focus:shadow-[0_0_8px_rgba(0,255,65,0.12),inset_0_1px_4px_rgba(0,0,0,0.4)]"
              style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)' }}
              placeholder="My Trading Agent"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-text-dim text-xs block mb-1.5 tracking-wider">
              AGENT HANDLE
            </label>
            <input
              type="text"
              value={agentHandle}
              onChange={(e) => setAgentHandle(e.target.value)}
              className="w-full bg-[#0a0e14] border border-[#1e2a35]/60 rounded px-3 py-2.5 text-text text-sm focus:border-green/60 focus:outline-none font-mono transition-all duration-300 focus:shadow-[0_0_8px_rgba(0,255,65,0.12),inset_0_1px_4px_rgba(0,0,0,0.4)]"
              style={{ boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)' }}
              placeholder="my_trading_agent"
              autoComplete="off"
            />
            <div className="text-text-dim text-[10px] mt-1">
              Lowercase, no spaces. Auto-derived from name.
            </div>
          </div>

          <div className="bg-[#0a0e14] border border-[#1e2a35]/40 rounded p-2.5 text-xs">
            <span className="text-text-dim">WALLET: </span>
            <span className="text-amber text-[10px]">
              Will be derived from your private key
            </span>
          </div>

          {registerError && (
            <div className="text-red text-xs py-1.5 px-2.5 bg-red/5 border-l-2 border-red/40 rounded-r">ERR: {registerError}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-[#1e2a35] text-text-dim font-bold text-sm rounded tracking-wider hover:text-text hover:border-[#5a7a94]/40 hover:bg-[#151b23]/30 transition-all duration-300"
            >
              {"<"} BACK
            </button>
            <button
              type="button"
              onClick={handleRegisterAgent}
              disabled={
                registerLoading || !agentName.trim() || !agentHandle.trim()
              }
              className="flex-1 py-2.5 bg-green/10 border border-green/30 text-green font-bold text-sm rounded tracking-wider hover:bg-green/20 hover:border-green/50 hover:shadow-[0_0_16px_rgba(0,255,65,0.15)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}
            >
              {registerLoading ? (
                <span>
                  REGISTERING
                  <span className="cursor-blink">_</span>
                </span>
              ) : (
                "> REGISTER AGENT"
              )}
            </button>
          </div>
        </div>
      )}

      {/* -- Step 3: Claim Agent -- */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          {/* Wallet address */}
          <div className="bg-[#0a0e14] border border-[#1e2a35]/40 rounded p-2.5 text-xs break-all">
            <span className="text-text-dim">WALLET: </span>
            <span className="text-amber font-mono text-[10px]">
              {walletAddress}
            </span>
          </div>

          {/* Verification code */}
          <div className="bg-[#0a0e14] border border-green/30 rounded p-3" style={{ boxShadow: '0 0 8px rgba(0,255,65,0.08)' }}>
            <div className="text-text-dim text-[10px] mb-2 tracking-wider font-bold">
              VERIFICATION CODE
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-green text-sm font-bold break-all" style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}>
                {verificationCode}
              </code>
              <CopyButton text={verificationCode} />
            </div>
          </div>

          {/* Claim instructions */}
          <div className="bg-[#0a0e14] border border-[#1e2a35]/40 rounded p-3">
            <div className="text-text-dim text-[10px] mb-2 tracking-wider font-bold">
              POST THE FOLLOWING FROM YOUR STARSARENA ACCOUNT
            </div>
            <div className="bg-[#151b23]/40 border border-[#1e2a35]/30 rounded p-2.5 text-xs text-text font-mono whitespace-pre-wrap mb-2" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
              {claimText}
            </div>
            <div className="flex justify-end">
              <CopyButton text={claimText} />
            </div>
          </div>

          {/* API Key */}
          <div className="bg-[#0a0e14] border border-amber/30 rounded p-3" style={{ boxShadow: '0 0 8px rgba(255,176,0,0.08)' }}>
            <div className="text-amber text-[10px] mb-2 tracking-wider font-bold" style={{ textShadow: '0 0 6px rgba(255,176,0,0.2)' }}>
              SAVE THIS API KEY &mdash; SHOWN ONLY ONCE
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-amber text-xs font-mono break-all">
                {apiKey}
              </code>
              <CopyButton text={apiKey} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleClaimed}
            className="w-full py-3 bg-green/10 border border-green/30 text-green font-bold text-sm rounded tracking-wider hover:bg-green/20 hover:border-green/50 hover:shadow-[0_0_16px_rgba(0,255,65,0.15)] active:scale-[0.98] transition-all duration-300"
            style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}
          >
            {">"} I'VE CLAIMED THE AGENT
          </button>
        </div>
      )}

      {/* -- Step 4: Complete Setup -- */}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          {completeLoading && (
            <div className="text-center py-8 p-4 rounded border border-[#1e2a35]/40 bg-[#151b23]/20">
              <div className="text-green text-sm font-bold tracking-wider mb-3" style={{ textShadow: '0 0 12px rgba(0,255,65,0.3)' }}>
                COMPLETING ARENA REGISTRATION
                <span className="cursor-blink">_</span>
              </div>
              <div className="text-text-dim text-xs">
                Registering for perps, signing EIP-712 payloads, enabling
                HIP-3...
              </div>
              <div className="text-text-dim text-[10px] mt-2">
                This may take a minute.
              </div>
            </div>
          )}

          {completeError && (
            <div className="py-4">
              <div className="text-red text-xs mb-3 px-2.5 py-1.5 bg-red/5 border-l-2 border-red/40 rounded-r">ERR: {completeError}</div>
              <button
                type="button"
                onClick={retryComplete}
                className="w-full py-3 bg-red/10 border border-red/30 text-red font-bold text-sm rounded tracking-wider hover:bg-red/20 hover:border-red/50 hover:shadow-[0_0_12px_rgba(255,0,64,0.15)] active:scale-[0.98] transition-all duration-300"
              >
                {">"} RETRY
              </button>
            </div>
          )}

          {finalWalletAddress && (
            <div className="py-4">
              <div className="text-green text-sm font-bold tracking-wider mb-3" style={{ textShadow: '0 0 12px rgba(0,255,65,0.3)' }}>
                {">"} ONBOARDING COMPLETE
                <span className="cursor-blink">{"\u2588"}</span>
              </div>
              <div className="text-green text-xs mb-3">
                Wallet connected and agent registered successfully.
              </div>
              <div className="bg-[#0a0e14] border border-green/20 rounded p-3 text-xs break-all mb-4" style={{ boxShadow: '0 0 6px rgba(0,255,65,0.05)' }}>
                <span className="text-text-dim">ADDRESS: </span>
                <span className="text-amber font-mono">
                  {finalWalletAddress}
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-green/10 border border-green/30 text-green font-bold text-sm rounded tracking-wider hover:bg-green/20 hover:border-green/50 hover:shadow-[0_0_16px_rgba(0,255,65,0.15)] active:scale-[0.98] transition-all duration-300"
                style={{ textShadow: '0 0 8px rgba(0,255,65,0.2)' }}
              >
                {">"} CONTINUE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
