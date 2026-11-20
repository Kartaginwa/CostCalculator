#!/usr/bin/env python3
"""
AUDIT — Recalcul indépendant du coût de revient (jeu de démonstration « Boréal Mets Préparés inc. »).

Principe : la LOGIQUE ci-dessous est réécrite à partir des conventions de coûtage (coût complet par absorption,
imputation des frais fixes par pools Général/Activité/Canal, main-d'œuvre absorbée selon le taux d'utilisation),
SANS réutiliser le code de l'application. Seules les DONNÉES d'entrée (audit/annexes/demo_inputs.json, exportées du
jeu de démo) sont partagées. Arithmétique en Decimal (précision 40) ; comparaison finale avec la sortie de l'application
(audit/annexes/app_output_demo.json, flottants IEEE-754).

Usage :  python audit/recalculs/recalcul_independant.py
Sortie :  audit/annexes/recalcul_resultats.json  et  audit/annexes/recalcul_resultats.md
"""
import json
import sys
from decimal import Decimal as D, getcontext
from pathlib import Path

getcontext().prec = 40
ROOT = Path(__file__).resolve().parents[2]
INP = json.loads((ROOT / "audit/annexes/demo_inputs.json").read_text(encoding="utf-8"))
APP = json.loads((ROOT / "audit/annexes/app_output_demo.json").read_text(encoding="utf-8"))

d = lambda x: D(str(x)) if x not in (None, "") else D(0)
UNIT = {"g": D(1), "kg": D(1000), "ml": D(1), "L": D(1000), "unité": D(1)}
conv = lambda f, t: UNIT[f] / UNIT[t]
Z = D(0)


