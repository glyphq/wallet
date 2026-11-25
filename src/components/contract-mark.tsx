import {
  Building01Icon,
  ChartLineData01Icon,
  Compass01Icon,
  Exchange01Icon,
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
  ViewIcon,
  Wallet01Icon,
} from "@/lib/icons";

type ContractMarkIcon = typeof File01Icon;

const CONTRACT_MARKS: Record<string, ContractMarkIcon> = {
  CCF: Wallet01Icon,
  ESCROW: Building01Icon,
  GQMPROP: File02Icon,
  MLM: Link01Icon,
  MSVAULT: Key01Icon,
  NOST: File02Icon,
  PULSE: FlashIcon,
  QBAY: StarIcon,
  QBOND: File02Icon,
  QDRAW: MoneyBag01Icon,
  QDUEL: Compass01Icon,
  QIP: Rocket01Icon,
  QPAYHUB: MoneySend01Icon,
  QPUMP: Rocket01Icon,
  QRAFFLE: StarIcon,
  QRP: Building01Icon,
  QRWA: Home01Icon,
  QSWAP: Exchange01Icon,
  QTF: MoneyBag01Icon,
  QTREAT: StarIcon,
  QUOTTERY: MoneyBag01Icon,
  QUSINO: Link01Icon,
  QUTIL: SentIcon,
  QVAULT: SquareLock01Icon,
  QX: ChartLineData01Icon,
  RANDOM: Compass01Icon,
  RL: StarIcon,
  SWATCH: ViewIcon,
  VOTTUNBRIDGE: Link01Icon,
  WOLFPACK: UserCircleIcon,
};

const DISPLAY_NAME_ALIASES: Record<string, string> = {
  "COMPUTOR CONTROLLED FUND": "CCF",
  "GENERAL QUORUM PROPOSAL": "GQMPROP",
  "MS VAULT": "MSVAULT",
  "Q-BOND": "QBOND",
  "Q RESERVE POOL": "QRP",
  "Q34": "QTF",
};

const FALLBACK_MARK = File01Icon;

function contractMarkKey(name: string): string {
  const upper = name.trim().toUpperCase();
  return DISPLAY_NAME_ALIASES[upper] ?? upper;
}

/** Semantic contract artwork matching the explorer contract marks. */
export function ContractMark({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = CONTRACT_MARKS[contractMarkKey(name)] ?? FALLBACK_MARK;
  return <Icon size={size} color="var(--color-text-primary)" aria-hidden="true" />;
}
