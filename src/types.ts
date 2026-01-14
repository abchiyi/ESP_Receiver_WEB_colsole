export const CHANNEL_COUNT = 4;

export type ChannelSetting = {
    id: number;
    name: string;
    min: number;
    center: number;
    max: number;
    reverse: boolean;
    offset: number;
    xbox_input_key: number;
};

export type configData = {
    radio_mode: number;
    channel_settings: ChannelSetting[];
};

export type receiverInfo = {
    rssi_ground: number;
    rssi_air: number;
    battery_voltage: number;
    firmware_version: string;
    channel_outputs: [number, number, number, number];
};

export enum DataPort {
    PORT_CONFIG_SYNC = 0,
    PORT_CONFIG_AND_CHANNEL_SYNC,
    ___data_port_max,
}

export enum radio_mode {
    ESP_NOW = 0,
    BT_CONTROLLER,
    __radio_mode_max,
}

// Xbox输入按钮枚举
export enum XBOX_INPUT {
    None, // no button
    btnA,
    btnB,
    btnX,
    btnY,
    btnLB,
    btnRB,
    btnSelect,
    btnStart,
    btnXbox,
    btnLS,
    btnRS,
    btnShare,
    btnDirUp,
    btnDirRight,
    btnDirDown,
    btnDirLeft,
    XBOX_BUTTON_MAX, // max value
    joyLHori = XBOX_BUTTON_MAX + 1,
    joyLVert,
    joyRHori,
    joyRVert,
    trigLT,
    trigRT,
    XBOX_HAT_MAX, // max value for joystick axes
}
