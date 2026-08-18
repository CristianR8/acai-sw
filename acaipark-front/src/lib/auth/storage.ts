export const ACCESS_TOKEN_KEY = "acai_access_token";
export const TOKEN_TYPE_KEY = "acai_token_type";
export const USER_ROLE_KEY = "acaipark_user_role";
export const REMEMBER_AUTH_KEY = "acaipark_remember_auth";

export type UserRole = "administrator" | "cashier";

export type StoredAuth = {
  accessToken: string;
  tokenType: string;
  role?: UserRole;
  remember?: boolean;
};

function getStorage(remember: boolean) {
  if (typeof window === "undefined") return null;
  return remember ? window.localStorage : window.sessionStorage;
}

export function storeAuth(auth: StoredAuth, remember: boolean) {
  const storage = getStorage(remember);
  if (!storage) return;

  storage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
  storage.setItem(TOKEN_TYPE_KEY, auth.tokenType);
  if (auth.role) storage.setItem(USER_ROLE_KEY, auth.role);
  storage.setItem(REMEMBER_AUTH_KEY, remember ? "1" : "0");
}

export function readAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;

  const storages = [window.localStorage, window.sessionStorage] as const;
  for (const storage of storages) {
    const accessToken = storage.getItem(ACCESS_TOKEN_KEY);
    const tokenType = storage.getItem(TOKEN_TYPE_KEY) ?? "Bearer";
    const storedRole = storage.getItem(USER_ROLE_KEY);
    const role =
      storedRole === "administrator" || storedRole === "cashier"
        ? storedRole
        : undefined;
    const rememberAuth = storage.getItem(REMEMBER_AUTH_KEY) === "1";
    if (accessToken)
      return { accessToken, tokenType, role, remember: rememberAuth };
  }

  return null;
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_TYPE_KEY);
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_TYPE_KEY);
  window.localStorage.removeItem(USER_ROLE_KEY);
  window.sessionStorage.removeItem(USER_ROLE_KEY);
  window.localStorage.removeItem(REMEMBER_AUTH_KEY);
  window.sessionStorage.removeItem(REMEMBER_AUTH_KEY);
}
