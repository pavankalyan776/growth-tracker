import { useEffect, useMemo, useState } from "react";
import AuthScreen from "./components/AuthScreen";
import Onboarding from "./components/Onboarding";
import Shell from "./components/Shell";
import Icon from "./components/icons";
import TodayView from "./components/TodayView";
import CalendarView from "./components/CalendarView";
import ProgressView from "./components/ProgressView";
import QuestManager from "./components/QuestManager";
import ShopView from "./components/ShopView";
import AchievementsView from "./components/AchievementsView";
import ProfileView from "./components/ProfileView";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminUsers from "./components/admin/AdminUsers";
import AdminAudit from "./components/admin/AdminAudit";
import HallView from "./components/HallView";
import { AuthProvider, useAuth } from "./auth";
import { LookProvider, useLook } from "./look";
import { GameProvider, useGame } from "./game";
import { useRoute } from "./router";

const trackerPages = (w) => ({
  today: { title: "Today", sub: w.todaySub },
  calendar: { title: "Calendar", sub: "Tap a day to open it" },
  progress: { title: "Progress", sub: "How you are really doing" },
  hall: { title: w.hall, sub: w.hallSub },
  quests: { title: w.habits, sub: w.habitsSub },
  shop: { title: w.rewards, sub: w.rewardsSub },
  achievements: { title: w.milestones, sub: w.milestonesSub },
});
const otherPages = (w) => ({
  profile: { title: "Profile", sub: "Account and settings" },
  admin: { title: "Admin overview", sub: "How the product is being used" },
  "admin/users": { title: w.members, sub: w.membersSub },
  "admin/audit": { title: "Audit log", sub: "Who did what, and when" },
});

export default function App() {
  return (
    <LookProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </LookProvider>
  );
}

function Root() {
  const { status, retry, notice } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "error") {
    return (
      <div className="splash">
        <div className="panel offline" role="alert">
          <Icon name="alert" className="lg" />
          <h1 className="display">Can't reach the server</h1>
          <p className="muted">{notice}</p>
          <button type="button" className="btn" onClick={retry}>Try again</button>
        </div>
      </div>
    );
  }
  if (status === "anon") return <AuthScreen />;
  return <Authed />;
}

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <svg viewBox="0 0 32 32" className="splash-mark" aria-hidden="true"><path d="M5 28V14a11 11 0 0 1 22 0v14" /><path d="M11 28V17a5 5 0 0 1 10 0v11" /></svg>
    </div>
  );
}

function Authed() {
  const { user } = useAuth();
  const route = useRoute();
  const [skipped, setSkipped] = useState(() => {
    try { return sessionStorage.getItem("gt-skip-onboarding") === "1"; } catch { return false; }
  });
  const isAdmin = user.role === "admin";
  const setSkip = (v) => {
    try { if (v) sessionStorage.setItem("gt-skip-onboarding", "1"); else sessionStorage.removeItem("gt-skip-onboarding"); } catch { /* ignore */ }
    setSkipped(v);
  };

  if (!user.onboarded && !(isAdmin && skipped)) {
    return <Onboarding onSkipToAdmin={isAdmin ? () => { setSkip(true); route.navigate("admin"); } : undefined} />;
  }
  const frame = <Frame route={route} onSetup={() => setSkip(false)} />;
  return user.onboarded ? <GameProvider>{frame}</GameProvider> : frame;
}

function Frame({ route, onSetup }) {
  const { user } = useAuth();
  const game = useGame();
  const trackerReady = user.onboarded;
  const isAdmin = user.role === "admin";
  const { w } = useLook();
  const TRACKER_PAGES = useMemo(() => trackerPages(w), [w]);
  const key = route.name === "admin" && route.param ? `admin/${route.param}` : route.name;
  const page = TRACKER_PAGES[key] || otherPages(w)[key];

  // Anything unknown, or admin pages for non-admins, falls back to the home page.
  useEffect(() => {
    const known = !!page;
    const blocked = key.startsWith("admin") && !isAdmin;
    if (!known || blocked) route.navigate(trackerReady ? "today" : isAdmin ? "admin" : "profile");
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  let subtitle = page ? page.sub : "";
  if (key.startsWith("admin") && !isAdmin) body = null;
  else if (TRACKER_PAGES[key] && !trackerReady) {
    body = (
      <div className="panel empty">
        <div className="display">Set up your tracker</div>
        <p style={{ marginBottom: 16 }}>You skipped setup. Choose your quests and plan window to start tracking.</p>
        <button type="button" className="btn" onClick={onSetup}>Set up my tracker</button>
      </div>
    );
  } else if (key === "today") {
    body = <TodayView dateKey={route.param} route={route} />;
    if (game && game.overview && game.overview.plan.days) {
      const p = game.overview.plan;
      subtitle = p.started ? `Day ${Math.min(p.day, p.days)} of ${p.days}, ${p.days_left} days left` : `Your plan starts on ${p.start}`;
    }
  } else if (key === "calendar") body = <CalendarView route={route} />;
  else if (key === "progress") body = <ProgressView route={route} />;
  else if (key === "quests") body = <QuestManager />;
  else if (key === "hall") body = <HallView />;
  else if (key === "shop") body = <ShopView />;
  else if (key === "achievements") body = <AchievementsView />;
  else if (key === "profile") body = <ProfileView trackerReady={trackerReady} />;
  else if (key === "admin") body = <AdminDashboard />;
  else if (key === "admin/users") body = <AdminUsers />;
  else if (key === "admin/audit") body = <AdminAudit />;

  return (
    <Shell route={route} title={page ? page.title : ""} subtitle={subtitle} trackerReady={trackerReady}>
      {game && game.loadError && !game.overview ? (
        <div className="alert error" role="alert"><Icon name="alert" />{game.loadError} <button type="button" className="link-btn" onClick={game.refresh}>Retry</button></div>
      ) : body}
    </Shell>
  );
}
