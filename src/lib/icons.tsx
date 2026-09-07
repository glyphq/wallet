import { forwardRef } from "react";
import type { SVGProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  AddCircleIcon as HugeAddCircleIcon,
  ArrowDown01Icon as HugeArrowDown01Icon,
  ArrowLeft01Icon as HugeArrowLeft01Icon,
  ArrowRight01Icon as HugeArrowRight01Icon,
  ArrowUp01Icon as HugeArrowUp01Icon,
  ArrowUpRight01Icon as HugeArrowUpRight01Icon,
  ArrowDownLeft01Icon as HugeArrowDownLeft01Icon,
  Notification01Icon as HugeNotification01Icon,
  FlashIcon as HugeFlashIcon,
  Bookmark01Icon as HugeBookmark01Icon,
  Bug01Icon as HugeBug01Icon,
  Building01Icon as HugeBuilding01Icon,
  Camera01Icon as HugeCamera01Icon,
  MoneyReceive01Icon as HugeMoneyReceive01Icon,
  MoneySend01Icon as HugeMoneySend01Icon,
  ChartLineData01Icon as HugeChartLineData01Icon,
  CheckmarkCircle01Icon as HugeCheckmarkCircle01Icon,
  ClipboardIcon as HugeClipboardIcon,
  Clock01Icon as HugeClock01Icon,
  Compass01Icon as HugeCompass01Icon,
  Copy01Icon as HugeCopy01Icon,
  Alert01Icon as HugeAlert01Icon,
  File01Icon as HugeFile01Icon,
  File02Icon as HugeFile02Icon,
  Download01Icon as HugeDownload01Icon,
  EarthIcon as HugeEarthIcon,
  ViewIcon as HugeViewIcon,
  ViewOffIcon as HugeViewOffIcon,
  FilterIcon as HugeFilterIcon,
  FireIcon as HugeFireIcon,
  FolderOpenIcon as HugeFolderOpenIcon,
  Image01Icon as HugeImage01Icon,
  FavouriteIcon as HugeFavouriteIcon,
  Home01Icon as HugeHome01Icon,
  InformationCircleIcon as HugeInformationCircleIcon,
  Key01Icon as HugeKey01Icon,
  KeyRoundIcon as HugeKeyRoundIcon,
  Link01Icon as HugeLink01Icon,
  SquareLock01Icon as HugeSquareLock01Icon,
  LockKeyholeIcon as HugeLockKeyholeIcon,
  SquareUnlock01Icon as HugeSquareUnlock01Icon,
  Search01Icon as HugeSearch01Icon,
  MoreHorizontalIcon as HugeMoreHorizontalIcon,
  MoneyBag01Icon as HugeMoneyBag01Icon,
  Moon02Icon as HugeMoon02Icon,
  Note01Icon as HugeNote01Icon,
  PaintBoardIcon as HugePaintBoardIcon,
  PencilEdit01Icon as HugePencilEdit01Icon,
  Edit02Icon as HugeEdit02Icon,
  GlobalIcon as HugeGlobalIcon,
  QrCodeIcon as HugeQrCodeIcon,
  RefreshIcon as HugeRefreshIcon,
  Rocket01Icon as HugeRocket01Icon,
  SafeIcon as HugeSafeIcon,
  SentIcon as HugeSentIcon,
  Settings01Icon as HugeSettings01Icon,
  ShieldCheckIcon as HugeShieldCheckIcon,
  ShieldAlertIcon as HugeShieldAlertIcon,
  StarIcon as HugeStarIcon,
  Sun01Icon as HugeSun01Icon,
  Exchange01Icon as HugeExchange01Icon,
  Delete02Icon as HugeDelete02Icon,
  UserCircleIcon as HugeUserCircleIcon,
  User02Icon as HugeUser02Icon,
  UserGroupIcon as HugeUserGroupIcon,
  Wallet01Icon as HugeWallet01Icon,
  WalletAdd01Icon as HugeWalletAdd01Icon,
  Wifi01Icon as HugeWifi01Icon,
} from "@hugeicons/core-free-icons";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function resolvedStrokeWidth(
  strokeWidth: IconProps["strokeWidth"]
): number | undefined {
  if (typeof strokeWidth === "number") return strokeWidth;
  if (typeof strokeWidth === "string") {
    const parsed = Number.parseFloat(strokeWidth);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function createIcon(icon: IconSvgElement) {
  return forwardRef<SVGSVGElement, IconProps>(function Hugeicon(
    { size, strokeWidth, ...props },
    ref
  ) {
    return (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        size={size}
        strokeWidth={resolvedStrokeWidth(strokeWidth)}
        {...props}
      />
    );
  });
}

export const AddCircleIcon = createIcon(HugeAddCircleIcon);
export const ArrowDown01Icon = createIcon(HugeArrowDown01Icon);
export const ArrowLeft01Icon = createIcon(HugeArrowLeft01Icon);
export const ArrowRight01Icon = createIcon(HugeArrowRight01Icon);
export const ArrowUp01Icon = createIcon(HugeArrowUp01Icon);
export const ArrowUpRight01Icon = createIcon(HugeArrowUpRight01Icon);
export const ArrowDownLeft01Icon = createIcon(HugeArrowDownLeft01Icon);
export const Notification01Icon = createIcon(HugeNotification01Icon);
export const FlashIcon = createIcon(HugeFlashIcon);
export const Bookmark01Icon = createIcon(HugeBookmark01Icon);
export const Bug01Icon = createIcon(HugeBug01Icon);
export const Building01Icon = createIcon(HugeBuilding01Icon);
export const Camera01Icon = createIcon(HugeCamera01Icon);
export const MoneyReceive01Icon = createIcon(HugeMoneyReceive01Icon);
export const MoneySend01Icon = createIcon(HugeMoneySend01Icon);
export const ChartLineData01Icon = createIcon(HugeChartLineData01Icon);
export const CheckmarkCircle01Icon = createIcon(HugeCheckmarkCircle01Icon);
export const ClipboardIcon = createIcon(HugeClipboardIcon);
export const Clock01Icon = createIcon(HugeClock01Icon);
export const Compass01Icon = createIcon(HugeCompass01Icon);
export const Copy01Icon = createIcon(HugeCopy01Icon);
export const Alert01Icon = createIcon(HugeAlert01Icon);
export const File01Icon = createIcon(HugeFile01Icon);
export const File02Icon = createIcon(HugeFile02Icon);
export const Download01Icon = createIcon(HugeDownload01Icon);
export const EarthIcon = createIcon(HugeEarthIcon);
export const ViewIcon = createIcon(HugeViewIcon);
export const ViewOffIcon = createIcon(HugeViewOffIcon);
export const FilterIcon = createIcon(HugeFilterIcon);
export const FireIcon = createIcon(HugeFireIcon);
export const FolderOpenIcon = createIcon(HugeFolderOpenIcon);
export const Image01Icon = createIcon(HugeImage01Icon);
export const FavouriteIcon = createIcon(HugeFavouriteIcon);
export const Home01Icon = createIcon(HugeHome01Icon);
export const InformationCircleIcon = createIcon(HugeInformationCircleIcon);
export const Key01Icon = createIcon(HugeKey01Icon);
export const KeyRoundIcon = createIcon(HugeKeyRoundIcon);
export const Link01Icon = createIcon(HugeLink01Icon);
export const SquareLock01Icon = createIcon(HugeSquareLock01Icon);
export const LockKeyholeIcon = createIcon(HugeLockKeyholeIcon);
export const SquareUnlock01Icon = createIcon(HugeSquareUnlock01Icon);
export const Search01Icon = createIcon(HugeSearch01Icon);
export const MoreHorizontalIcon = createIcon(HugeMoreHorizontalIcon);
export const MoneyBag01Icon = createIcon(HugeMoneyBag01Icon);
export const Moon02Icon = createIcon(HugeMoon02Icon);
export const Note01Icon = createIcon(HugeNote01Icon);
export const PaintBoardIcon = createIcon(HugePaintBoardIcon);
export const PencilEdit01Icon = createIcon(HugePencilEdit01Icon);
export const Edit02Icon = createIcon(HugeEdit02Icon);
export const GlobalIcon = createIcon(HugeGlobalIcon);
export const QrCodeIcon = createIcon(HugeQrCodeIcon);
export const RefreshIcon = createIcon(HugeRefreshIcon);
export const Rocket01Icon = createIcon(HugeRocket01Icon);
export const SafeIcon = createIcon(HugeSafeIcon);
export const SentIcon = createIcon(HugeSentIcon);
export const Settings01Icon = createIcon(HugeSettings01Icon);
export const ShieldCheckIcon = createIcon(HugeShieldCheckIcon);
export const ShieldAlertIcon = createIcon(HugeShieldAlertIcon);
export const StarIcon = createIcon(HugeStarIcon);
export const Sun01Icon = createIcon(HugeSun01Icon);
export const Exchange01Icon = createIcon(HugeExchange01Icon);
export const Delete02Icon = createIcon(HugeDelete02Icon);
export const UserCircleIcon = createIcon(HugeUserCircleIcon);
export const User02Icon = createIcon(HugeUser02Icon);
export const UserGroupIcon = createIcon(HugeUserGroupIcon);
export const Wallet01Icon = createIcon(HugeWallet01Icon);
export const WalletAdd01Icon = createIcon(HugeWalletAdd01Icon);
export const Wifi01Icon = createIcon(HugeWifi01Icon);
