import { useCallback, useEffect, useState } from "react";
import { ErrorNote, Skeletons } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";

function Item({ item, coins, busy, onBuy, onEquip }) {
  const { w, dark } = useLook();
  const short = item.cost - coins;
  const isTheme = item.kind === "theme";
  const swatch = isTheme
    ? { background: `linear-gradient(135deg, ${dark ? item.fill : item.light}, ${dark ? item.fill2 : item.light2})` }
    : undefined;
  return (
    <li className={`item${item.equipped ? " is-equipped" : ""}`}>
      <span className="swatch" style={swatch || { background: "var(--card)" }} aria-hidden="true">
        <span className="emoji">{item.emoji || "🎁"}</span>
      </span>
      <b className="item-name">{item.kind === "title" && w.style === "calm" ? item.calm : item.label}</b>
      <p className="small muted">{item.desc}</p>
      {item.equipped ? <span className="chip ok">✅ Equipped</span>
        : item.owned ? <button type="button" className="btn ghost sm" onClick={() => onEquip(item)} disabled={busy}>Equip</button>
        : <button type="button" className="btn gold sm" onClick={() => onBuy(item)} disabled={busy || short > 0}>🪙 {item.cost}</button>}
      {!item.owned && short > 0 ? <span className="help">{short} more coins</span> : null}
    </li>
  );
}

export default function ShopView() {
  const { refresh, toast } = useGame();
  const [shop, setShop] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api.getShop().then(setShop).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okTitle, emoji) => {
    setBusy(true);
    try { setShop(await fn()); await refresh(); toast({ emoji, title: okTitle }); }
    catch (e) { toast({ kind: "bad", emoji: "⚠️", title: "Couldn't do that", body: e.message }); }
    setBusy(false);
  };

  if (error && !shop) return <ErrorNote error={error} />;
  if (!shop) return <Skeletons n={2} h={220} />;

  const titles = shop.items.filter((i) => i.kind === "title");
  const themes = shop.items.filter((i) => i.kind === "theme");
  const buy = (it) => act(() => api.buyItem(it.key), `${it.label} unlocked`, "🎉");
  const equip = (it) => act(() => api.equipItem(it.key), `${it.label} equipped`, "✨");
  return (
    <div className="stack">
      <section className="card tint wallet">
        <div>
          <div className="muted small">Your coins</div>
          <div className="num wallet-num"><span className="emoji" aria-hidden="true">🪙</span>{shop.coins}</div>
        </div>
        <p className="muted wallet-note">Coins come from daily logins (+5), perfect days (+10), daily dares (+5), weekly bosses (+40), your own challenges (+15), monthly achievements (+100) and milestones. Everything here is virtual and cosmetic. Streak shields are bought from a missed day. 🛡️</p>
      </section>
      <section className="card">
        <div className="card-head"><h3 className="card-title">🎨 Colours</h3><span className="card-sub">Recolour the whole app</span></div>
        <ul className="shop-grid">{themes.map((i) => <Item key={i.key} item={i} coins={shop.coins} busy={busy} onBuy={buy} onEquip={equip} />)}</ul>
      </section>
      <section className="card">
        <div className="card-head"><h3 className="card-title">🏷️ Titles</h3><span className="card-sub">Shown under your name</span></div>
        <ul className="shop-grid">{titles.map((i) => <Item key={i.key} item={i} coins={shop.coins} busy={busy} onBuy={buy} onEquip={equip} />)}</ul>
      </section>
    </div>
  );
}
