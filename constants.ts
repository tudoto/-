import { HandType } from './types';

// Prefix to ensure unique namespace
export const ROOM_ID_PREFIX = 'draw-guess-v1-';

// --- BACKEND CONFIGURATION ---
// 1. Deploy the 'server' folder to Render.
// 2. Paste your Render URL below (e.g., 'https://my-app.onrender.com')
// 3. If empty, it falls back to the public PeerJS server (unstable for production).
export const CUSTOM_BACKEND_URL = 'https://4z76jqzc0c.onrender.com'; 

// Helper to parse the URL for PeerJS config
const getPeerConfig = () => {
  const baseConfig = {
  debug: 2,
  config: {
    iceServers: [
      { urls: 'stun:stun.qq.com:3478' },      // 腾讯
      { urls: 'stun:stun.miwifi.com:3478' },  // 小米
      { urls: 'stun:stun.l.google.com:19302' } // 保留 Google 作为备选
    ]
  }
};

  if (CUSTOM_BACKEND_URL) {
    try {
      const url = new URL(CUSTOM_BACKEND_URL);
      return {
        ...baseConfig,
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 443,
        path: '/peerjs/myapp', // Must match server/index.js configuration
        secure: url.protocol === 'https:',
      };
    } catch (e) {
      console.error("Invalid CUSTOM_BACKEND_URL", e);
      return baseConfig;
    }
  }

  return baseConfig;
};

export const PEER_CONFIG = getPeerConfig();


export const WORD_LIST = [
  "苹果", "香蕉", "西瓜", "电脑", "手机", "鼠标", "键盘", "耳机", "眼镜", "手表",
  "汽车", "自行车", "飞机", "火车", "轮船", "火箭", "太阳", "月亮", "星星", "云朵",
  "下雨", "雪人", "房子", "大树", "花朵", "小狗", "小猫", "兔子", "老虎", "狮子",
  "大象", "长颈鹿", "熊猫", "企鹅", "乌龟", "青蛙", "蝴蝶", "蜜蜂", "蜘蛛", "螃蟹",
  "足球", "篮球", "羽毛球", "乒乓球", "游泳", "跑步", "跳舞", "唱歌", "看书", "睡觉",
  "吃饭", "喝水", "刷牙", "洗澡", "医生", "护士", "老师", "学生", "警察", "消防员",
  "厨师", "汉堡", "披萨", "面条", "米饭", "蛋糕", "冰淇淋", "巧克力", "牛奶", "咖啡",
  "可乐", "吉他", "钢琴", "小提琴", "画画", "照相机", "电视", "冰箱", "洗衣机", "空调"
];

export const COLORS = [
  '#000000', // Black
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#ffffff', // Eraser (White)
];

export const AVATARS = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔"];

export const ROUND_TIME = 60; // Seconds
export const MAX_ROUNDS = 3;

export const HAND_BASE_SCORES: Record<HandType, { chips: number, mult: number }> = {
  [HandType.HighCard]: { chips: 5, mult: 1 },
  [HandType.Pair]: { chips: 10, mult: 2 },
  [HandType.TwoPair]: { chips: 20, mult: 2 },
  [HandType.ThreeOfAKind]: { chips: 30, mult: 3 },
  [HandType.Straight]: { chips: 30, mult: 4 },
  [HandType.Flush]: { chips: 35, mult: 4 },
  [HandType.FullHouse]: { chips: 40, mult: 4 },
  [HandType.FourOfAKind]: { chips: 60, mult: 7 },
  [HandType.StraightFlush]: { chips: 100, mult: 8 },
  [HandType.RoyalFlush]: { chips: 100, mult: 8 },
};
