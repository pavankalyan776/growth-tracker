import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, ErrorNote, Skeletons } from "./ui";
import { api } from "../api";
import { useGame } from "../game";
import { useLook } from "../look";

const EARN = [
  ["☀️", "Daily login", "+5"],
  ["⭐", "Perfect day", "+10"],
  ["🎲", "Daily dare", "+5"],
  ["⚔️", "Weekly boss", "+40"],
  ["🎯", "Your own challenge", "+15"],
  ["🏆", "Monthly achievement", "+100"],
];

/* Titles are tiered by price so a bigger goal feels bigger. */
const tier = (cost) => (cost === 0 ? ["starter", "Starter"] : cost <= 40 ? ["common", "Common"] : cost <= 80 ? ["uncommon", "Uncommon"]
  : cost <= 150 ? ["rare", "Rare"] : cost <= 250 ? ["epic", "Epic"] : ["legend", "Legendary"]);

function Action({ item, coins, busy, onBuy, onEquip }) {
  const short = item.cost - coins;
  if (item.equipped) return <span className="chip ok">✅ Equipped</span>;
  if (item.owned) return <button type="button" className="btn ghost sm" onClick={() => onEquip(item)} disabled={busy}>Equip</button>;
  return (
    <div className="buy">
      <button type="button" className="btn gold sm" onClick={() => onBuy(item)} disabled={busy || short > 0}
        aria-label={item.cost === 0 ? `Claim ${item.label}, free` : `Buy ${item.label} for ${item.cost} coins`}>{item.cost === 0 ? "🎁 Claim free" : `🪙 ${item.cost}`}</button>
      {short > 0 ? <span className="buy-need">{short} to go</span> : null}
    </div>
  );
}

function ThemeCard({ item, coins, busy, onBuy, onEquip }) {
  const { dark } = useLook();
  const a = dark ? item.fill : item.light;
  const b = dark ? item.fill2 : item.light2;
  const locked = !item.owned && item.cost > coins;
  return (
    <li className={`theme-card${item.equipped ? " is-equipped" : ""}${locked ? " is-locked" : ""}`} style={{ "--t1": a, "--t2": b }}>
      <div className="theme-preview" aria-hidden="true">
        <div className="tp-hero"><span className="tp-ring" /><span className="tp-lines"><i /><i /></span></div>
        <div className="tp-row"><i /><i /><b /></div>
        <span className="theme-emoji emoji">{item.emoji}</span>
      </div>
      <div className="theme-body">
        <div className="theme-top"><b className="display">{item.label}</b>{item.cost === 0 ? <span className="chip">Free</span> : null}</div>
        <p className="small muted">{item.desc}</p>
        {locked ? <Bar value={coins} max={item.cost} thin label={`Coins towards ${item.label}`} /> : null}
      </div>
      <div className="theme-foot"><Action item={item} coins={coins} busy={busy} onBuy={onBuy} onEquip={onEquip} /></div>
    </li>
  );
}

function TitleRow({ item, coins, busy, onBuy, onEquip }) {
  const { w } = useLook();
  const [tone, tierLabel] = tier(item.cost);
  const locked = !item.owned && item.cost > coins;
  return (
    <li className={`title-row tier-${tone}${item.equipped ? " is-equipped" : ""}${locked ? " is-locked" : ""}`}>
      <span className="title-badge emoji" aria-hidden="true">{item.emoji}</span>
      <div className="title-main">
        <div className="title-name"><b className="display">{w.style === "calm" ? item.calm : item.label}</b><span className="tier-tag">{tierLabel}</span></div>
        <p className="small muted">{item.desc}</p>
        {locked ? <Bar value={coins} max={item.cost} thin label={`Coins towards ${item.label}`} /> : null}
      </div>
      <Action item={item} coins={coins} busy={busy} onBuy={onBuy} onEquip={onEquip} />
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

  const next = useMemo(() => {
    if (!shop) return null;
    const open = shop.items.filter((i) => !i.owned && i.cost > 0).sort((x, y) => x.cost - y.cost);
    return open[0] || null;
  }, [shop]);

  if (error && !shop) return <ErrorNote error={error} />;
  if (!shop) return <Skeletons n={2} h={220} />;

  const titles = shop.items.filter((i) => i.kind === "title");
  const themes = shop.items.filter((i) => i.kind === "theme");
  const owned = shop.items.filter((i) => i.owned).length;
  const buy = (it) => act(() => api.buyItem(it.key), `${it.label} unlocked`, "🎉");
  const equip = (it) => act(() => api.equipItem(it.key), `${it.label} equipped`, "✨");
  const props = { coins: shop.coins, busy, onBuy: buy, onEquip: equip };

  return (
    <div className="stack">
      <section className="wallet-hero" aria-label="Your coins">
        <div className="wallet-main">
          <span className="wallet-kicker">Your coins</span>
          <div className="wallet-count"><span className="emoji" aria-hidden="true">🪙</span><span className="num">{shop.coins}</span></div>
          <p className="wallet-line">{owned} of {shop.items.length} rewards unlocked</p>
          {next ? (
            <div className="wallet-next">
              <div className="wallet-next-top">
                <span>🎯 Next up: <b>{next.kind === "title" && next.calm ? next.calm : next.label}</b></span>
                <span>{next.cost <= shop.coins ? "Ready to buy!" : `${next.cost - shop.coins} coins to go`}</span>
              </div>
              <Bar value={shop.coins} max={next.cost} thin label={`Coins towards ${next.label}`} />
            </div>
          ) : <p className="wallet-line">🎉 You've unlocked everything.</p>}
        </div>
        <div className="wallet-earn">
          <b>How to earn</b>
          <ul>
            {EARN.map(([e, t, n]) => <li key={t}><span className="emoji" aria-hidden="true">{e}</span><span>{t}</span><b>{n}</b></li>)}
          </ul>
        </div>
      </section>
      <p className="small muted shop-note">Everything here is virtual and cosmetic. Streak shields are bought from a missed day. 🛡️</p>

      <section>
        <div className="shelf-head"><h2 className="display">🎨 Colour themes</h2><span className="muted small">Recolours the whole app</span></div>
        <ul className="theme-grid">{themes.map((i) => <ThemeCard key={i.key} item={i} {...props} />)}</ul>
      </section>

      <section>
        <div className="shelf-head"><h2 className="display">🏷️ Titles</h2><span className="muted small">Shown under your name</span></div>
        <ul className="title-grid">{titles.map((i) => <TitleRow key={i.key} item={i} {...props} />)}</ul>
      </section>
    </div>
  );
}
