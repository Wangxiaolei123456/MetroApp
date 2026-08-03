/**
 * Web3 社交账户登录（参考 Cardible19 的 @uptickjs/webauth-sdk 用法）。
 *
 * 直接用 Uptick WebAuth 做 Google / Apple / 邮箱无密码登录，
 * 登录后由 Uptick 后端 MPC 生成 EVM 钱包地址（owner），App 端不持有私钥、
 * 不需要助记词、也不走 AA 代发交易。钱包地址即社交账户派生的 owner 地址，
 * 可直接用于现有 treasury 直发的 UPTICK 发放逻辑。
 */
import {createWebAuth, createTokenStorage} from '@uptickjs/webauth-sdk';

// 与 Cardible19 一致的 Uptick WebAuth 凭证
const WEB_AUTH_API = 'https://aabackend.testweb.uptick.network/api';
const WEB_AUTH_API_KEY = 'app_9564913793614742';
export const WEB3AUTH_REDIRECT_SCHEME = 'uptickcardible://auth';

export type SocialProvider = 'google' | 'apple' | 'email';

export interface Web3AuthResult {
  /** 社交账户派生的 EVM 钱包地址（Uptick 链 owner 地址） */
  evmAddress: string;
  /** 同名占位（本项目用 evmAddress 作为主标识） */
  cosmosAddress: string;
  email?: string;
  name?: string;
  profileImage?: string;
  provider: SocialProvider;
}

let webAuthInstance: ReturnType<typeof createWebAuth> | null = null;

function getWebAuth() {
  if (!webAuthInstance) {
    webAuthInstance = createWebAuth(
      {
        apiBaseUrl: WEB_AUTH_API,
        apiKey: WEB_AUTH_API_KEY,
        redirectUri: WEB3AUTH_REDIRECT_SCHEME,
      },
      createTokenStorage('react-native'),
    );
  }
  return webAuthInstance;
}

function toResult(owner: string, provider: SocialProvider, email?: string): Web3AuthResult {
  return {
    evmAddress: owner,
    cosmosAddress: owner,
    email,
    provider,
  };
}

/** 解析回调 URL 的 query（不依赖 RN 未实现的 URLSearchParams.get） */
function parseQuery(url: string): Record<string, string> {
  const i = url.indexOf('?');
  if (i < 0) return {};
  const out: Record<string, string> = {};
  url
    .slice(i + 1)
    .split('&')
    .forEach((pair) => {
      if (!pair) return;
      const eq = pair.indexOf('=');
      const k = eq < 0 ? pair : pair.slice(0, eq);
      const v = eq < 0 ? '' : pair.slice(eq + 1);
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    });
  return out;
}

/** 当前登录流程的等待者：App 层解析到回调 URL 中的 owner 时直接 resolve */
let pendingLoginResolver: ((r: {owner?: string; email?: string}) => void) | null = null;

/**
 * 等待登录结果。三种来源谁先到用谁：
 *  1) SDK 内部监听器正常回调（loginWithXxxRedirect 的 Promise）
 *  2) App 层转发的 deep link 在我们的 handleIncomingUrl 中解析出 owner
 *  3) SDK 成功 emit 的 login 事件
 * 覆盖「浏览器跳回 App 时 Linking 事件未投递到 SDK 内部监听器」的兜底场景，
 * 避免登录 Promise 永久 pending 导致 UI 卡在「登录中」。
 */
function waitForLogin(timeoutMs = 5 * 60 * 1000): Promise<{owner?: string; email?: string}> {
  return new Promise((resolve, reject) => {
    const id = 'app-login-waiter';
    const timer = setTimeout(() => {
      pendingLoginResolver = null;
      getWebAuth().removeEventListener(id);
      reject(new Error('登录超时，请重试'));
    }, timeoutMs);
    const onEvent = (event: {type: string; data?: any}) => {
      if (event.type === 'login' && event.data?.owner) {
        clearTimeout(timer);
        pendingLoginResolver = null;
        getWebAuth().removeEventListener(id);
        resolve({owner: event.data.owner, email: event.data.email});
      }
    };
    getWebAuth().addEventListener(id, onEvent);
    pendingLoginResolver = (r) => {
      clearTimeout(timer);
      getWebAuth().removeEventListener(id);
      resolve(r);
    };
  });
}