def run(inp, productivity_mode="app", only_production_overhead=False, hours_use_stored_nb=False):
    """productivity_mode : 'app' = facteur d'absorption plafonné à 100 % (méthode de l'application) ;
                          'normal' = main-d'œuvre au taux horaire plein (capacité normale, aucune capacité inutilisée absorbée)."""
    ING = {i["id"]: i for i in inp["ingredientsList"]}
    PKG = {i["id"]: i for i in inp["basePackaging"]}
    products = inp["products"]
    fmts = {}
    for p in products:
        for f in p["formats"]:
            fmts[f["id"]] = (p, f)
    subs = {p["id"]: p for p in products if p.get("isIngredient")}

    def nb_of(f):
        g = f.get("yieldGrid")
        if g and g.get("enabled"):
            q = d(g["baseQuantity"])
            for s in g.get("stages", []):
                q *= (1 + d(s["percentEffect"]) / 100)
            rej = d(g.get("rejectRate", 0)) / 100
            q *= (1 - rej)
            return q / d(f["portionSize"])
        return d(f["nbPortions"])

    def resolve_sub(rid):
        for pid, p in subs.items():
            for f in p["formats"]:
                if f["id"] == rid:
                    return p, f
        if rid in subs:
            return subs[rid], subs[rid]["formats"][0]
        return None

    # ---- Paie et heures (absorption) -------------------------------------------------------------
    def emp_cost(e):
        return d(e["workedHours"]) * d(e["hourlyRate"]) * (1 + d(e["socialCharges"]) / 100) * (1 + d(e["vacationPercentage"]) / 100)

    post_rate = {}
    payroll = Z
    for post in inp["laborDatabase"]:
        h = sum((d(e["workedHours"]) for e in post["employees"]), Z)
        c = sum((emp_cost(e) for e in post["employees"]), Z)
        post_rate[post["postName"]] = (c / h) if h > 0 else Z
        payroll += c

    hours = {}
    batches = {}

    def add_batches(p, f, b, path):
        if b <= 0:
            return
        batches[f["id"]] = batches.get(f["id"], Z) + b
        for st in f.get("productionSteps", []):
            for person in st.get("personnel", []):
                hours[person["postId"]] = hours.get(person["postId"], Z) + d(st["duration"]) / 3600 * b
        if f.get("isResaleProduct"):
            return
        for row in f.get("ingredients", []):
            if row["id"] in ING:
                continue
            r = resolve_sub(row["id"])
            if not r or r[1]["id"] in path:
                continue
            sp, sf = r
            q = d(row["quantity"]) * conv(row.get("recipeUnit") or sf["portionUnit"], sf["portionUnit"])
            y = d(row.get("yieldPercentage"))
            if y > 0:
                q /= (y / 100)
            portions = q / d(sf["portionSize"])
            add_batches(sp, sf, b * portions / (d(sf["nbPortions"]) if hours_use_stored_nb else nb_of(sf)), path | {f["id"]})

    for p in products:
        for f in p["formats"]:
            if f.get("onMenu", True) is False:
                continue
            sold = sum((d(cp["volume"]) for cp in f.get("channelPrices", [])), Z)
            add_batches(p, f, sold / (d(f["nbPortions"]) if hours_use_stored_nb else nb_of(f)), frozenset())

    needed = sum((hours.get(post["postName"], Z) * post_rate[post["postName"]] for post in inp["laborDatabase"]), Z)
    productivity = (needed / payroll) if payroll > 0 else D(1)
    factor = productivity if (0 < productivity <= 1) else D(1)
    if productivity_mode == "normal":
        factor = D(1)

    # ---- Coût par lot / par portion --------------------------------------------------------------
    memo = {}

    def cost(fid, stack=()):
        if fid in memo:
            return memo[fid]
        p, f = fmts[fid]
        nb = nb_of(f)
        ps = d(f["portionSize"])
        c = dict(ing=Z, ing_own=Z, ing_sub_mat=Z, ing_sub_pack=Z, ing_sub_lab=Z, ing_sub_st=Z, pack=Z, lab=Z, st=Z)
        if f.get("isResaleProduct"):
            c["ing"] = c["ing_own"] = d(f["purchaseCost"])
        else:
            for row in f.get("ingredients", []):
                q0 = d(row["quantity"])
                if row["id"] in ING:
                    base = ING[row["id"]]
                    price = d(base["purchasePrice"]) / d(base["purchaseFormat"])
                    loss = d(base.get("lossPercentage", 0)) / 100
                    q = q0 * conv(row.get("recipeUnit") or base["unit"], base["unit"])
                    v = q * price
                    if 0 < loss < 1:
                        v /= (1 - loss)
                    y = d(row.get("yieldPercentage"))
                    if y > 0:
                        v /= (y / 100)
                    c["ing"] += v
                    c["ing_own"] += v
                else:
                    r = resolve_sub(row["id"])
                    if not r:
                        continue
                    sp, sf = r
                    sc = cost(sf["id"], stack + (fid,))
                    snb = nb_of(sf)
                    sps = d(sf["portionSize"])
                    q = q0 * conv(row.get("recipeUnit") or sf["portionUnit"], sf["portionUnit"])
                    y = d(row.get("yieldPercentage"))
                    if y > 0:
                        q /= (y / 100)
                    portions = q / sps
                    # coût direct de la sous-recette par portion, décomposé
                    comp = {k: sc[k] / snb for k in ("ing", "pack", "lab", "st")}
                    v = sum(comp.values(), Z) * portions
                    c["ing"] += v
                    c["ing_sub_mat"] += comp["ing"] * portions
                    c["ing_sub_pack"] += comp["pack"] * portions
                    c["ing_sub_lab"] += comp["lab"] * portions
                    c["ing_sub_st"] += comp["st"] * portions
            for row in f.get("packagingItems", []):
                base = PKG[row["id"]]
                price = d(base["purchasePrice"]) / d(base["purchaseFormat"])
                loss = d(base.get("lossPercentage", 0)) / 100
                q = d(row["quantity"]) * conv(row.get("recipeUnit") or base["unit"], base["unit"])
                v = q * price
                if 0 < loss < 1:
                    v /= (1 - loss)
                c["pack"] += v
            lab = Z
            for st in f.get("productionSteps", []):
                for person in st.get("personnel", []):
                    lab += d(st["duration"]) / 3600 * post_rate[person["postId"]]
            c["lab"] = lab / factor
            if f.get("subcontracting", {}).get("enabled"):
                c["st"] = sum((d(i["cost"]) for i in f["subcontracting"]["items"]), Z)
        c["nb"], c["ps"] = nb, ps
        direct_batch = c["ing"] + c["pack"] + c["lab"] + c["st"]
        c["direct_batch"] = direct_batch
        ag = f.get("aging", {})
        c["aging_batch"] = direct_batch * (d(ag["interestRate"]) / 100 / 12) * d(ag["months"]) if ag.get("enabled") else Z
        memo[fid] = c
        return c

    rows = []
    for p in products:
        for f in p["formats"]:
            c = cost(f["id"])
            nb = c["nb"]
            vols = [d(cp["volume"]) for cp in f.get("channelPrices", [])]
            sold = sum(vols, Z)
            rows.append(dict(
                id=f["id"], p=p, f=f, c=c, active=f.get("onMenu", True) is not False, nb=nb,
                mat=c["ing"] / nb, pack=c["pack"] / nb, lab=c["lab"] / nb, st=c["st"] / nb,
                direct=c["direct_batch"] / nb, aging=c["aging_batch"] / nb, sold=sold if sold > 0 else None,
                cbs=[cp for cp in f.get("channelPrices", [])
                     if any(ch["id"] == cp["channelId"] for ch in inp["salesChannels"]) and d(cp["netPrice"]) > 0],
            ))

    # ---- Frais fixes : pools ----------------------------------------------------------------------
    acts = ["general"] + [a["id"] for a in inp["productionActivities"]]
    chans = [c["id"] for c in inp["salesChannels"]]
    act_rows = [r for r in rows if r["active"]]

    def vol_of(r):  # volumes des canaux retenus dans la ventilation (prix net > 0, canal existant)
        return [(cp["channelId"], d(cp["volume"])) for cp in r["cbs"]]

    type_field = {"Matière première": "mat", "Main-d'œuvre directe": "lab", "Emballage": "pack", "Sous-traitance": "st"}
    dc_bucket = {a: Z for a in acts}
    for line in inp["directCostLines"]:
        fld = type_field[line["category"]]
        per_act = {}
        for r in act_rows:
            if r["p"].get("activityId") in acts and r[fld] > 0:
                v = sum((vv for _, vv in vol_of(r)), Z) * r[fld]
                if v > 0:
                    per_act[r["p"]["activityId"]] = per_act.get(r["p"]["activityId"], Z) + v
        grand = sum(per_act.values(), Z)
        amt = d(line["amount"])
        for a in acts:
            if a == "general":
                dc_bucket[a] += amt if grand == 0 else Z
            else:
                dc_bucket[a] += amt * per_act.get(a, Z) / grand if grand > 0 else Z
    total_dc = sum((d(l["amount"]) for l in inp["directCostLines"]), Z)

    def r2(x):
        return x.quantize(D("0.01"), rounding="ROUND_HALF_UP")

    act_pool = {a: Z for a in acts}
    chan_pool = {c: Z for c in chans}
    pool_by_cat = {}  # pour l'indicateur « frais de production seulement »
    for ln in inp["expenseLines"]:
        key = ln.get("repartitionKey") or "manual"
        amt = d(ln["amount"])
        aa, ca = {}, {}
        if key == "manual":
            aa = {k: d(v) for k, v in ln.get("activityAllocations", {}).items()}
            ca = {k: d(v) for k, v in ln.get("channelAllocations", {}).items()}
        elif key == "directCosts":
            for a in acts:
                sh = dc_bucket[a] / total_dc
                if sh > 0:
                    aa[a] = r2(amt * sh)
        elif key.startswith("activity:"):
            aa = {key[9:]: r2(amt)}
        elif key.startswith("custom:"):
            ck = [k for k in inp["repartitionKeys"] if k["id"] == key[7:]][0]
            for a in acts:
                pct = d(ck.get("activityShares", {}).get(a))
                if pct > 0:
                    aa[a] = r2(amt * pct / 100)
            for c in chans:
                pct = d(ck.get("channelShares", {}).get(c))
                if pct > 0:
                    ca[c] = r2(amt * pct / 100)
        include = (not only_production_overhead) or ln["category"] == "Frais généraux de production"
        if include:
            for k, v in aa.items():
                act_pool[k] += v
            for k, v in ca.items():
                chan_pool[k] += v
    total_exp = sum((d(l["amount"]) for l in inp["expenseLines"] if (not only_production_overhead) or l["category"] == "Frais généraux de production"), Z)
    allocated = sum(act_pool.values(), Z) + sum(chan_pool.values(), Z)
    gap = total_exp - allocated
    unalloc = gap if gap > D("0.05") else Z
    act_pool["general"] += unalloc

    gen_total = sum((r["sold"] * r["direct"] for r in act_rows if r["sold"]), Z)
    act_total = {a: Z for a in acts}
    for r in act_rows:
        if r["sold"] and r["p"].get("activityId") in act_total:
            act_total[r["p"]["activityId"]] += r["sold"] * r["direct"]
    chan_total = {c: Z for c in chans}
    for r in act_rows:
        for cp in r["f"].get("channelPrices", []):
            v = d(cp["volume"])
            if cp["channelId"] in chan_total and v > 0:
                chan_total[cp["channelId"]] += r["direct"] * v

    for r in rows:
        r["indGen"] = r["indAct"] = Z
        if r["active"] and r["sold"]:
            if act_pool["general"] > 0 and gen_total > 0:
                r["indGen"] = act_pool["general"] * (r["sold"] * r["direct"] / gen_total) / r["sold"]
            a = r["p"].get("activityId")
            if a in act_total and act_pool[a] > 0 and act_total[a] > 0:
                r["indAct"] = act_pool[a] * (r["sold"] * r["direct"] / act_total[a]) / r["sold"]
        r["chan"] = []
        for cp in r["cbs"]:
            v = d(cp["volume"])
            ind_c = Z
            if r["active"] and chan_pool[cp["channelId"]] > 0 and chan_total[cp["channelId"]] > 0 and v > 0:
                ind_c = r["direct"] * chan_pool[cp["channelId"]] / chan_total[cp["channelId"]]
            price = d(cp["netPrice"])
            r["chan"].append(dict(id=cp["channelId"], price=price, vol=v, indCan=ind_c,
                                  margeNette=price - (r["direct"] + r["indGen"] + r["indAct"] + ind_c + r["aging"])))
        vtot = sum((c["vol"] for c in r["chan"]), Z)
        r["indCan"] = (sum((c["indCan"] * c["vol"] for c in r["chan"]), Z) / vtot) if vtot > 0 else Z
        r["indTot"] = r["indGen"] + r["indAct"] + r["indCan"]
        r["total"] = r["direct"] + r["indTot"] + r["aging"]

    return dict(rows=rows, payroll=payroll, needed=needed, productivity=productivity, factor=factor, hours=hours,
                pools=dict(act=act_pool, chan=chan_pool, general_total=gen_total, unalloc=unalloc, total_exp=total_exp),
                batches=batches)


