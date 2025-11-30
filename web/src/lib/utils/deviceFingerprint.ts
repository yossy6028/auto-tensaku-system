/**
 * デバイスフィンガープリント生成ユーティリティ
 * 
 * ブラウザの特性を組み合わせてユニークなデバイス識別子を生成します。
 * 完全なユニーク性は保証できませんが、塾での教室間共有を防ぐには十分です。
 */

import type { DeviceInfo } from '@/lib/supabase/types';

// ローカルストレージのキー
const DEVICE_ID_KEY = 'auto_tensaku_device_id';
const DEVICE_REGISTERED_KEY = 'auto_tensaku_device_registered';

/**
 * ブラウザの基本情報からデバイスシグネチャを生成
 */
function getBrowserSignature(): string {
  if (typeof window === 'undefined') return '';
  
  const components: string[] = [];
  
  // ブラウザ基本情報
  components.push(navigator.userAgent || '');
  components.push(navigator.language || '');
  components.push(String(navigator.hardwareConcurrency || ''));
  components.push(String(navigator.maxTouchPoints || ''));
  
  // 画面情報
  if (window.screen) {
    components.push(String(window.screen.width || ''));
    components.push(String(window.screen.height || ''));
    components.push(String(window.screen.colorDepth || ''));
    components.push(String(window.screen.pixelDepth || ''));
  }
  
  // タイムゾーン
  try {
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  } catch {
    components.push('');
  }
  
  // キャンバスフィンガープリント（オプション）
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('auto-tensaku', 2, 2);
      components.push(canvas.toDataURL().slice(-50));
    }
  } catch {
    // キャンバスが使えない場合は無視
  }
  
  // WebGL情報（オプション）
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '');
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '');
      }
    }
  } catch {
    // WebGLが使えない場合は無視
  }
  
  return components.join('|');
}

/**
 * 文字列をSHA-256ハッシュ化
 */
async function hashString(str: string): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // crypto.subtleが使えない場合は簡易ハッシュ
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * デバイスフィンガープリントを生成または取得
 * 一度生成されたIDはローカルストレージに保存され、同一ブラウザでは同じIDが返されます
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  // 既存のIDがあれば返す
  const existingId = localStorage.getItem(DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }
  
  // 新規生成
  const signature = getBrowserSignature();
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2);
  
  const fingerprint = await hashString(`${signature}|${timestamp}|${random}`);
  
  // ローカルストレージに保存
  localStorage.setItem(DEVICE_ID_KEY, fingerprint);
  
  return fingerprint;
}

/**
 * デバイス名を取得（ブラウザとOS情報）
 */
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  
  const ua = navigator.userAgent;
  
  // OSの検出
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // ブラウザの検出
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  
  return `${browser} on ${os}`;
}

/**
 * デバイス情報を取得
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const fingerprint = await getDeviceFingerprint();
  const deviceName = getDeviceName();
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
  
  return {
    fingerprint,
    deviceName,
    userAgent,
  };
}

/**
 * このデバイスが登録済みかどうかを確認（ローカル）
 */
export function isDeviceRegistered(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEVICE_REGISTERED_KEY) === 'true';
}

/**
 * デバイスを登録済みとしてマーク
 */
export function markDeviceAsRegistered(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
}

/**
 * デバイス登録状態をクリア（ログアウト時に使用）
 */
export function clearDeviceRegistration(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_REGISTERED_KEY);
  // デバイスIDは残す（同じデバイスで再ログインした場合に同じIDを使うため）
}

/**
 * デバイスIDを完全にリセット（デバッグ用）
 */
export function resetDeviceId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_ID_KEY);
  localStorage.removeItem(DEVICE_REGISTERED_KEY);
}