/** 用 Google 登录，返回钱包地址 */
export async function loginWithGoogle(): Promise<Web3AuthResult> {
  const auth = getWebAuth().getAuth();
  // 打开浏览器跳转（内部会 addEventListener 等待，但我们不单独依赖它的 resolve）
  const sdkPromise = auth.loginWithGoogleRedirect();
  const eventPromise = waitForLogin();
  // 谁先拿到结果用谁：SDK 内部监听器正常回调，或 App 层转发的 URL 解析出 owner
  const res = await Promise.race([sdkPromise, eventPromise]);
  console.log('loginWithGoogle',res);
  
  if (!res?.owner) throw new Error('Google 登录未返回钱包地址');
  return toResult(res.owner, 'google', res.email);
}

/** 用 Apple 登录，返回钱包地址 */
export async function loginWithApple(): Promise<Web3AuthResult> {
  const auth = getWebAuth().getAuth();
  const sdkPromise = auth.loginWithAppleRedirect();
  const eventPromise = waitForLogin();
  const res = await Promise.race([sdkPromise, eventPromise]);
  if (!res?.owner) throw new Error('Apple 登录未返回钱包地址');
  return toResult(res.owner, 'apple', res.email);
}

/**
 * App 层收到 deep link 回调时调用。
 * 注意：不能走 SDK 的 handleRedirect（其内部用 URLSearchParams.get，RN 环境未实现会抛错），
 * 改为自行解析 query，把 token 写入与 SDK 共享的 storage，并把 owner 直接交给 waitForLogin。
 *
 * 必须在 App 启动（含冷启动 Linking.getInitialURL）和 Linking.addEventListener 中调用。
 */
export async function handleIncomingUrl(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith(WEB3AUTH_REDIRECT_SCHEME)) return;
  const q = parseQuery(url);
  if (q.error) {
    pendingLoginResolver?.({
      owner: undefined,
      email: q.error_description || q.error,
    });
    pendingLoginResolver = null;
    return;
  }
  try {
    const ts = createTokenStorage('react-native');
    if (q.access_token) await ts.setAccessToken(q.access_token);
    if (q.refresh_token) await ts.setRefreshToken(q.refresh_token);
  } catch {
    // token 存储失败不影响已解析出的 owner
  }
  if (q.owner) {
    const owner = q.owner;
    const email = q.email;
    pendingLoginResolver?.({owner, email});
    pendingLoginResolver = null;
  }
}

/** 发送邮箱验证码（邮箱登录第一步） */
export async function sendEmailCode(email: string): Promise<void> {
  await getWebAuth().getAuth().sendEmailCode(email);
}

/** 用邮箱 + 验证码登录，返回钱包地址 */
export async function loginWithEmail(email: string, code: string): Promise<Web3AuthResult> {
  const res = (await getWebAuth().getAuth().loginWithEmail(email, code)) as {
    owner?: string;
    email?: string;
    wallet?: {address?: string};
  };
  const owner = res?.owner ?? res?.wallet?.address;
  if (!owner) throw new Error('邮箱登录未返回钱包地址');
  return toResult(owner, 'email', res.email ?? email);
}

/** 统一入口：按 provider 登录 */
export async function loginWithSocial(
  provider: SocialProvider,
  _env: 'testnet' | 'mainnet' = 'testnet',
): Promise<Web3AuthResult> {
  if (provider === 'google') return loginWithGoogle();
  if (provider === 'apple') return loginWithApple();
  throw new Error('邮箱登录请使用 loginWithEmail');
}

/** 是否已登录（存在本地 token） */
export async function isWeb3AuthLoggedIn(): Promise<boolean> {
  try {
    return await getWebAuth().isAuthenticated();
  } catch {
    return false;
  }
}

/** 退出登录并清除本地 token */
export async function logoutWeb3Auth(): Promise<void> {
  try {
    await getWebAuth().getAuth().logout();
  } catch {
    // 忽略退出异常
  }
}