def main():
    R = run(INP)
    out = {"productivite_pct": float(R["productivity"] * 100), "paie_totale": float(R["payroll"]),
           "paie_absorbee_heures_necessaires": float(R["needed"]), "pools": {k: (float(v) if not isinstance(v, dict) else {kk: float(vv) for kk, vv in v.items()}) for k, v in R["pools"].items()}}
    app = {r["id"]: r for r in APP["rows"]}
    comp = []
    fields = [("matiere", "mat"), ("emb", "pack"), ("mo", "lab"), ("st", "st"), ("direct", "direct"), ("indGen", "indGen"), ("indAct", "indAct"), ("indCan", "indCan"), ("aging", "aging"), ("total", "total")]
    maxabs = 0.0
    for r in R["rows"]:
        a = app[r["id"]]
        for fa, fr in fields:
            av = D(str(a.get(fa) if a.get(fa) is not None else 0))
            rv = r[fr]
            diff = rv - av
            maxabs = max(maxabs, abs(float(diff)))
            comp.append(dict(id=r["id"], champ=fa, app=float(av), recalcul=float(rv), ecart=float(diff), ecart_pct=float(diff / av * 100) if av != 0 else None))
        # canaux
        for ch in r["chan"]:
            m = [c for c in a["channels"] if c["id"] == ch["id"]]
            if m:
                diff = ch["margeNette"] - D(str(m[0]["margeNette"]))
                maxabs = max(maxabs, abs(float(diff)))
                comp.append(dict(id=r["id"], champ=f"margeNette@{ch['id']}", app=m[0]["margeNette"], recalcul=float(ch["margeNette"]), ecart=float(diff),
                                 ecart_pct=float(diff / abs(D(str(m[0]["margeNette"]))) * 100) if m[0]["margeNette"] else None))
    out["comparaison"] = comp
    out["ecart_absolu_max"] = maxabs
    out["productivite_app_pct"] = APP["kitchenProductivity"]

    # ---- Cohérence interne ---------------------------------------------------------------------
    act = [r for r in R["rows"] if r["active"]]
    sold_ind = sum((r["indTot"] * r["sold"] for r in act if r["sold"]), Z)
    coh = {}
    coh["frais_fixes_absorbes"] = float(sold_ind)
    coh["frais_fixes_saisis"] = float(R["pools"]["total_exp"])
    coh["ecart_absorption_frais_fixes"] = float(sold_ind - R["pools"]["total_exp"])
    # Bénéfice net théorique = Σ (prix - coût complet) × vol sur tous les canaux ventilés
    rev = sum((c["price"] * c["vol"] for r in act for c in r["chan"]), Z)
    dir_cost = sum((r["direct"] * c["vol"] for r in act for c in r["chan"]), Z)
    aging = sum((r["aging"] * c["vol"] for r in act for c in r["chan"]), Z)
    net_sum = sum((c["margeNette"] * c["vol"] for r in act for c in r["chan"]), Z)
    coh.update(revenu_theorique=float(rev), cout_direct_theorique=float(dir_cost), vieillissement=float(aging),
               benefice_net_somme_lignes=float(net_sum), benefice_net_bilan=float(rev - dir_cost - R["pools"]["total_exp"] - aging),
               ecart_bilan_vs_lignes=float(net_sum - (rev - dir_cost - R["pools"]["total_exp"] - aging)))
    # Paie absorbée
    labor_abs = sum((r["c"]["lab"] / r["nb"] * (r["sold"] or Z) for r in act), Z)  # MO propre, formats vendus
    # MO des sous-recettes consommées (logée dans la 'matière' du parent)
    sub_lab = sum((r["c"]["ing_sub_lab"] / r["nb"] * (r["sold"] or Z) for r in act), Z)
    coh.update(paie_totale=float(R["payroll"]), mo_absorbee_lignes_MO=float(labor_abs), mo_sous_recettes_dans_matiere=float(sub_lab),
               mo_absorbee_totale=float(labor_abs + sub_lab), ecart_paie_vs_absorbee=float(labor_abs + sub_lab - R["payroll"]))
    # Déversement de coûts de sous-recettes dans « matière »
    sub_pack = sum((r["c"]["ing_sub_pack"] / r["nb"] * (r["sold"] or Z) for r in act), Z)
    sub_st = sum((r["c"]["ing_sub_st"] / r["nb"] * (r["sold"] or Z) for r in act), Z)
    mat_total = sum((r["mat"] * (r["sold"] or Z) for r in act), Z)
    coh.update(matiere_totale_app=float(mat_total), dont_emballage_de_sous_recettes=float(sub_pack), dont_MO_de_sous_recettes=float(sub_lab), dont_sous_traitance_de_sous_recettes=float(sub_st))
    out["coherence"] = coh

    # ---- Bilan-matières (ingrédients en g-équivalents, ml≈g, par rapport à la production nominale) ----
    mb = []
    for r in R["rows"]:
        f = r["f"]
        if f.get("isResaleProduct"):
            continue
        mass = Z
        for row in f.get("ingredients", []):
            u = row.get("recipeUnit")
            mass += d(row["quantity"]) * UNIT[u]
        outm = r["nb"] * d(f["portionSize"]) * UNIT[f["portionUnit"]]
        mb.append(dict(id=r["id"], intrants_g_eq=float(mass), extrant_nominal_g_eq=float(outm), ratio=float(outm / mass) if mass else None))
    out["bilan_matieres"] = mb

    # ---- Cohérence prix unitaire stocké vs prix d'achat / format ----------------------------------
    drift = []
    for i in INP["ingredientsList"] + INP["basePackaging"]:
        calc = d(i["purchasePrice"]) / d(i["purchaseFormat"])
        if abs(calc - d(i["unitPrice"])) > D("0.0000001"):
            drift.append(dict(id=i["id"], unitPrice_stocke=i["unitPrice"], recalcule=float(calc)))
    out["prix_unitaires_derives"] = drift

    # ---- Variante : capacité normale (aucune capacité inutilisée absorbée) -------------------------
    N = run(INP, productivity_mode="normal")
    P = run(INP, productivity_mode="normal", only_production_overhead=True)
    var = []
    for r, n, pp in zip(R["rows"], N["rows"], P["rows"]):
        if not r["active"]:
            continue
        var.append(dict(id=r["id"], total_app=float(r["total"]), mo_app=float(r["lab"]), total_capacite_normale=float(n["total"]), mo_capacite_normale=float(n["lab"]),
                        total_capacite_normale_prod_seulement=float(pp["total"]), direct_capacite_normale=float(pp["direct"]),
                        cout_stock_IAS2_indicatif=float(pp["direct"] + pp["indGen"] + pp["indAct"])))
    out["variante_IAS2"] = var
    idle = R["payroll"] - R["needed"]
    out["capacite_inutilisee_dollars"] = float(idle)
    H = run(INP, hours_use_stored_nb=True)
    out["diagnostic_heures_nbPortions_stocke"] = dict(productivite_pct=float(H["productivity"] * 100), ecart_vs_application_pts=float(H["productivity"] * 100 - D(str(APP["kitchenProductivity"]))))

    (ROOT / "audit/annexes/recalcul_resultats.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")

    # ---- Rapport markdown -------------------------------------------------------------------------
    L = []
    L.append("# Résultats du recalcul indépendant (jeu de démonstration)\n")
    L.append(f"- Productivité (taux d'absorption de la main-d'œuvre) : recalcul **{out['productivite_pct']:.6f} %** — application **{APP['kitchenProductivity']:.6f} %**")
    L.append(f"- Paie totale chargée : {out['paie_totale']:.2f} $ ; coût des heures nécessaires : {out['paie_absorbee_heures_necessaires']:.2f} $ ; capacité inutilisée : {out['capacite_inutilisee_dollars']:.2f} $")
    L.append(f"- Écart absolu maximal toutes valeurs confondues (par portion, $) : **{maxabs:.3e}**\n")
    L.append("## Coût complet par portion (extrait : champs `direct`, `indTot`, `total`)\n")
    L.append("| Format | Champ | Application | Recalcul | Écart $ | Écart % |")
    L.append("|---|---|---:|---:|---:|---:|")
    for c in comp:
        if c["champ"] in ("direct", "total", "mo", "matiere"):
            pc = f"{c['ecart_pct']:.4f} %" if c["ecart_pct"] is not None else "n/a"
            L.append(f"| {c['id']} | {c['champ']} | {c['app']:.6f} | {c['recalcul']:.6f} | {c['ecart']:+.2e} | {pc} |")
    L.append("\n## Cohérence interne\n")
    for k, v in coh.items():
        L.append(f"- {k} : {v:,.4f}")
    L.append("\n## Bilan-matières (intrants vs extrant nominal, ml ≈ g)\n")
    L.append("| Format | Intrants (g-éq.) | Extrant nominal (g-éq.) | Extrant/Intrants |")
    L.append("|---|---:|---:|---:|")
    for m in mb:
        L.append(f"| {m['id']} | {m['intrants_g_eq']:.0f} | {m['extrant_nominal_g_eq']:.0f} | {m['ratio']:.3f} |")
    L.append("\n## Variante « capacité normale » (aucune capacité inutilisée absorbée) et frais de production seulement\n")
    L.append("| Format | Total app | MO app | Total cap. normale | MO cap. normale | Coût stock IAS 2 indicatif |")
    L.append("|---|---:|---:|---:|---:|---:|")
    for v in var:
        L.append(f"| {v['id']} | {v['total_app']:.4f} | {v['mo_app']:.4f} | {v['total_capacite_normale']:.4f} | {v['mo_capacite_normale']:.4f} | {v['cout_stock_IAS2_indicatif']:.4f} |")
    L.append(f"\nPrix unitaires dont la valeur stockée diffère de prix d'achat ÷ format : {len(drift)}")
    (ROOT / "audit/annexes/recalcul_resultats.md").write_text("\n".join(L), encoding="utf-8")
    L.append(f"\nDiagnostic : productivité recalculée avec le nbPortions STOCKÉ (et non celui de la grille) pour les heures : {out['diagnostic_heures_nbPortions_stocke']['productivite_pct']:.6f} % (écart vs application : {out['diagnostic_heures_nbPortions_stocke']['ecart_vs_application_pts']:.2e} pt)")
    (ROOT / "audit/annexes/recalcul_resultats.md").write_text("\n".join(L), encoding="utf-8")
    print(L[-1].encode("ascii", "replace").decode())


if __name__ == "__main__":
    sys.exit(main())
