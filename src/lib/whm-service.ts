/**
 * WHM API Service — ndrc-atelier
 * Adapté depuis whm-manager : la config est passée en paramètre (stockée en DB)
 * plutôt que lue depuis les variables d'environnement.
 */

export interface WhmClientConfig {
  host: string   // ex: "https://campus01.o2switch.net:2087"
  user: string
  token: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function describeFetchError(url: string, error: unknown): string {
  if (!(error instanceof Error)) return `fetch failed (${url})`
  const cause = (error as Error & { cause?: unknown }).cause
  let details = error.message || "fetch failed"
  if (cause && typeof cause === "object") {
    const record = cause as Record<string, unknown>
    const code = typeof record.code === "string" ? record.code : ""
    const hostname = typeof record.hostname === "string" ? record.hostname : ""
    if (code && hostname) details = `${details} (${code} ${hostname})`
    else if (code) details = `${details} (${code})`
  }
  try {
    return `${details} [${new URL(url).host}]`
  } catch {
    return details
  }
}

async function fetchInsecure(url: string, init?: RequestInit): Promise<Response> {
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  const attempts = 4
  let lastError: unknown = null
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fetch(url, init)
      } catch (error: unknown) {
        lastError = error
        if (attempt < attempts) {
          await sleep(250 * attempt)
          continue
        }
      }
    }
    throw new Error(describeFetchError(url, lastError), {
      cause: lastError instanceof Error ? lastError : undefined,
    })
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev
  }
}

async function whmFetch(
  config: WhmClientConfig,
  endpoint: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${config.host}/json-api/${endpoint}`)
  url.searchParams.set("api.version", "1")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const res = await fetchInsecure(url.toString(), {
    headers: { Authorization: `whm ${config.user}:${config.token}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`WHM API error: ${res.status} ${res.statusText}`)
  return res.json()
}

export interface WHMAccount {
  user: string
  domain: string
  email: string
  diskused: string
  disklimit: string
  plan: string
  ip: string
  suspendreason: string
}

export async function listAccounts(config: WhmClientConfig): Promise<WHMAccount[]> {
  // searchtype=owner filtre sur les comptes créés par ce revendeur (mutualisé o2switch)
  const data = await whmFetch(config, "listaccts", {
    searchtype: "owner",
    search: config.user,
  })
  return data?.data?.acct || []
}

export async function createCpanelAccount(
  config: WhmClientConfig,
  params: { user: string; domain: string; password: string; email: string; plan?: string },
) {
  return whmFetch(config, "createacct", {
    username: params.user,
    domain: params.domain,
    password: params.password,
    contactemail: params.email,
    plan: params.plan || "default",
  })
}

export async function getCPanelLoginURL(config: WhmClientConfig, user: string): Promise<string | null> {
  const data = await whmFetch(config, "create_user_session", { user, service: "cpaneld" })
  return data?.data?.url || null
}

export async function getCPanelSessionData(config: WhmClientConfig, user: string) {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const data = await whmFetch(config, "create_user_session", { user, service: "cpaneld" })
      const url = data?.data?.url
      if (!url) throw new Error("Impossible de créer une session cPanel")

      const loginResp = await fetchInsecure(url, { redirect: "manual" })
      const setCookieHeader = loginResp.headers.get("set-cookie")
      let cookie = ""
      if (setCookieHeader) {
        const cookies = setCookieHeader.split(", ").map((c: string) => c.split(";")[0])
        const cpsessionCookie = cookies.find((c: string) => c.startsWith("cpsession="))
        if (cpsessionCookie) cookie = cpsessionCookie
      }

      const match = url.match(/\/cpsess\d+\//)
      const cpsess = match ? match[0].replace(/\//g, "") : ""
      const host = url.split("/")[2].split(":")[0]

      return { url, cpsess, host, cookie }
    } catch (error: unknown) {
      lastError = error
      if (attempt < 3) await sleep(300 * attempt)
    }
  }
  throw new Error(`Session cPanel impossible pour ${user}: ${describeFetchError(config.host, lastError)}`)
}

export async function startAutoSSLCheck(config: WhmClientConfig, user: string) {
  return whmFetch(config, "start_autossl_check_for_user", { user })
}

export async function cpanelApi(
  config: WhmClientConfig,
  user: string,
  module: string,
  func: string,
  params: Record<string, string> = {},
) {
  return whmFetch(config, "cpanel", {
    user,
    cpanel_jsonapi_user: user,
    cpanel_jsonapi_module: module,
    cpanel_jsonapi_func: func,
    cpanel_jsonapi_apiversion: "3",
    ...params,
  })
}

// Helpers
export function generateCpanelUsername(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  return `${clean(firstName).slice(0, 4)}${clean(lastName).slice(0, 4)}`.slice(0, 8)
}

export function generatePassword(length = 14): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join("")
}
