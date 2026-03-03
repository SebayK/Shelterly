import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  checks: {
    minLength: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasDigit: boolean;
    hasSpecialChar: boolean;
  };
  label: "Słabe" | "Średnie" | "Silne";
}

interface PasswordStrengthIndicatorProps {
  password: string;
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function computePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecialChar: /[^a-zA-Z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length as 0 | 1 | 2 | 3 | 4 | 5;

  let label: PasswordStrength["label"];
  if (score <= 2) label = "Słabe";
  else if (score <= 3) label = "Średnie";
  else label = "Silne";

  return { score, checks, label };
}

// ---------------------------------------------------------------------------
// Sub-component: requirement row
// ---------------------------------------------------------------------------

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {met ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 text-green-600"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      )}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PasswordStrengthIndicator({ password, visible }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => computePasswordStrength(password), [password]);

  if (!visible) return null;

  const barColor = strength.score <= 2 ? "bg-destructive" : strength.score <= 3 ? "bg-yellow-500" : "bg-green-600";

  const barWidth = `${(strength.score / 5) * 100}%`;

  return (
    <div className="mt-2 space-y-2" aria-live="polite" aria-atomic="true">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: barWidth }} />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{strength.label}</span>
      </div>

      {/* Requirements list */}
      <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2" aria-label="Wymagania hasła">
        <Requirement met={strength.checks.minLength} label="Min. 8 znaków" />
        <Requirement met={strength.checks.hasLowercase} label="Mała litera" />
        <Requirement met={strength.checks.hasUppercase} label="Wielka litera" />
        <Requirement met={strength.checks.hasDigit} label="Cyfra" />
        <Requirement met={strength.checks.hasSpecialChar} label="Znak specjalny" />
      </ul>
    </div>
  );
}
