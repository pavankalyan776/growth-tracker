import { lazy, Suspense, useEffect } from "react";
import Avatar from "../Avatar";
import { AppearanceButton } from "../Appearance";
import Icon from "../icons";
import { Skeletons } from "../ui";
import { useAuth } from "../../auth";

const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminMembers = lazy(() => import("./AdminMembers"));
const ContentStudio = lazy(() => import("./ContentStudio"));
const AdminAudit = lazy(() => import("./AdminAudit"));
const ProfileView = lazy(() => import("../ProfileView"));

const NAV = [
  { key: "dashboard", to: "admin", emoji: "📊", label: "Dashboard", title: "Dashboard", sub: "How the product is being used" },
  { key: "members", to: "admin/members", emoji: "👥", label: "Members", title: "Members", sub: "Everyone with an account" },
  { key: "studio", to: "admin/studio", emoji: "🎛️", label: "Content studio", title: "Content studio", sub: "Dares, starting plans and announcements" },
  { key: "audit", to: "admin/audit", emoji: "🧾", label: "Audit log", title: "Audit log", sub: "Who did what, and when" },
  { key: "account", to: "admin/account", emoji: "⚙️", label: "My account", title: "My account", sub: "Password, sessions and look" },
];

/* The admin console is a separate app: its own shell, colours and menu. Admins land here, not in the member tracker. */
export default function AdminApp({ route }) {
  const { user, signOut } = useAuth();
  const [first, second] = (route.param || "").split("/");
  const key = first === "users" ? "members" : NAV.some((n) => n.key === first) ? first : "dashboard";
  const page = NAV.find((n) => n.key === key);
  useEffect(() => { document.title = `${page.title} · Admin · Growth Tracker`; }, [page]);

  return (
    <div className="admin-app">
      <aside className="side" aria-label="Admin menu">
        <a className="brand" href="#/admin"><span className="brand-mark emoji" aria-hidden="true">🛡️</span><span className="brand-name">Admin<br />console</span></a>
        <nav className="side-nav">
          {NAV.map((n) => (
            <a key={n.key} href={`#/${n.to}`} className="nav-item" aria-current={n.key === key ? "page" : undefined}>
              <span className="nav-emoji emoji" aria-hidden="true">{n.emoji}</span><span className="nav-label">{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me-card"><Avatar name={user.name} avatar={user.avatar} size={36} /><div><b>{user.name}</b><span className="role-tag">ADMIN</span></div></div>
          <a className="btn ghost sm" href="#/today">🌅 Open my tracker</a>
          <AppearanceButton up className="btn ghost sm" />
          <button type="button" className="btn ghost sm" onClick={() => signOut()}><Icon name="logout" className="sm" />Sign out</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <div className="grow">
            <h1 className="page-title">{page.emoji} {page.title}</h1>
            <p className="page-sub">{page.sub}</p>
          </div>
        </header>
        <main className="page" id="main">
          <Suspense fallback={<Skeletons n={3} h={140} />}>
            {key === "dashboard" && <AdminDashboard />}
            {key === "members" && <AdminMembers />}
            {key === "studio" && <ContentStudio route={{ ...route, second }} />}
            {key === "audit" && <AdminAudit />}
            {key === "account" && <ProfileView trackerReady={false} />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
