export const CHANNEL_COUNT = 4;

export type ChannelSetting = {
    id: number;
    name: string;
    min: number;
    max: number;
    center: number;
    offset: number;
    reverse: boolean;
    thrust_mode: number;
    xbox_input_key: number;
};

export type configData = {
    radio_mode: number; // 无线电链路模式
    wifi_lr_mode: number, // ESP Wifi长短距离模式
    h_bridge_drv: number, // 启动H桥驱动模式
    channel_settings: ChannelSetting[]; // 通道设置
};

export type receiverInfo = {
    rssi_ground: number;
    rssi_air: number;
    battery_voltage: number;
    battery_cell: number;
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
    joyLHori,
    joyLVert,
    joyRHori,
    joyRVert,
    trigLT,
    trigRT,
    XBOX_HAT_MAX, // max value for joystick axes
}
