import { useLocalStorageValue as useLocalStorage } from "@react-hookz/web";

// タップアクションの種類
// next: 次ページ, prev: 前ページ, menu: メニュー表示, close: TOPに戻る, none: 何もしない
export type TapAction = "next" | "prev" | "menu" | "close" | "none";

// 3x3 グリッドのタップゾーン設定
// zones[row][col]: row=0(top),1(middle),2(bottom), col=0(left),1(center),2(right)
export type TapZoneGrid = [
    [TapAction, TapAction, TapAction],
    [TapAction, TapAction, TapAction],
    [TapAction, TapAction, TapAction]
];

export type TapZoneConfig = {
    zones: TapZoneGrid;
};

// プリセット: 右手持ち（左側=前、中央=メニュー、右側=次）
export const TAP_PRESET_RIGHT_HAND: TapZoneGrid = [
    ["prev", "menu", "next"],
    ["prev", "menu", "next"],
    ["prev", "menu", "next"]
];

// プリセット: 左手持ち（左側=次、中央=メニュー、右側=前）
export const TAP_PRESET_LEFT_HAND: TapZoneGrid = [
    ["next", "menu", "prev"],
    ["next", "menu", "prev"],
    ["next", "menu", "prev"]
];

// プリセット: デフォルト（全无动作 - 用户用屏幕两侧的 ‹ › 按钮或键盘翻页;
// 想要老的"点屏幕翻页"在 Settings → Viewer → Tap Zones 里改 right-hand / left-hand）
export const TAP_PRESET_DEFAULT: TapZoneGrid = [
    ["none", "none", "none"],
    ["none", "none", "none"],
    ["none", "none", "none"]
];

type UserSettings = {
    openNewTab: boolean;
    uploadBookToNotion: boolean;
    tapZones?: TapZoneConfig;
};
const DEFAULT_SETTINGS: UserSettings = {
    openNewTab: true,
    uploadBookToNotion: false, // デフォルトOFF
    tapZones: { zones: TAP_PRESET_DEFAULT }
};
export const useUserSettings = () => {
    const { value: userSettings, set: setUserSettings } = useLocalStorage<UserSettings>("mubook-hon-user-settings", {
        defaultValue: DEFAULT_SETTINGS
    });
    return {
        userSettings: userSettings,
        updateUserSettings: setUserSettings
    } as const;
};
