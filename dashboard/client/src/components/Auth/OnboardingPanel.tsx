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
                w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border
                ${isActive ? "border-green bg-green/15 text-green" : ""}
                ${isDone ? "border-green/40 bg-green/10 text-green/60" : ""}
                ${!isActive && !isDone ? "border-border bg-bg text-text-dim" : ""}
              `}
            >
              {isDone ? "\u2713" : s}
            </div>
            {s < 4 && (
              <div
                className={`w-6 h-px ${s < current ? "bg-green/40" : "bg-border"}`}
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
      className="text-[10px] px-2 py-1 border border-border rounded text-text-dim hover:text-amber hover:border-amber/40 transition-colors"
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
      <div className="text-green text-sm font-bold tracking-wider mb-1">
        {">"} ARENA ONBOARDING
        <span className="cursor-blink">_</span>
      </div>
      <div className="text-text-dim text-xs mb-4">
        Welcome, <span className="text-amber">{user?.username}</span>. Complete
        setup to start copy-trading.
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Private Key ── */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-text-dim text-xs block mb-1">
              PRIVATE KEY
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-sm focus:border-green focus:outline-none font-mono pr-12"
                placeholder="0x..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-amber text-xs transition-colors"
              >
                {showKey ? "HIDE" : "SHOW"}
              </button>
            </div>
          </div>

          <div className="text-text-dim text-[10px] flex items-center gap-1">
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
            className="w-full py-2.5 bg-green/15 border border-green/40 text-green font-bold text-sm rounded tracking-wider hover:bg-green/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {">"} NEXT
          </button>
        </div>
      )}

      {/* ── Step 2: Register Agent ── */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-text-dim text-xs block mb-1">
              AGENT NAME
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-sm focus:border-green focus:outline-none font-mono"
              placeholder="My Trading Agent"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-text-dim text-xs block mb-1">
              AGENT HANDLE
            </label>
            <input
              type="text"
              value={agentHandle}
              onChange={(e) => setAgentHandle(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-text text-sm focus:border-green focus:outline-none font-mono"
              placeholder="my_trading_agent"
              autoComplete="off"
            />
            <div className="text-text-dim text-[10px] mt-1">
              Lowercase, no spaces. Auto-derived from name.
            </div>
          </div>

          <div className="bg-bg border border-border rounded p-2 text-xs">
            <span className="text-text-dim">WALLET: </span>
            <span className="text-amber text-[10px]">
              Will be derived from your private key
            </span>
          </div>

          {registerError && (
            <div className="text-red text-xs py-1">ERR: {registerError}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-border text-text-dim font-bold text-sm rounded tracking-wider hover:text-text hover:border-text-dim transition-colors"
            >
              {"<"} BACK
            </button>
            <button
              type="button"
              onClick={handleRegisterAgent}
              disabled={
                registerLoading || !agentName.trim() || !agentHandle.trim()
              }
              className="flex-1 py-2.5 bg-green/15 border border-green/40 text-green font-bold text-sm rounded tracking-wider hover:bg-green/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* ── Step 3: Claim Agent ── */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          {/* Wallet address */}
          <div className="bg-bg border border-border rounded p-2 text-xs break-all">
            <span className="text-text-dim">WALLET: </span>
            <span className="text-amber font-mono text-[10px]">
              {walletAddress}
            </span>
          </div>

          {/* Verification code */}
          <div className="bg-bg border border-green/40 rounded p-3">
            <div className="text-text-dim text-[10px] mb-2 tracking-wider">
              VERIFICATION CODE
            </div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-green text-sm font-bold break-all">
                {verificationCode}
              </code>
              <CopyButton text={verificationCode} />
            </div>
          </div>

          {/* Claim instructions */}
          <div className="bg-bg border border-border rounded p-3">
            <div className="text-text-dim text-[10px] mb-2 tracking-wider">
              POST THE FOLLOWING FROM YOUR STARSARENA ACCOUNT
            </div>
            <div className="bg-bg-secondary border border-border rounded p-2 text-xs text-text font-mono whitespace-pre-wrap mb-2">
              {claimText}
            </div>
            <div className="flex justify-end">
              <CopyButton text={claimText} />
            </div>
          </div>

          {/* API Key */}
          <div className="bg-bg border border-amber/40 rounded p-3">
            <div className="text-amber text-[10px] mb-2 tracking-wider font-bold">
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
            className="w-full py-2.5 bg-green/15 border border-green/40 text-green font-bold text-sm rounded tracking-wider hover:bg-green/25 transition-colors"
          >
            {">"} I'VE CLAIMED THE AGENT
          </button>
        </div>
      )}

      {/* ── Step 4: Complete Setup ── */}
      {step === 4 && (
        <div className="flex flex-col gap-3">
          {completeLoading && (
            <div className="text-center py-8">
              <div className="text-green text-sm font-bold tracking-wider mb-3">
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
              <div className="text-red text-xs mb-3">ERR: {completeError}</div>
              <button
                type="button"
                onClick={retryComplete}
                className="w-full py-2.5 bg-red/10 border border-red/40 text-red font-bold text-sm rounded tracking-wider hover:bg-red/20 transition-colors"
              >
                {">"} RETRY
              </button>
            </div>
          )}

          {finalWalletAddress && (
            <div className="py-4">
              <div className="text-green text-sm font-bold tracking-wider mb-3">
                {">"} ONBOARDING COMPLETE
                <span className="cursor-blink">{"\u2588"}</span>
              </div>
              <div className="text-green text-xs mb-3">
                Wallet connected and agent registered successfully.
              </div>
              <div className="bg-bg border border-green/30 rounded p-3 text-xs break-all mb-4">
                <span className="text-text-dim">ADDRESS: </span>
                <span className="text-amber font-mono">
                  {finalWalletAddress}
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-green/15 border border-green/40 text-green font-bold text-sm rounded tracking-wider hover:bg-green/25 transition-colors"
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
