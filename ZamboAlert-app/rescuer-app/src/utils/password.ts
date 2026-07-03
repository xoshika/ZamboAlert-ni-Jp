// Password Policy Checker
export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function checkPasswordPolicy(pass: string): {
  requirements: PasswordRequirements;
  score: number; // 0 to 5
  label: string;
  color: string;
} {
  const reqs = {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[^A-Za-z0-9]/.test(pass),
  };

  const score = Object.values(reqs).filter(Boolean).length;
  let label = "Weak";
  let color = "#ef4444"; // Red

  if (score === 2) {
    label = "Fair";
    color = "#f97316"; // Orange
  } else if (score === 3) {
    label = "Good";
    color = "#eab308"; // Yellow
  } else if (score === 4) {
    label = "Strong";
    color = "#22c55e"; // Green
  } else if (score === 5) {
    label = "Excellent";
    color = "#10b981"; // Emerald
  }

  return { requirements: reqs, score, label, color };
}