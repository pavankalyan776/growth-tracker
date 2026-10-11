import { useCallback, useEffect, useState } from "react";
import Icon from "./icons";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";

function Item({ item, coins, busy, onBuy, onEquip }) {
  const { w } = useLook();
  const short = item.cost - coins;
  const isTheme = item.kind === "theme";
  return (
    <li className={`relic${item.equipped ? " is-equipped" : ""}`} style={isTheme ? { "--swatch": item.fill } : undefined}>
      <div className="relic-art" aria-hidden="true">
        {isTheme ? <span className="swatch" /> : <Icon name={w.style === "calm" ? "star" : "swords"} className="lg" />}
      </div>
      <div className="grow">
        <b className="display relic-name">{item.kind === "title" && w.style === "calm" ? item.calm : item.label}</b>
        <p className="small muted">{item.desc}</p>
      </div>
      <div className="relic-action">
        {item.equipped ? <span className="chip cyan"><Icon name="check" />Equipped</span>
          : item.owned ? <button type="button" className="btn ghost sm" onClick={() => onEquip(item)} disabled={busy}>Equip</button>
          : <button type="button" className="btn gold sm" onClick={() => onBuy(item)} disabled={busy || short > 0}>
              <Icon name="coin" className="sm" />{item.cost}
            </button>}
        {!item.owned && short > 0 ? <span className="help">{short} more coins</span> : null}
      </div>
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

  const act = async (fn, okTitle) => {
    setBusy(true);
    try { setShop(await fn()); await refresh(); toast({ icon: "check", title: okTitle }); }
    catch (e) { toast({ icon: "alert", title: "Couldn't do that", body: e.message }); }
    setBusy(false);
  };

  if (error) return <div className="alert error" role="alert"><Icon name="alert" />{error}</div>;
  if (!shop) return <div className="stack"><div className="skel" style={{ height: 120 }} /><div className="skel" style={{ height: 320 }} /></div>;

  const titles = shop.items.filter((i) => i.kind === "title");
  const themes = shop.items.filter((i) => i.kind === "theme");
  return (
    <div className="stack">
      <section className="panel tone wallet">
        <div>
          <div className="muted small">Your coins</div>
          <div className="num wallet-num"><Icon name="coin" className="lg" />{shop.coins}</div>
        </div>
        <p className="muted wallet-note">Coins come from daily logins (+5), perfect days (+10), daily dares (+5), weekly bosses (+40), monthly achievements (+100) and milestones. Everything here is virtual and cosmetic. Streak shields are bought from a missed day.</p>
      </section>
      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Colours</h3><span className="panel-sub">Recolour the whole app</span></div>
          <ul className="relics">{themes.map((i) => <Item key={i.key} item={i} coins={shop.coins} busy={busy}
            onBuy={(it) => act(() => api.buyItem(it.key), `${it.label} unlocked`)} onEquip={(it) => act(() => api.equipItem(it.key), `${it.label} equipped`)} />)}</ul>
        </section>
        <section className="panel">
          <div className="panel-head"><h3 className="panel-title">Titles</h3><span className="panel-sub">Shown under your name</span></div>
          <ul className="relics">{titles.map((i) => <Item key={i.key} item={i} coins={shop.coins} busy={busy}
            onBuy={(it) => act(() => api.buyItem(it.key), `${it.label} unlocked`)} onEquip={(it) => act(() => api.equipItem(it.key), `${it.label} equipped`)} />)}</ul>
        </section>
      </div>
    </div>
  );
}
