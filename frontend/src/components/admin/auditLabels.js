export const AUDIT_LABEL = {
  "auth.register": "signed up",
  "auth.login": "signed in",
  "auth.logout_all": "signed out everywhere",
  "auth.password_change": "changed their password",
  "user.onboarded": "set up their plan",
  "user.delete_self": "deleted their account",
  "admin.role_change": "role changed",
  "admin.disable": "account disabled",
  "admin.enable": "account re-enabled",
  "admin.force_logout": "forced to sign out",
  "admin.delete_user": "account deleted by admin",
  "admin.view_user": "profile viewed",
  "admin.bootstrap": "admin account created",
  "admin.promote_cli": "promoted to admin (command line)",
};
export const auditLabel = (a) => AUDIT_LABEL[a] || a;
export const auditTone = (a) => (a.startsWith("admin.") ? "cyan" : a === "user.delete_self" ? "red" : "");
