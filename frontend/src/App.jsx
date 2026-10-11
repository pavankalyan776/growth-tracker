import { lazy, Suspense, useEffect, useMemo } from "react";
import AuthScreen from "./components/AuthScreen";
import AppShell from "./components/AppShell";
import Onboarding from "./components/Onboarding";
import TodayView from "./components/TodayView";
import { ErrorNote, Skeletons } from "./components/ui";
import { AuthProvider, useAuth } from "./auth";
import { LookProvider, useLook } from "./look";
import { GameProvider, useGame } from "./game";
import { useRoute } from "./router";

/* Today loads with the app. Everything else is a separate chunk, fetched when first opened and
   pre-fetched while the browser is idle, so moving between pages never waits on a download. */
const loaders = {
  calendar: () => import("./components/CalendarView"),
  quests: () => import("./components/QuestManager"),
  challenges: () => import("./components/ChallengesView"),
  hall: () => import("./components/HallView"),
  progress: () => import("./components/ProgressView"),
  shop: () => import("./components/ShopView"),
  achievements: () => import("./components/AchievementsView"),
  profile: () => import("./components/ProfileView"),
};
const pages = Object.fromEntries(Object.entries(loaders).map(([k, f]) => [k, lazy(f)]));
const AdminApp = lazy(() => import("./components/admin/AdminApp"));

const pageMeta = (w) => ({
  today: { title: "🏠 Today", sub: w.todaySub },
  calendar: { title: "🗓️ Plan", sub: "Tap a day to open it" },
  quests: { title: "🗓️ Plan", sub: w.myHabitsSub },
  challenges: { title: "🎯 Challenges", sub: "Dares, bosses and goals you design yourself" },
  hall: { title: "🎯 Challenges", sub: w.hallSub },
  progress: { title: "📈 Progress", sub: "How you are really doing" },
  shop: { title: "🎁 Rewards", sub: w.rewardsSub },
  achievements: { title: "🎁 Rewards", sub: w.milestonesSub },
  profile: { title: "👤 Profile", sub: "Account and settings" },
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
        <div className="card offline" role="alert">
          <span className="emoji" style={{ fontSize: "2.6rem" }} aria-hidden="true">🔌</span>
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
  return <div className="splash" role="status" aria-label="Loading"><span className="splash-mark emoji" aria-hidden="true">🌅</span></div>;
}

function Authed() {
  const { user } = useAuth();
  const route = useRoute();
  const isAdmin = user.role === "admin";

  // A long sign-in page leaves the scroll position low; start the app at the top.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Admins land in the admin console, unless they opened a specific link.
  useEffect(() => {
    if (isAdmin && !window.location.hash.replace("#", "").replace("/", "")) route.navigate("admin");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm the other pages' code once the first screen is up.
  useEffect(() => {
    const run = () => { Object.values(loaders).forEach((f) => f().catch(() => {})); if (isAdmin) import("./components/admin/AdminApp"); };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 2000);
    return () => window.clearTimeout(id);
  }, [isAdmin]);

  if (route.name === "admin") {
    if (!isAdmin) return <Redirect to="today" route={route} />;
    return <Suspense fallback={<Splash />}><AdminApp route={route} /></Suspense>;
  }

  if (!user.onboarded) {
    return <Onboarding onSkipToAdmin={isAdmin ? () => route.navigate("admin") : undefined} />;
  }
  return <GameProvider><Frame route={route} /></GameProvider>;
}

function Redirect({ to, route }) {
  useEffect(() => { route.navigate(to); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Splash />;
}

function Frame({ route }) {
  const game = useGame();
  const { w } = useLook();
  const meta = useMemo(() => pageMeta(w), [w]);
  const page = meta[route.name];

  useEffect(() => { if (!page) route.navigate("today"); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!page) return <Splash />;

  let subtitle = page.sub;
  if (route.name === "today" && game.overview && game.overview.plan.days) {
    const p = game.overview.plan;
    subtitle = p.started ? `📍 Day ${Math.min(p.day, p.days)} of ${p.days} · ${p.days_left} days left` : `🗓️ Your plan starts on ${p.start}`;
  }

  let body;
  if (game.loadError && !game.overview) {
    body = <ErrorNote error={game.loadError} onRetry={game.refresh} />;
  } else if (route.name === "today") {
    body = <TodayView dateKey={route.param} route={route} />;
  } else {
    const Page = pages[route.name];
    body = <Suspense fallback={<Skeletons n={3} h={140} />}><Page route={route} trackerReady /></Suspense>;
  }

  return (
    <AppShell route={route} title={page.title} subtitle={subtitle} trackerReady>
      {body}
    </AppShell>
  );
}
