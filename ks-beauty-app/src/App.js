import { useState, useEffect } from "react";
import {
  collection, onSnapshot, doc,
  setDoc, deleteDoc, updateDoc, increment
} from "firebase/firestore";
import { db } from "./firebase";

// ── CONSTANTES ────────────────────────────────────────────────────
const SOINS_CATALOGUE = [
  { id:"eclat_express",     nom:"Éclat Express",         duree:"30 min",  prix:"20 000 F", categorie:"Soins Visage" },
  { id:"anti_taches",       nom:"Anti-Taches Signature", duree:"1h00",    prix:"35 000 F", categorie:"Soins Visage" },
  { id:"vitamin_c_glow",    nom:"Vitamin C Glow",        duree:"1h15",    prix:"40 000 F", categorie:"Soins Visage" },
  { id:"night_repair_luxe", nom:"Night Repair Luxe",     duree:"1h30",    prix:"50 000 F", categorie:"Soins Visage" },
  { id:"dermaplaning",      nom:"Dermaplaning (add-on)", duree:"+15 min", prix:"+5 000 F", categorie:"Option Add-On" },
  { id:"diagnostic_peau",   nom:"Diagnostic de Peau",   duree:"20 min",  prix:"10 000 F", categorie:"Service Boutique" },
];
const SOIN_COLORS = {
  eclat_express:"#4fc3c3", anti_taches:"#f0a500",
  vitamin_c_glow:"#7e57c2", night_repair_luxe:"#e57373",
  dermaplaning:"#81c784", diagnostic_peau:"#64b5f6",
};
const ADRESSE    = "K's Make Up Addict, 7ème Tranche, en face des 2 stations Shell, Abidjan";
const MAPS_LINK  = "https://maps.app.goo.gl/hNbSzDaM3YeJmfo19";
const PHONE_STUDIO = "2250584913471";
const TYPES_PEAU = ["Normale","Sèche","Grasse","Mixte","Sensible","Déshydratée","Mature","À tendance acnéique"];
const PROBLEMATIQUES = ["Acné","Points noirs","Taches","Rides & ridules","Sécheresse","Déshydratation","Brillance","Sensibilité","Cernes","Pores dilatés","Teint terne","Rougeurs","Hyperpigmentation","Relâchement"];
const EMPTY_FORM = { prenom:"",nom:"",telephone:"",email:"",dateNaissance:"",typesPeau:[],allergies:"",traitementsEnCours:"",problematiquesPeau:[],soins:[],produitsUtilises:"",notes:"",dateVisite:toIso(new Date()),seances:0 };

