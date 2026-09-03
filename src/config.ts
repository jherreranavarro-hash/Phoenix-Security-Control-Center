export const config = {
  port: Number(process.env.PHX_PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development",

  tenantId: process.env.PHX_TENANT_ID ?? "",

  readOnly: {
    clientId: process.env.PHX_READONLY_CLIENT_ID ?? "",
    clientSecret: process.env.PHX_READONLY_CLIENT_SECRET ?? "",
  },
  production: {
    clientId: process.env.PHX_PROD_CLIENT_ID ?? "",
    clientSecret: process.env.PHX_PROD_CLIENT_SECRET ?? "",
  },

  enableWrites: process.env.PHX_ENABLE_WRITES === "true",
  licenseApproverUpn: (process.env.PHX_LICENSE_APPROVER_UPN ?? "").toLowerCase().trim(),

  keyVaultUri: process.env.PHX_KEYVAULT_URI ?? "",

  devUser: {
    upn: process.env.PHX_DEV_USER_UPN ?? "demo.admin@phoenixservice.com",
    name: process.env.PHX_DEV_USER_NAME ?? "Administrador de Demostración",
    roles: (process.env.PHX_DEV_USER_ROLES ?? "GobiernoTI,Aprobador")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
  },
};

export const readOnlyGraphConfigured = Boolean(
  config.tenantId && config.readOnly.clientId && config.readOnly.clientSecret,
);

export const productionGraphConfigured = Boolean(
  config.tenantId && config.production.clientId && config.production.clientSecret,
);

/**
 * "Modo demostración": no hay credenciales de Microsoft Graph configuradas.
 * En este modo la plataforma opera solo con datos de ejemplo, claramente
 * identificados en la interfaz, y nunca intenta contactar el tenant real.
 */
export const isDemoMode = !readOnlyGraphConfigured;
