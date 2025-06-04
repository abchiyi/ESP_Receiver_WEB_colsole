export enum DataOperation {
    READ,
    WRITE,
}

export enum DataPort {
    WEB_PORT_CONFIG, // 配置端口
    __PORT_MAX,      // 端口最大值,仅作为占位符
};

export class WebSocketClient {
    private ws: WebSocket | null = null;
    private readonly url: string;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 3000; // 3秒后重连
    private isConnecting: boolean = false;

    // 事件回调
    private onMessageCallback: ((data: any) => void) | null = null;
    private onConnectedCallback: (() => void) | null = null;
    private onDisconnectedCallback: (() => void) | null = null;
    private onErrorCallback: ((error: Event) => void) | null = null;

    constructor(url: string = 'ws://localhost:8080') {
        this.url = url;
    }

    public connect(): void {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            console.log('WebSocket is already connected or connecting');
            return;
        }

        if (this.isConnecting) {
            console.log('Connection attempt already in progress');
            return;
        }

        this.isConnecting = true;

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.onConnectedCallback?.();
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnecting = false;
                this.onDisconnectedCallback?.();
                this.attemptReconnect();
            };

            this.ws.onerror = (error: Event) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                this.onErrorCallback?.(error);
            };

            this.ws.onmessage = (event: MessageEvent) => {
                let data;
                try {
                    data = JSON.parse(event.data);
                } catch (e) {
                    data = event.data;
                }
                this.onMessageCallback?.(data);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.attemptReconnect();
        }
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }

    public disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * 通过WebSocket发送数据
     * @param data 要发送的数据，可以是字符串或可序列化的对象
     * @throws 当WebSocket未连接或发送失败时会在控制台输出错误信息
     */
    public send(data: any): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            return;
        }

        try {
            const message = typeof data === 'string'
                ? data
                : JSON.stringify(data);

            this.ws.send(message);
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    public onMessage(callback: (data: any) => void): void {
        this.onMessageCallback = callback;
    }

    public onConnected(callback: () => void): void {
        this.onConnectedCallback = callback;
    }

    public onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback;
    }

    public onError(callback: (error: Event) => void): void {
        this.onErrorCallback = callback;
    }

    public isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    public getState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    /**
     * 设置WebSocket服务器URL
     * @param url 新的WebSocket服务器URL
     */
    public setUrl(url: string): void {
        // 如果URL没有变化，则不做任何操作
        if (this.url === url) {
            return;
        }

        // 断开当前连接
        this.disconnect();

        // 更新URL
        (this as any).url = url;

        // 重新连接
        this.connect();
    }
}

// 创建全局WebSocketClient实例
export const webSocketClient = new WebSocketClient();