// ── helpers date ──────────────────────────────────────────────────
const JOURS = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
const MOIS  = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_COURT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function parseDate(s){ const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function toIso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfWeek(d){ const r=new Date(d); const day=r.getDay(); r.setDate(r.getDate()-(day===0?6:day-1)); return r; }
function formatDateFR(iso){ const d=parseDate(iso); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; }
function isToday(iso){ return iso===toIso(new Date()); }

// ── WhatsApp ──────────────────────────────────────────────────────
function buildWaLink(rdv, client){
  const soinIds = rdv.soins?.length ? rdv.soins : (rdv.soin ? [rdv.soin] : []);
  const soinsData = soinIds.map(id=>SOINS_CATALOGUE.find(s=>s.id===id)).filter(Boolean);
  const dateLabel = isToday(rdv.date) ? "Aujourd'hui" : formatDateFR(rdv.date);
  const msg =
`Bonjour ${client?.prenom||rdv.nomLibre||""}, nous vous rappelons que vous avez rendez-vous chez K's Make Up Addict.

Date et heure
${dateLabel} à ${rdv.heure}

Prestations réservées
${soinsData.map(s=>s.nom.toUpperCase()+" ("+s.duree+")").join("\n")}

Adresse
${ADRESSE}
📍 ${MAPS_LINK}`;
  const tel=(client?.telephone||rdv.tel||"").replace(/\D/g,"");
  const dest=tel?(tel.startsWith("225")?tel:"225"+tel):PHONE_STUDIO;
  return `https://wa.me/${dest}?text=${encodeURIComponent(msg)}`;
}

// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [clients, setClients]   = useState([]);
  const [rdvs, setRdvs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState("list");
  const [form, setForm]         = useState(EMPTY_FORM);
  const [editId, setEditId]     = useState(null);
  const [selected, setSelected] = useState(null);
  const [rdvForm, setRdvForm]   = useState(null);
  const [search, setSearch]     = useState("");
  const [toast, setToast]       = useState(null);
  const [weekStart, setWeekStart]   = useState(()=>startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(()=>toIso(new Date()));

  // ── Écoute Firestore en temps réel ──
  useEffect(()=>{
    const unsubClients = onSnapshot(collection(db,"clients"), snap=>{
      setClients(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const unsubRdvs = onSnapshot(collection(db,"rdvs"), snap=>{
      setRdvs(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>{ unsubClients(); unsubRdvs(); };
  },[]);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);};

  // ── Clients ──────────────────────────────────────────────────────
  const saveClient = async ()=>{
    if(!form.prenom.trim()||!form.nom.trim()){showToast("Prénom et nom requis","error");return;}
    try {
      if(editId){
        await setDoc(doc(db,"clients",editId), {...form,id:editId});
      } else {
        const id=`c_${Date.now()}`;
        await setDoc(doc(db,"clients",id), {...form,id,seances:0});
      }
      showToast(editId?"Fiche mise à jour ✓":"Fiche enregistrée ✓");
      setView("list"); setForm(EMPTY_FORM); setEditId(null);
    } catch(e){ showToast("Erreur réseau","error"); }
  };

  const deleteClient = async (id)=>{
    try {
      await deleteDoc(doc(db,"clients",id));
      // supprimer les rdv associés
      const assoc=rdvs.filter(r=>r.clientId===id);
      await Promise.all(assoc.map(r=>deleteDoc(doc(db,"rdvs",r.id))));
      showToast("Fiche supprimée"); setView("list");
    } catch(e){ showToast("Erreur réseau","error"); }
  };

  const addSeance = async (clientId)=>{
    try {
      await updateDoc(doc(db,"clients",clientId),{seances: increment(1)});
      showToast("Séance ajoutée ✓");
      // update local selected
      setSelected(prev=>prev?{...prev,seances:(prev.seances||0)+1}:prev);
    } catch(e){ showToast("Erreur réseau","error"); }
  };

  // ── RDVs ─────────────────────────────────────────────────────────
  const saveRdv = async (r)=>{
    try {
      if(r.id){
        await setDoc(doc(db,"rdvs",r.id), r);
      } else {
        const id=`r_${Date.now()}`;
        await setDoc(doc(db,"rdvs",id), {...r,id});
      }
      showToast("RDV enregistré ✓");
      if(selected && r.clientId===selected.id) setView("detail");
      else setView("agenda");
      setRdvForm(null);
    } catch(e){ showToast("Erreur réseau","error"); }
  };

  const deleteRdv = async (id)=>{
    try { await deleteDoc(doc(db,"rdvs",id)); showToast("RDV supprimé"); }
    catch(e){ showToast("Erreur réseau","error"); }
  };

  const toggle=(field,val)=>setForm(f=>({...f,[field]:f[field].includes(val)?f[field].filter(x=>x!==val):[...f[field],val]}));
  const initials=c=>`${(c.prenom||"?")[0]}${(c.nom||"?")[0]}`.toUpperCase();
  const filtered=clients.filter(c=>`${c.prenom} ${c.nom}`.toLowerCase().includes(search.toLowerCase())||(c.telephone||"").includes(search));
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));

  if(loading) return (
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond'",fontSize:28,color:"#8b5e52"}}>K's Beauty Studio</div>
        <div style={{color:"#c9a79e",marginTop:12,fontSize:14}}>Chargement...</div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        input,textarea,select{font-family:'DM Sans',sans-serif;}
        input:focus,textarea:focus,select:focus{outline:none;}
        ::-webkit-scrollbar{display:none;}
        button{font-family:'DM Sans',sans-serif;cursor:pointer;}
        a{text-decoration:none;}
      `}</style>

      {toast&&<div style={{...S.toast,background:toast.type==="error"?"#9b2335":"#2d6a4f"}}>{toast.msg}</div>}

      {(view==="list"||view==="agenda")&&(
        <div style={S.bottomNav}>
          <button style={{...S.navBtn,color:view==="list"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("list")}>
            <span style={S.navIcon}>👤</span><span style={S.navLabel}>Clients</span>
          </button>
          <button style={{...S.navBtn,color:view==="agenda"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("agenda")}>
            <span style={S.navIcon}>📅</span><span style={S.navLabel}>Agenda</span>
          </button>
        </div>
      )}

      {/* ══ LIST ══ */}
      {view==="list"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Clients</h1></div>
            <button style={S.btnRound} onClick={()=>{setEditId(null);setForm({...EMPTY_FORM,dateVisite:toIso(new Date())});setView("form");}}>＋</button>
          </div>
          <div style={S.searchWrap}>
            <span style={{fontSize:14,marginRight:8,opacity:0.4}}>🔍</span>
            <input style={S.searchInput} placeholder="Nom, prénom ou téléphone..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button style={S.clearBtn} onClick={()=>setSearch("")}>✕</button>}
          </div>
          {filtered.length===0?(
            <div style={S.empty}>
              {clients.length===0?<>
                <div style={{fontSize:36,marginBottom:10}}>✦</div>
                <div style={{fontFamily:"'Cormorant Garamond'",fontSize:20,color:"#b5938a"}}>Aucun client enregistré</div>
                <div style={{fontSize:13,color:"#c9a79e",marginTop:6}}>Appuyez sur + pour commencer</div>
              </>:<div style={{color:"#c9a79e"}}>Aucun résultat</div>}
            </div>
          ):(
            <div style={S.list}>
              {[...filtered].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=>(
                <button key={c.id} style={S.card} onClick={()=>{setSelected(c);setView("detail");}}>
                  <div style={S.avatar}>{initials(c)}</div>
                  <div style={S.cardInfo}>
                    <div style={S.cardName}>{c.prenom} {c.nom}</div>
                    <div style={S.cardSub}>
                      {(c.seances||0)>0&&<span style={S.badgeGreen}>🌿 {c.seances} séance{c.seances>1?"s":""}</span>}
                      {c.telephone&&<span style={{color:"#b5938a",fontSize:12}}>{c.telephone}</span>}
                    </div>
                  </div>
                  <div style={S.cardDate}>{c.dateVisite||""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ DETAIL ══ */}
      {view==="detail"&&selected&&(()=>{
        const clientRdvs=rdvs.filter(r=>r.clientId===selected.id).sort((a,b)=>b.date.localeCompare(a.date));
        // sync selected depuis Firestore
        const freshClient=clients.find(c=>c.id===selected.id)||selected;
        return(
          <div style={S.screen}>
            <div style={S.header}>
              <button style={S.backBtn} onClick={()=>setView("list")}>← Retour</button>
              <div style={{display:"flex",gap:8}}>
                <button style={S.btnSmall} onClick={()=>{setEditId(freshClient.id);setForm({...EMPTY_FORM,...freshClient});setView("form");}}>Modifier</button>
                <button style={{...S.btnSmall,background:"#fdecea",color:"#9b2335"}} onClick={()=>{if(window.confirm("Supprimer cette fiche ?"))deleteClient(freshClient.id);}}>Supprimer</button>
              </div>
            </div>
            <div style={S.detailHero}>
              <div style={S.avatarLg}>{initials(freshClient)}</div>
              <h2 style={S.detailName}>{freshClient.prenom} {freshClient.nom}</h2>
              {freshClient.typesPeau?.length>0&&<div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6,marginTop:6}}>{freshClient.typesPeau.map(t=><span key={t} style={S.badge}>{t}</span>)}</div>}
            </div>
            <div style={S.seanceBox}>
              <div style={S.seanceCount}>
                <span style={S.seanceNum}>{freshClient.seances||0}</span>
                <span style={S.seanceLabel}>séance{(freshClient.seances||0)!==1?"s":""} réalisée{(freshClient.seances||0)!==1?"s":""}</span>
              </div>
              <button style={S.seanceBtn} onClick={()=>addSeance(freshClient.id)}>＋ Ajouter une séance</button>
            </div>
            <div style={S.detailBody}>
              {[["📞 Téléphone",freshClient.telephone],["✉️ Email",freshClient.email],["🎂 Date de naissance",freshClient.dateNaissance],["📅 Dernière visite",freshClient.dateVisite],["🌿 Allergies",freshClient.allergies],["💊 Traitements",freshClient.traitementsEnCours],["🛍 Produits utilisés",freshClient.produitsUtilises],["📝 Notes",freshClient.notes]].map(([l,v])=>v?<div key={l} style={S.detailRow}><div style={S.detailLabel}>{l}</div><div style={S.detailVal}>{v}</div></div>:null)}
              {freshClient.soins?.length>0&&<div style={S.detailRow}><div style={S.detailLabel}>💆 Soins habituels</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>{freshClient.soins.map(s=><span key={s} style={S.badgeGreen}>{SOINS_CATALOGUE.find(x=>x.id===s)?.nom||s}</span>)}</div></div>}
              {freshClient.problematiquesPeau?.length>0&&<div style={S.detailRow}><div style={S.detailLabel}>⚠️ Problématiques</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>{freshClient.problematiquesPeau.map(p=><span key={p} style={S.badgeDark}>{p}</span>)}</div></div>}
              {clientRdvs.length>0&&(
                <div style={S.detailRow}>
                  <div style={S.detailLabel}>📋 Historique RDV</div>
                  {clientRdvs.map(r=>{
                    const soinIdsH=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                    const soinsH=soinIdsH.map(id=>SOINS_CATALOGUE.find(s=>s.id===id)).filter(Boolean);
                    return(
                      <div key={r.id} style={S.rdvHistItem}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <div>
                            <span style={{fontWeight:500,color:"#3a2a27"}}>{r.date}</span>
                            <span style={{color:"#b5938a",margin:"0 6px"}}>à</span>
                            <span style={{fontWeight:500,color:"#3a2a27"}}>{r.heure}</span>
                            {soinsH.map(s=><div key={s.id} style={{fontSize:12,color:"#8b5e52",marginTop:2}}>{s.nom}</div>)}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <a href={buildWaLink(r,freshClient)} target="_blank" rel="noreferrer" style={{...S.waBtn,width:30,height:30,fontSize:14}}>📲</a>
                            <button style={S.editRdvBtn} onClick={()=>{setRdvForm({...r});setView("rdvForm");}}>✏️</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button style={S.rdvCTA} onClick={()=>{setRdvForm({clientId:freshClient.id,date:toIso(new Date()),heure:"09:00",soins:[],note:""});setView("rdvForm");}}>
                📅 Prendre un RDV pour {freshClient.prenom}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ══ FORM CLIENT ══ */}
      {view==="form"&&(
        <div style={S.screen}>
          <div style={S.header}>
            <button style={S.backBtn} onClick={()=>{setView("list");setEditId(null);setForm(EMPTY_FORM);}}>← Annuler</button>
            <div style={S.brandTag}>{editId?"Modifier la fiche":"Nouvelle fiche"}</div>
          </div>
          <div style={S.formBody}>
            <Sect title="Identité">
              <TwoCol><Fld label="Prénom *" value={form.prenom} onChange={v=>setForm(f=>({...f,prenom:v}))}/><Fld label="Nom *" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))}/></TwoCol>
              <Fld label="Téléphone" value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} type="tel"/>
              <Fld label="Email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email"/>
              <TwoCol>
                <Fld label="Date de naissance" value={form.dateNaissance} onChange={v=>setForm(f=>({...f,dateNaissance:v}))} type="date"/>
                <Fld label="Date de visite" value={form.dateVisite} onChange={v=>setForm(f=>({...f,dateVisite:v}))} type="date"/>
              </TwoCol>
            </Sect>
            <Sect title="Type de peau"><div style={{fontSize:11,color:"#b5938a",marginBottom:8}}>Sélection multiple possible</div><Chips items={TYPES_PEAU} selected={form.typesPeau} onToggle={v=>toggle("typesPeau",v)}/></Sect>
            <Sect title="Problématiques"><Chips items={PROBLEMATIQUES} selected={form.problematiquesPeau} onToggle={v=>toggle("problematiquesPeau",v)}/></Sect>
            <Sect title="Soins K's Beauty Studio">
              <div style={{fontSize:11,color:"#b5938a",marginBottom:10}}>Sélection multiple possible</div>
              <SoinsSelector selected={form.soins} onToggle={v=>toggle("soins",v)}/>
            </Sect>
            <Sect title="Informations complémentaires">
              <Fld label="Allergies connues" value={form.allergies} onChange={v=>setForm(f=>({...f,allergies:v}))} multiline/>
              <Fld label="Traitements en cours" value={form.traitementsEnCours} onChange={v=>setForm(f=>({...f,traitementsEnCours:v}))} multiline/>
              <Fld label="Produits habituellement utilisés" value={form.produitsUtilises} onChange={v=>setForm(f=>({...f,produitsUtilises:v}))} multiline/>
              <Fld label="Notes & observations" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} multiline/>
            </Sect>
            <button style={S.saveBtn} onClick={saveClient}>{editId?"✓ Mettre à jour":"✓ Enregistrer la fiche"}</button>
            <div style={{height:50}}/>
          </div>
        </div>
      )}

      {/* ══ AGENDA ══ */}
      {view==="agenda"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Agenda</h1></div>
            <button style={S.btnRound} onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:selectedDay,heure:"09:00",soins:[],note:""});setView("rdvForm");}}>＋</button>
          </div>
          <div style={S.weekNav}>
            <button style={S.weekNavBtn} onClick={()=>{const nd=addDays(weekStart,-7);setWeekStart(nd);setSelectedDay(toIso(nd));}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:500,color:"#3a2a27"}}>{MOIS_COURT[weekStart.getMonth()]} {weekStart.getFullYear()}</div>
              <div style={{fontSize:11,color:"#b5938a"}}>{weekStart.getDate()} – {addDays(weekStart,6).getDate()} {MOIS_COURT[addDays(weekStart,6).getMonth()]}</div>
            </div>
            <button style={S.weekNavBtn} onClick={()=>{const nd=addDays(weekStart,7);setWeekStart(nd);setSelectedDay(toIso(nd));}}>›</button>
          </div>
          <div style={S.weekHeader}>
            {weekDays.map(d=>{
              const iso=toIso(d);
              const today=isToday(iso);
              const sel=iso===selectedDay;
              const count=rdvs.filter(r=>r.date===iso).length;
              return(
                <button key={iso} onClick={()=>setSelectedDay(iso)} style={{...S.dayCol,background:sel?"#8b5e52":today?"#fdf0ec":"transparent",border:"none"}}>
                  <div style={{fontSize:10,color:sel?"#fff":today?"#8b5e52":"#c9a79e",textTransform:"uppercase",fontWeight:500}}>{["lun.","mar.","mer.","jeu.","ven.","sam.","dim."][weekDays.indexOf(d)]}</div>
                  <div style={{...S.dayNum,background:sel?"rgba(255,255,255,0.25)":"transparent",color:sel?"#fff":today?"#8b5e52":"#3a2a27",fontWeight:sel?700:400}}>{d.getDate()}</div>
                  {count>0&&<div style={{...S.dayDot,background:sel?"#fff":"#8b5e52"}}/>}
                </button>
              );
            })}
          </div>
          <div style={{padding:"8px 16px 20px",overflowY:"auto"}}>
            <div style={S.dayLabel}>{isToday(selectedDay)?"Aujourd'hui — "+formatDateFR(selectedDay):formatDateFR(selectedDay)}</div>
            {(()=>{
              const rdvsDuJour=rdvs.filter(r=>r.date===selectedDay).sort((a,b)=>a.heure.localeCompare(b.heure));
              if(rdvsDuJour.length===0) return(
                <div style={{textAlign:"center",padding:"30px 0",color:"#c9a79e"}}>
                  <div style={{fontSize:28,marginBottom:8}}>📅</div>
                  <div style={{fontFamily:"'Cormorant Garamond'",fontSize:17,color:"#b5938a"}}>Aucun RDV ce jour</div>
                  <div style={{fontSize:12,marginTop:4}}>Appuyez sur + pour ajouter</div>
                </div>
              );
              return rdvsDuJour.map(r=>{
                const client=clients.find(c=>c.id===r.clientId);
                const nom=client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client";
                const soinIds2=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                const soinsRdv=soinIds2.map(id=>SOINS_CATALOGUE.find(s=>s.id===id)).filter(Boolean);
                const color=SOIN_COLORS[soinIds2[0]]||"#b5938a";
                return(
                  <div key={r.id} style={{...S.rdvCard,borderLeft:`3px solid ${color}`}}>
                    <div style={{...S.rdvHeure,color}}>{r.heure}</div>
                    <div style={{flex:1}}>
                      <div style={S.rdvNom}>{nom}</div>
                      {soinsRdv.map(s=><div key={s.id} style={{fontSize:12,color:"#8b5e52",marginTop:2}}>{s.nom} · {s.duree}</div>)}
                      {r.note&&<div style={{fontSize:11,color:"#c9a79e",marginTop:3}}>{r.note}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <a href={buildWaLink(r,client)} target="_blank" rel="noreferrer" style={S.waBtn}>📲</a>
                      <button style={S.editRdvBtn} onClick={()=>{setRdvForm({...r});setView("rdvForm");}}>✏️</button>
                      <button style={S.delRdvBtn} onClick={()=>deleteRdv(r.id)}>✕</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ══ FORM RDV ══ */}
      {view==="rdvForm"&&rdvForm!=null&&(
        <RdvFormView
          rdvForm={rdvForm}
          clients={clients}
          onSave={saveRdv}
          onBack={()=>{
            if(selected&&rdvForm.clientId===selected.id) setView("detail");
            else setView("agenda");
            setRdvForm(null);
          }}
        />
      )}
    </div>
  );
}

// ── RDV FORM ──────────────────────────────────────────────────────
function RdvFormView({rdvForm,clients,onSave,onBack}){
  const [f,setF]=useState({
    ...rdvForm,
    soins:rdvForm.soins?.length?rdvForm.soins:(rdvForm.soin?[rdvForm.soin]:[]),
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleSoin=(id)=>setF(p=>({...p,soins:p.soins.includes(id)?p.soins.filter(x=>x!==id):[...p.soins,id]}));
  const isEdit=!!f.id;
  const valid=f.soins?.length>0&&f.date&&f.heure&&(f.clientId||f.nomLibre?.trim());
  return(
    <div style={S.screen}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={onBack}>← Annuler</button>
        <div style={S.brandTag}>{isEdit?"Modifier le RDV":"Nouveau RDV"}</div>
      </div>
      <div style={S.formBody}>
        <Sect title="Client">
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:5}}>Client existant</div>
            <select value={f.clientId||""} onChange={e=>set("clientId",e.target.value)}
              style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:15,color:"#3a2a27"}}>
              <option value="">— Sélectionner —</option>
              {[...clients].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
          {!f.clientId&&<>
            <Fld label="Ou nom (nouveau client)" value={f.nomLibre||""} onChange={v=>set("nomLibre",v)}/>
            <Fld label="Téléphone WhatsApp" value={f.tel||""} onChange={v=>set("tel",v)} type="tel"/>
          </>}
        </Sect>
        <Sect title="Date & heure">
          <TwoCol>
            <Fld label="Date" value={f.date} onChange={v=>set("date",v)} type="date"/>
            <Fld label="Heure" value={f.heure} onChange={v=>set("heure",v)} type="time"/>
          </TwoCol>
        </Sect>
        <Sect title="Soins & prestations">
          <div style={{fontSize:11,color:"#b5938a",marginBottom:10}}>Sélection multiple — soin + add-on possible</div>
          <SoinsSelector selected={f.soins||[]} onToggle={toggleSoin}/>
        </Sect>
        <Sect title="Note (optionnel)"><Fld label="" value={f.note||""} onChange={v=>set("note",v)} multiline/></Sect>
        <button style={{...S.saveBtn,opacity:valid?1:0.5}} disabled={!valid} onClick={()=>onSave(f)}>
          {isEdit?"✓ Modifier le RDV":"✓ Confirmer le RDV"}
        </button>
        <div style={{height:50}}/>
      </div>
    </div>
  );
}

// ── Composants ────────────────────────────────────────────────────
function SoinsSelector({selected,onToggle}){
  return(
    <div>
      {["Soins Visage","Option Add-On","Service Boutique"].map(cat=>{
        const items=SOINS_CATALOGUE.filter(s=>s.categorie===cat);
        return(
          <div key={cat} style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#c9a79e",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{cat}</div>
            {items.map(s=>{
              const active=selected.includes(s.id);
              const color=SOIN_COLORS[s.id]||"#8b5e52";
              return(
                <button key={s.id} onClick={()=>onToggle(s.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",marginBottom:7,borderRadius:12,border:active?`1.5px solid ${color}`:"1px solid #e8d5d0",background:active?`${color}18`:"#fff",textAlign:"left"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:active?600:400,color:active?color:"#3a2a27"}}>{s.nom}</div>
                    <div style={{fontSize:11,color:"#b5938a",marginTop:1}}>{s.duree}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,fontWeight:600,color:active?color:"#8b5e52"}}>{s.prix}</span>
                    {active&&<span style={{color,fontSize:16}}>✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
function Sect({title,children}){return <div style={{marginBottom:24}}><div style={{fontFamily:"'Cormorant Garamond'",fontSize:17,color:"#8b5e52",marginBottom:12,borderBottom:"1px solid #f0ddd8",paddingBottom:6}}>{title}</div>{children}</div>;}
function TwoCol({children}){return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{children}</div>;}
function Fld({label,value,onChange,type="text",multiline}){
  const b={width:"100%",background:"#fdf8f6",border:"1px solid #e8d5d0",borderRadius:10,padding:"10px 12px",fontSize:15,color:"#3a2a27",fontFamily:"'DM Sans',sans-serif"};
  return <div style={{marginBottom:12}}>{label&&<div style={{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:5}}>{label}</div>}{multiline?<textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} style={{...b,resize:"none",lineHeight:1.5}}/>:<input value={value} onChange={e=>onChange(e.target.value)} type={type} style={b}/>}</div>;
}
function Chips({items,selected,onToggle}){
  return <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:4}}>{items.map(item=>{const a=selected.includes(item);return <button key={item} onClick={()=>onToggle(item)} style={{padding:"6px 13px",borderRadius:20,fontSize:13,border:a?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:a?"#8b5e52":"#fff",color:a?"#fff":"#8b5e52",fontWeight:a?500:400}}>{item}</button>;})}</div>;
}

const S={
  root:{fontFamily:"'DM Sans',sans-serif",background:"#fdf6f3",minHeight:"100vh",maxWidth:480,margin:"0 auto"},
  screen:{display:"flex",flexDirection:"column",minHeight:"100vh"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px 12px",background:"#fdf6f3",position:"sticky",top:0,zIndex:10,borderBottom:"1px solid #f0ddd8"},
  brandTag:{fontSize:10,letterSpacing:2,color:"#b5938a",textTransform:"uppercase",fontWeight:500},
  title:{fontFamily:"'Cormorant Garamond'",fontSize:26,color:"#3a2a27",margin:"2px 0 0",fontWeight:600},
  btnRound:{width:40,height:40,borderRadius:20,background:"#8b5e52",color:"#fff",border:"none",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"},
  btnSmall:{padding:"6px 14px",borderRadius:20,border:"none",background:"#f0ddd8",color:"#8b5e52",fontSize:13,fontWeight:500},
  backBtn:{background:"none",border:"none",color:"#8b5e52",fontSize:15,padding:0},
  searchWrap:{display:"flex",alignItems:"center",margin:"10px 16px 6px",background:"#fff",borderRadius:12,border:"1px solid #e8d5d0",padding:"0 12px"},
  searchInput:{flex:1,border:"none",background:"none",padding:"11px 0",fontSize:15,color:"#3a2a27"},
  clearBtn:{background:"none",border:"none",color:"#b5938a",fontSize:14,padding:"0 4px"},
  list:{padding:"8px 16px 20px",display:"flex",flexDirection:"column",gap:10},
  card:{display:"flex",alignItems:"center",background:"#fff",borderRadius:14,padding:"13px",border:"1px solid #f0ddd8",textAlign:"left",width:"100%",gap:12},
  avatar:{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontFamily:"'Cormorant Garamond'",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  avatarLg:{width:68,height:68,borderRadius:34,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontFamily:"'Cormorant Garamond'",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"},
  cardInfo:{flex:1,minWidth:0},
  cardName:{fontSize:16,fontWeight:500,color:"#3a2a27",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  cardSub:{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"},
  cardDate:{fontSize:11,color:"#c9a79e",flexShrink:0},
  badge:{background:"#fdecea",color:"#8b5e52",fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:500},
  badgeDark:{background:"#f0ddd8",color:"#6b3f35",fontSize:12,padding:"3px 10px",borderRadius:10},
  badgeGreen:{background:"#d8f0e7",color:"#2d6a4f",fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:500},
  empty:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,textAlign:"center",minHeight:200},
  detailHero:{padding:"22px 20px 16px",textAlign:"center",borderBottom:"1px solid #f0ddd8"},
  detailName:{fontFamily:"'Cormorant Garamond'",fontSize:26,color:"#3a2a27",margin:"0 0 6px",fontWeight:600},
  detailBody:{padding:"8px 18px 40px"},
  detailRow:{marginBottom:14,paddingBottom:12,borderBottom:"1px solid #f5ede9"},
  detailLabel:{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:4},
  detailVal:{fontSize:15,color:"#3a2a27",lineHeight:1.5},
  seanceBox:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:"#fff8f5",borderBottom:"1px solid #f0ddd8"},
  seanceCount:{display:"flex",alignItems:"baseline",gap:6},
  seanceNum:{fontFamily:"'Cormorant Garamond'",fontSize:36,color:"#8b5e52",fontWeight:600,lineHeight:1},
  seanceLabel:{fontSize:13,color:"#b5938a"},
  seanceBtn:{padding:"8px 16px",borderRadius:20,border:"1.5px solid #8b5e52",background:"#fff",color:"#8b5e52",fontSize:13,fontWeight:500},
  rdvHistItem:{padding:"8px 0",borderBottom:"1px solid #fdecea"},
  rdvCTA:{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#2d6a4f,#52b788)",color:"#fff",border:"none",fontSize:15,fontWeight:500,marginTop:12},
  weekNav:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 18px 6px"},
  weekNavBtn:{background:"none",border:"1px solid #e8d5d0",borderRadius:20,width:32,height:32,fontSize:18,color:"#8b5e52",display:"flex",alignItems:"center",justifyContent:"center"},
  weekHeader:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,padding:"6px 10px 0",borderBottom:"1px solid #f0ddd8"},
  dayCol:{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 2px 8px",borderRadius:10},
  dayNum:{width:26,height:26,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:500,marginTop:3},
  dayDot:{width:5,height:5,borderRadius:3,marginTop:3},
  dayLabel:{fontSize:12,fontWeight:600,color:"#8b5e52",letterSpacing:0.5,marginBottom:8,marginTop:4},
  rdvCard:{display:"flex",alignItems:"flex-start",background:"#fff",borderRadius:12,padding:"12px",border:"1px solid #f0ddd8",gap:10,marginBottom:8},
  rdvHeure:{fontFamily:"'Cormorant Garamond'",fontSize:20,fontWeight:600,flexShrink:0,minWidth:48,lineHeight:1.2},
  rdvNom:{fontSize:15,fontWeight:500,color:"#3a2a27"},
  waBtn:{display:"flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:16,background:"#25D366",fontSize:14},
  editRdvBtn:{width:32,height:32,borderRadius:16,border:"none",background:"#f0ddd8",color:"#8b5e52",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"},
  delRdvBtn:{width:28,height:28,borderRadius:14,border:"none",background:"#fdecea",color:"#9b2335",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"},
  formBody:{padding:"16px 18px",overflowY:"auto",flex:1},
  saveBtn:{width:"100%",padding:"15px",borderRadius:14,background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",border:"none",fontSize:16,fontWeight:500,marginTop:8},
  toast:{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"10px 22px",borderRadius:20,fontSize:14,zIndex:100,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.18)"},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #f0ddd8",display:"flex",zIndex:20},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0 14px",background:"none",border:"none"},
  navIcon:{fontSize:20},
  navLabel:{fontSize:11,marginTop:2,fontWeight:500},
};
