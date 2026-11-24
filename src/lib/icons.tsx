import type { ComponentType, SVGProps } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowRightArrowLeft,
  ArrowRotateRight,
  ArrowUpFromLine,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bug,
  Camera,
  ChartLine,
  CircleCheck,
  CircleDollar,
  CircleInfo,
  CirclePlus,
  Clock,
  Compass,
  Copy,
  Ellipsis,
  Eye,
  EyeSlash,
  File,
  FileText,
  Flame,
  FolderOpen,
  Funnel,
  Gear,
  Globe,
  Heart,
  House,
  Key,
  Link,
  Lock,
  LockOpen,
  Magnifier,
  Moon,
  OfficeBadge,
  Palette,
  PaperPlane,
  Pencil,
  Person,
  Persons,
  Picture,
  QrCode,
  Rocket,
  ShieldCheck,
  ShieldExclamation,
  Signal,
  Star,
  Sun,
  TrashBin,
  TriangleExclamation,
  TriangleThunderbolt,
  Vault as SafeGlyphIcon,
  Wallet,
} from "@gravity-ui/icons";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
  /** Kept for call-site compatibility; Gravity icons are filled and ignore it. */
  strokeWidth?: number | string;
}

type GravityIcon = ComponentType<SVGProps<SVGSVGElement>>;

function createIcon(Icon: GravityIcon) {
  return function GlyphIcon({ size = 16, strokeWidth: _strokeWidth, width, height, ...props }: IconProps) {
    return <Icon width={width ?? size} height={height ?? size} {...props} />;
  };
}

export const AddCircleIcon = createIcon(CirclePlus);
export const ChevronLeft01Icon = createIcon(ChevronLeft);
export const ChevronRight01Icon = createIcon(ChevronRight);
export const ArrowDown01Icon = createIcon(ChevronDown);
export const ArrowLeft01Icon = createIcon(ArrowLeft);
export const ArrowRight01Icon = createIcon(ArrowRight);
export const ArrowUp01Icon = createIcon(ChevronUp);
export const ArrowUpRight01Icon = createIcon(ArrowUpRight);
export const ArrowDownLeft01Icon = createIcon(ArrowDownLeft);
export const Notification01Icon = createIcon(Bell);
export const FlashIcon = createIcon(TriangleThunderbolt);
export const Bookmark01Icon = createIcon(Bookmark);
export const Bug01Icon = createIcon(Bug);
export const Building01Icon = createIcon(OfficeBadge);
export const Camera01Icon = createIcon(Camera);
export const MoneyReceive01Icon = createIcon(ArrowDownToLine);
export const MoneySend01Icon = createIcon(ArrowUpFromLine);
export const ChartLineData01Icon = createIcon(ChartLine);
export const CheckmarkCircle01Icon = createIcon(CircleCheck);
export const ClipboardIcon = createIcon(Copy);
export const Clock01Icon = createIcon(Clock);
export const Compass01Icon = createIcon(Compass);
export const Copy01Icon = createIcon(Copy);
export const Alert01Icon = createIcon(TriangleExclamation);
export const File01Icon = createIcon(File);
export const File02Icon = createIcon(FileText);
export const Download01Icon = createIcon(ArrowDownToLine);
export const EarthIcon = createIcon(Globe);
export const ViewIcon = createIcon(Eye);
export const ViewOffIcon = createIcon(EyeSlash);
export const FilterIcon = createIcon(Funnel);
export const FireIcon = createIcon(Flame);
export const FolderOpenIcon = createIcon(FolderOpen);
export const Image01Icon = createIcon(Picture);
export const FavouriteIcon = createIcon(Heart);
export const Home01Icon = createIcon(House);
export const InformationCircleIcon = createIcon(CircleInfo);
export const Key01Icon = createIcon(Key);
export const KeyRoundIcon = createIcon(Key);
export const Link01Icon = createIcon(Link);
export const SquareLock01Icon = createIcon(Lock);
export const LockKeyholeIcon = createIcon(Lock);
export const SquareUnlock01Icon = createIcon(LockOpen);
export const Search01Icon = createIcon(Magnifier);
export const MoreHorizontalIcon = createIcon(Ellipsis);
export const MoneyBag01Icon = createIcon(CircleDollar);
export const Moon02Icon = createIcon(Moon);
export const Note01Icon = createIcon(FileText);
export const PaintBoardIcon = createIcon(Palette);
export const PencilEdit01Icon = createIcon(Pencil);
export const Edit02Icon = createIcon(Pencil);
export const GlobalIcon = createIcon(Globe);
export const QrCodeIcon = createIcon(QrCode);
export const RefreshIcon = createIcon(ArrowRotateRight);
export const Rocket01Icon = createIcon(Rocket);
export const SafeIcon = createIcon(SafeGlyphIcon);
export const SentIcon = createIcon(PaperPlane);
export const Settings01Icon = createIcon(Gear);
export const ShieldCheckIcon = createIcon(ShieldCheck);
export const ShieldAlertIcon = createIcon(ShieldExclamation);
export const StarIcon = createIcon(Star);
export const Sun01Icon = createIcon(Sun);
export const Exchange01Icon = createIcon(ArrowRightArrowLeft);
export const Delete02Icon = createIcon(TrashBin);
export const UserCircleIcon = createIcon(Person);
export const User02Icon = createIcon(Person);
export const UserGroupIcon = createIcon(Persons);
export const Wallet01Icon = createIcon(Wallet);
export const WalletAdd01Icon = createIcon(Wallet);
export const Wifi01Icon = createIcon(Signal);
