import {
  Building01Icon,
  ChartLineData01Icon,
  Compass01Icon,
  Exchange01Icon,
  ViewIcon,
  File01Icon,
  File02Icon,
  FlashIcon,
  Home01Icon,
  Key01Icon,
  Link01Icon,
  MoneyBag01Icon,
  MoneySend01Icon,
  Rocket01Icon,
  SentIcon,
  SquareLock01Icon,
  StarIcon,
  UserCircleIcon,
  Wallet01Icon,
} from "@/lib/icons";

type ContractMarkIcon = typeof File01Icon;

const CONTRACT_MARKS: Record<string, { color: string; Icon: ContractMarkIcon }> = {
  CCF: { color: "#10b981", Icon: Wallet01Icon },
  ESCROW: { color: "#14b8a6", Icon: Building01Icon },
  GQMPROP: { color: "#6366f1", Icon: File02Icon },
  MLM: { color: "#ec4899", Icon: Link01Icon },
  MSVAULT: { color: "#64748b", Icon: Key01Icon },
  NOST: { color: "#a855f7", Icon: File02Icon },
  PULSE: { color: "#f43f5e", Icon: FlashIcon },
  QBAY: { color: "#e11d48", Icon: StarIcon },
  QBOND: { color: "#22c55e", Icon: File02Icon },
  QDRAW: { color: "#f97316", Icon: MoneyBag01Icon },
  QDUEL: { color: "#f43f5e", Icon: Compass01Icon },
  QIP: { color: "#ef4444", Icon: Rocket01Icon },
  QPAYHUB: { color: "#06b6d4", Icon: MoneySend01Icon },
  QPUMP: { color: "#22c55e", Icon: Rocket01Icon },
  QRAFFLE: { color: "#d946ef", Icon: StarIcon },
  QRP: { color: "#14b8a6", Icon: Building01Icon },
  QRWA: { color: "#0ea5e9", Icon: Home01Icon },
  QSWAP: { color: "#06b6d4", Icon: Exchange01Icon },
  QTF: { color: "#f59e0b", Icon: MoneyBag01Icon },
  QTREAT: { color: "#d97706", Icon: StarIcon },
  QUOTTERY: { color: "#f97316", Icon: MoneyBag01Icon },
  QUSINO: { color: "#8b5cf6", Icon: Link01Icon },
  QUTIL: { color: "#0ea5e9", Icon: SentIcon },
  QVAULT: { color: "#3b82f6", Icon: SquareLock01Icon },
  QX: { color: "#f59e0b", Icon: ChartLineData01Icon },
  RANDOM: { color: "#8b5cf6", Icon: Compass01Icon },
  RL: { color: "#ec4899", Icon: StarIcon },
  SWATCH: { color: "#14b8a6", Icon: ViewIcon },
  VOTTUNBRIDGE: { color: "#6366f1", Icon: Link01Icon },
  WOLFPACK: { color: "#64748b", Icon: UserCircleIcon },
};

const DISPLAY_NAME_ALIASES: Record<string, string> = {
  "COMPUTOR CONTROLLED FUND": "CCF",
  "GENERAL QUORUM PROPOSAL": "GQMPROP",
  "MS VAULT": "MSVAULT",
  "Q-BOND": "QBOND",
  "Q RESERVE POOL": "QRP",
  "Q34": "QTF",
  "QPAYHUB": "QPAYHUB",
  "QUTIL": "QUTIL",
};

const FALLBACK_MARK = { color: "#64748b", Icon: File01Icon };

function contractMarkKey(name: string): string {
  const upper = name.trim().toUpperCase();
  return DISPLAY_NAME_ALIASES[upper] ?? upper;
}

/** Semantic contract artwork matching the explorer contract marks. */
export function ContractMark({ name, size = 18 }: { name: string; size?: number }) {
  const mark = CONTRACT_MARKS[contractMarkKey(name)] ?? FALLBACK_MARK;
  return <mark.Icon size={size} color={mark.color} aria-hidden="true" />;
}
