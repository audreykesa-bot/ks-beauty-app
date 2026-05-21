import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, doc,
  setDoc, deleteDoc, updateDoc, increment
} from "firebase/firestore";
import { db } from "./firebase";


// localStorage used only for PIN storage (lightweight, no Firebase needed)
const PIN_SK="ks_beauty_pin";
const ldPin=()=>{try{return JSON.parse(localStorage.getItem(PIN_SK)||"{}");}catch{return{};}};
const svPin=(d)=>{try{localStorage.setItem(PIN_SK,JSON.stringify(d));}catch{}};

const CAT_DEFAULT=[
  {id:"eclat_express",nom:"Éclat Express",duree:"30 min",prix:"20 000 F",categorie:"Soins Visage",couleur:"#4fc3c3"},
  {id:"anti_taches",nom:"Anti-Taches Signature",duree:"1h00",prix:"35 000 F",categorie:"Soins Visage",couleur:"#f0a500"},
  {id:"vitamin_c_glow",nom:"Vitamin C Glow",duree:"1h15",prix:"40 000 F",categorie:"Soins Visage",couleur:"#7e57c2"},
  {id:"night_repair_luxe",nom:"Night Repair Luxe",duree:"1h30",prix:"50 000 F",categorie:"Soins Visage",couleur:"#e57373"},
  {id:"dermaplaning",nom:"Dermaplaning (add-on)",duree:"+15 min",prix:"+5 000 F",categorie:"Option Add-On",couleur:"#81c784"},
  {id:"diagnostic_peau",nom:"Diagnostic de Peau",duree:"20 min",prix:"10 000 F",categorie:"Service Boutique",couleur:"#64b5f6"},
];
const CATEGORIES=["Soins Visage","Option Add-On","Service Boutique","Pédicure","Manucure"];
const PALETTE=["#4fc3c3","#f0a500","#7e57c2","#e57373","#81c784","#64b5f6","#f06292","#ffb74d","#a1887f","#90a4ae","#8b5e52","#2d6a4f"];
const TYPES_PEAU=["Normale","Sèche","Grasse","Mixte","Sensible","Déshydratée","Mature","À tendance acnéique"];
const PROBLEMATIQUES=["Acné","Points noirs","Taches","Rides & ridules","Sécheresse","Déshydratation","Brillance","Sensibilité","Cernes","Pores dilatés","Teint terne","Rougeurs","Hyperpigmentation","Relâchement"];
const EMPTY_FORM={prenom:"",nom:"",telephone:"",email:"",dateNaissance:"",typesPeau:[],allergies:"",traitementsEnCours:"",problematiquesPeau:[],soins:[],produitsUtilises:"",notes:"",dateVisite:toIso(new Date()),seances:0,photos:[]};
const EMPTY_SOIN={nom:"",duree:"",prix:"",categorie:"Soins Visage",couleur:"#8b5e52"};
const ADRESSE="K's Make Up Addict, 7ème Tranche, en face des 2 stations Shell, Abidjan";
const MAPS_LINK="https://maps.app.goo.gl/hNbSzDaM3YeJmfo19";
const PHONE_STUDIO="2250584913471";
const PIN_CODE="1234"; // code PIN par défaut — changeable dans les paramètres

function getBadge(s){
  if(s>=20)return{label:"💎 Diamant",bg:"#e8d5f5",color:"#6a1b9a"};
  if(s>=10)return{label:"⭐ VIP",bg:"#fff3cd",color:"#856404"};
  if(s>=5)return{label:"🌸 Fidèle",bg:"#fdecea",color:"#8b5e52"};
  return null;
}

const JOURS=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
const MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_COURT=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function parseDate(s){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);}
function toIso(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function startOfWeek(d){const r=new Date(d);const day=r.getDay();r.setDate(r.getDate()-(day===0?6:day-1));return r;}
function formatDateFR(iso){const d=parseDate(iso);return`${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;}
function isToday(iso){return iso===toIso(new Date());}
function isTomorrow(iso){return iso===toIso(addDays(new Date(),1));}
function isBirthdayThisWeek(dn){
  if(!dn)return false;
  const p=dn.split("-");if(p.length<3)return false;
  const now=new Date();const ws=startOfWeek(now);
  for(let i=0;i<7;i++){const d=addDays(ws,i);if(d.getDate()===parseInt(p[2])&&d.getMonth()===parseInt(p[1])-1)return true;}
  return false;
}

function buildWaLink(rdv,client,catalogue){
  const ids=rdv.soins?.length?rdv.soins:(rdv.soin?[rdv.soin]:[]);
  const soinsData=ids.map(id=>catalogue.find(s=>s.id===id)).filter(Boolean);
  const dateLabel=isToday(rdv.date)?"Aujourd'hui":isTomorrow(rdv.date)?"Demain":formatDateFR(rdv.date);
  const msg=`Bonjour ${client?.prenom||rdv.nomLibre||""}, nous vous rappelons que vous avez rendez-vous chez K's Make Up Addict.\n\nDate et heure\n${dateLabel} à ${rdv.heure}\n\nPrestations réservées\n${soinsData.map(s=>s.nom.toUpperCase()+" ("+s.duree+")").join("\n")}\n\nAdresse\n${ADRESSE}\n📍 ${MAPS_LINK}`;
  const tel=(client?.telephone||rdv.tel||"").replace(/\D/g,"");
  const dest=tel?(tel.startsWith("225")?tel:"225"+tel):PHONE_STUDIO;
  return`https://wa.me/${dest}?text=${encodeURIComponent(msg)}`;
}

function buildFideliteMsg(client){
  const msg=`Bonjour ${client.prenom} ! 🌸\n\nFélicitations, vous venez d'atteindre ${client.seances} séances chez K's Beauty Studio !\n\nEn signe de fidélité, votre prochaine séance bénéficie d'une remise spéciale. 💆\n\nMerci pour votre confiance et à très bientôt !\n\n— K's Make Up Addict\n📍 ${MAPS_LINK}`;
  const tel=(client.telephone||"").replace(/\D/g,"");
  const dest=tel?(tel.startsWith("225")?tel:"225"+tel):PHONE_STUDIO;
  return`https://wa.me/${dest}?text=${encodeURIComponent(msg)}`;
}

// ══════════════════════════════════════════════════════════════════
export default function App(){
  const stored=ldPin();
  const [unlocked,setUnlocked]=useState(false);
  const [savedPin,setSavedPin]=useState(stored.pin||PIN_CODE);

  if(!unlocked) return <PinScreen savedPin={savedPin} onUnlock={()=>setUnlocked(true)}/>;

  return <MainApp savedPin={savedPin} setSavedPin={setSavedPin}/>;
}

function PinScreen({savedPin,onUnlock}){
  const [pin,setPin]=useState("");
  const [error,setError]=useState(false);
  const digits=["1","2","3","4","5","6","7","8","9","","0","⌫"];

  useEffect(()=>{
    if(pin.length===4){
      if(pin===savedPin){setError(false);onUnlock();}
      else{setError(true);setTimeout(()=>{setPin("");setError(false);},600);}
    }
  },[pin]);

  return(
    <div style={{minHeight:"100vh",background:"#fdf6f3",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",maxWidth:480,margin:"0 auto"}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,color:"#8b5e52",marginBottom:4}}>K's Beauty Studio</div>
      <div style={{fontSize:13,color:"#b5938a",marginBottom:40,letterSpacing:1}}>Espace équipe</div>
      <div style={{display:"flex",gap:14,marginBottom:32}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:16,height:16,borderRadius:8,background:error?"#9b2335":i<pin.length?"#8b5e52":"#e8d5d0",transition:"background 0.2s"}}/>
        ))}
      </div>
      {error&&<div style={{color:"#9b2335",fontSize:13,marginBottom:16}}>Code incorrect, réessaie</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,width:260}}>
        {digits.map((d,i)=>(
          <button key={i} onClick={()=>{
            if(d==="")return;
            if(d==="⌫"){setPin(p=>p.slice(0,-1));return;}
            if(pin.length<4)setPin(p=>p+d);
          }} style={{height:64,borderRadius:16,border:"1px solid #f0ddd8",background:d===""?"transparent":"#fff",fontSize:22,fontWeight:400,color:"#3a2a27",cursor:d===""?"default":"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            {d}
          </button>
        ))}
      </div>
      <div style={{fontSize:11,color:"#c9a79e",marginTop:30}}>Code par défaut : 1234</div>
    </div>
  );
}

function MainApp({savedPin,setSavedPin}){
  const [clients,setClients]=useState([]);
  const [rdvs,setRdvs]=useState([]);
  const [catalogue,setCatalogue]=useState(CAT_DEFAULT);
  const [attente,setAttente]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const [view,setView]=useState("list");
  const [form,setForm]=useState(EMPTY_FORM);
  const [editId,setEditId]=useState(null);
  const [selected,setSelected]=useState(null);
  const [rdvForm,setRdvForm]=useState(null);
  const [soinForm,setSoinForm]=useState(null);
  const [search,setSearch]=useState("");
  const [filterSoin,setFilterSoin]=useState("");
  const [toast,setToast]=useState(null);
  const [weekStart,setWeekStart]=useState(()=>startOfWeek(new Date()));
  const [selDay,setSelDay]=useState(()=>toIso(new Date()));
  const [agendaMode,setAgendaMode]=useState("semaine"); // semaine | jour
  const [noteRdvId,setNoteRdvId]=useState(null);
  const [noteText,setNoteText]=useState("");

  // Firebase realtime listeners
  useEffect(()=>{
    const u1=onSnapshot(collection(db,"clients"),snap=>{setClients(snap.docs.map(d=>({id:d.id,...d.data()})));setLoadingData(false);});
    const u2=onSnapshot(collection(db,"rdvs"),snap=>{setRdvs(snap.docs.map(d=>({id:d.id,...d.data()})));});
    const u3=onSnapshot(collection(db,"catalogue"),snap=>{const items=snap.docs.map(d=>({id:d.id,...d.data()}));if(items.length>0)setCatalogue(items);});
    const u4=onSnapshot(collection(db,"attente"),snap=>{setAttente(snap.docs.map(d=>({id:d.id,...d.data()})));});
    return()=>{u1();u2();u3();u4();};
  },[]);

  const persist=()=>{}; // no-op, Firebase handles persistence
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);};

  if(loadingData) return(
    <div style={{minHeight:"100vh",background:"#fdf6f3",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:"#8b5e52"}}>K's Beauty Studio</div>
        <div style={{color:"#c9a79e",marginTop:12,fontSize:14}}>Chargement...</div>
      </div>
    </div>
  );
  const soinColor=(id)=>{const s=catalogue.find(x=>x.id===id);return s?.couleur||"#8b5e52";};

  // ── Clients ──
  const saveClient=async()=>{
    if(!form.prenom.trim()||!form.nom.trim()){showToast("Prénom et nom requis","error");return;}
    try{
      if(editId){await setDoc(doc(db,"clients",editId),{...form,id:editId});}
      else{const id=`c_${Date.now()}`;await setDoc(doc(db,"clients",id),{...form,id,seances:0,photos:[]});}
      showToast(editId?"Fiche mise à jour ✓":"Fiche enregistrée ✓");
      setView("list");setForm(EMPTY_FORM);setEditId(null);
    }catch(e){showToast("Erreur réseau","error");}
  };
  const deleteClient=async(id)=>{
    try{
      await deleteDoc(doc(db,"clients",id));
      await Promise.all(rdvs.filter(r=>r.clientId===id).map(r=>deleteDoc(doc(db,"rdvs",r.id))));
      showToast("Fiche supprimée");setView("list");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const addSeance=async(clientId)=>{
    try{
      await updateDoc(doc(db,"clients",clientId),{seances:increment(1)});
      showToast("Séance ajoutée ✓");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const addPhoto=async(clientId,dataUrl,label)=>{
    try{
      const client=clients.find(c=>c.id===clientId);
      const photo={id:`p_${Date.now()}`,url:dataUrl,label,date:toIso(new Date())};
      const photos=[...(client?.photos||[]),photo];
      await updateDoc(doc(db,"clients",clientId),{photos});
      showToast("Photo ajoutée ✓");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const deletePhoto=async(clientId,photoId)=>{
    try{
      const client=clients.find(c=>c.id===clientId);
      const photos=(client?.photos||[]).filter(p=>p.id!==photoId);
      await updateDoc(doc(db,"clients",clientId),{photos});
    }catch(e){showToast("Erreur réseau","error");}
  };

  // ── RDVs ──
  const saveRdv=async(r)=>{
    try{
      let rdvFinal={...r};
      if(!r.clientId&&r.nomLibre?.trim()){
        const parts=r.nomLibre.trim().split(" ");
        const prenom=parts[0]||"";const nom=parts.slice(1).join(" ")||prenom;
        const newId=`c_${Date.now()}`;
        await setDoc(doc(db,"clients",newId),{...EMPTY_FORM,id:newId,prenom,nom,telephone:r.tel||"",dateVisite:r.date,seances:0,photos:[]});
        rdvFinal={...rdvFinal,clientId:newId,nomLibre:"",tel:""};
        showToast(`Fiche créée pour ${r.nomLibre} ✓`);
      }
      if(rdvFinal.id){await setDoc(doc(db,"rdvs",rdvFinal.id),rdvFinal);}
      else{const id=`r_${Date.now()}`;await setDoc(doc(db,"rdvs",id),{...rdvFinal,id});}
      if(!r.nomLibre?.trim())showToast("RDV enregistré ✓");
      if(selected&&rdvFinal.clientId===selected.id)setView("detail");else setView("agenda");
      setRdvForm(null);
    }catch(e){showToast("Erreur réseau","error");}
  };
  const deleteRdv=async(id)=>{
    try{
      const rdv=rdvs.find(r=>r.id===id);
      if(rdv?.effectue&&rdv?.clientId){
        await updateDoc(doc(db,"clients",rdv.clientId),{seances:increment(-1)});
      }
      await deleteDoc(doc(db,"rdvs",id));
      showToast("RDV supprimé");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const validerRdv=async(rdv)=>{
    try{
      await updateDoc(doc(db,"rdvs",rdv.id),{effectue:true});
      if(rdv.clientId)await updateDoc(doc(db,"clients",rdv.clientId),{seances:increment(1)});
      showToast("Séance validée ✓");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const saveNoteSeance=async(rdvId,note)=>{
    try{
      await updateDoc(doc(db,"rdvs",rdvId),{noteSeance:note});
      setNoteRdvId(null);setNoteText("");
      showToast("Note enregistrée ✓");
    }catch(e){showToast("Erreur réseau","error");}
  };

  // ── Catalogue ──
  const saveSoin=async(s)=>{
    try{
      const id=s.id||`soin_${Date.now()}`;
      await setDoc(doc(db,"catalogue",id),{...s,id});
      showToast(s.id?"Prestation modifiée ✓":"Prestation ajoutée ✓");
      setView("catalogue");setSoinForm(null);
    }catch(e){showToast("Erreur réseau","error");}
  };
  const deleteSoin=async(id)=>{
    try{await deleteDoc(doc(db,"catalogue",id));showToast("Prestation supprimée");}
    catch(e){showToast("Erreur réseau","error");}
  };

  // ── Liste d'attente ──
  const addAttente=async(a)=>{
    try{
      const id=`a_${Date.now()}`;
      await setDoc(doc(db,"attente",id),{...a,id,date:toIso(new Date())});
      showToast("Ajoutée à la liste d'attente ✓");
    }catch(e){showToast("Erreur réseau","error");}
  };
  const removeAttente=async(id)=>{
    try{await deleteDoc(doc(db,"attente",id));showToast("Retirée de la liste d'attente");}
    catch(e){showToast("Erreur réseau","error");}
  };

  // ── Stats ──
  const now=new Date();
  const moisIso=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const rdvsMois=rdvs.filter(r=>r.date?.startsWith(moisIso)&&r.effectue);
  const revenus=rdvsMois.reduce((acc,r)=>{
    const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
    ids.forEach(id=>{const s=catalogue.find(x=>x.id===id);if(s?.prix){const n=parseInt(s.prix.replace(/\D/g,""));if(!isNaN(n))acc+=n;}});
    return acc;
  },0);
  const soinCount={};
  rdvs.filter(r=>r.effectue).forEach(r=>{
    const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
    ids.forEach(id=>{soinCount[id]=(soinCount[id]||0)+1;});
  });
  const topSoin=Object.entries(soinCount).sort((a,b)=>b[1]-a[1])[0];
  const topSoinNom=topSoin?catalogue.find(s=>s.id===topSoin[0])?.nom:"—";
  const anniversaires=clients.filter(c=>isBirthdayThisWeek(c.dateNaissance));

  // Rappels J-1
  const rdvsDemain=rdvs.filter(r=>isTomorrow(r.date)&&!r.rappelEnvoye);

  const toggle=(field,val)=>setForm(f=>({...f,[field]:f[field].includes(val)?f[field].filter(x=>x!==val):[...f[field],val]}));
  const initials=c=>`${(c.prenom||"?")[0]}${(c.nom||"?")[0]}`.toUpperCase();
  let filtered=clients.filter(c=>`${c.prenom} ${c.nom}`.toLowerCase().includes(search.toLowerCase())||(c.telephone||"").includes(search));
  if(filterSoin)filtered=filtered.filter(c=>c.soins?.includes(filterSoin));
  filtered=[...filtered].sort((a,b)=>a.nom.localeCompare(b.nom));
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));

  // Vue jour — créneaux 8h-20h
  const CRENEAUX=Array.from({length:25},(_,i)=>{const h=8+Math.floor(i/2);const m=i%2===0?"00":"30";return`${String(h).padStart(2,"0")}:${m}`;}).filter(c=>parseInt(c.split(":")[0])<20);

  return(
    <div style={S.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input,textarea,select{font-family:'DM Sans',sans-serif;}input:focus,textarea:focus,select:focus{outline:none;}::-webkit-scrollbar{display:none;}button{font-family:'DM Sans',sans-serif;cursor:pointer;}a{text-decoration:none;}`}</style>

      {toast&&<div style={{...S.toast,background:toast.type==="error"?"#9b2335":"#2d6a4f"}}>{toast.msg}</div>}

      {/* Note de séance modal */}
      {noteRdvId&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:50,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:"#fff",width:"100%",maxWidth:480,borderRadius:"20px 20px 0 0",padding:"20px 18px 40px"}}>
            <div style={{fontFamily:"'Cormorant Garamond'",fontSize:18,color:"#8b5e52",marginBottom:12}}>📝 Note de séance</div>
            <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} rows={5} placeholder="Produits utilisés, réactions, recommandations, observations..." style={{width:"100%",border:"1px solid #e8d5d0",borderRadius:10,padding:"10px 12px",fontSize:14,color:"#3a2a27",resize:"none",lineHeight:1.6}}/>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setNoteRdvId(null);setNoteText("");}} style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fff",color:"#8b5e52",fontSize:14}}>Annuler</button>
              <button onClick={()=>saveNoteSeance(noteRdvId,noteText)} style={{flex:2,padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:14,fontWeight:500}}>✓ Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {(view==="list"||view==="agenda"||view==="catalogue"||view==="stats"||view==="attente"||view==="settings")&&(
        <div style={S.bottomNav}>
          <button style={{...S.navBtn,color:view==="list"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("list")}><span style={S.navIcon}>👤</span><span style={S.navLabel}>Clients</span></button>
          <button style={{...S.navBtn,color:view==="agenda"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("agenda")}><span style={S.navIcon}>📅</span><span style={S.navLabel}>Agenda</span></button>
          <button style={{...S.navBtn,color:view==="catalogue"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("catalogue")}><span style={S.navIcon}>💆</span><span style={S.navLabel}>Soins</span></button>
          <button style={{...S.navBtn,color:view==="attente"?"#8b5e52":"#c9a79e",position:"relative"}} onClick={()=>setView("attente")}>
            <span style={S.navIcon}>⏳</span><span style={S.navLabel}>Attente</span>
            {attente.length>0&&<span style={{position:"absolute",top:6,right:"50%",transform:"translateX(8px)",background:"#9b2335",color:"#fff",fontSize:9,width:16,height:16,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>{attente.length}</span>}
          </button>
          <button style={{...S.navBtn,color:view==="stats"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("stats")}><span style={S.navIcon}>📊</span><span style={S.navLabel}>Stats</span></button>
          <button style={{...S.navBtn,color:view==="settings"?"#8b5e52":"#c9a79e"}} onClick={()=>setView("settings")}><span style={S.navIcon}>⚙️</span><span style={S.navLabel}>Réglages</span></button>
        </div>
      )}

      {/* ══ LIST ══ */}
      {view==="list"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Clients</h1></div>
            <button style={S.btnRound} onClick={()=>{setEditId(null);setForm({...EMPTY_FORM,dateVisite:toIso(new Date())});setView("form");}}>＋</button>
          </div>
          {/* Rappels J-1 */}
          {rdvsDemain.length>0&&(
            <div style={{margin:"8px 16px 4px",background:"#fff3cd",borderRadius:12,padding:"10px 14px",border:"1px solid #f0a500"}}>
              <div style={{fontSize:12,fontWeight:500,color:"#856404",marginBottom:6}}>🔔 Rappels à envoyer — RDV demain</div>
              {rdvsDemain.map(r=>{
                const client=clients.find(c=>c.id===r.clientId);
                const nom=client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client";
                return(
                  <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,color:"#3a2a27"}}>{nom} à {r.heure}</span>
                    <a href={buildWaLink(r,client,catalogue)} target="_blank" style={{background:"#25D366",color:"#fff",padding:"3px 10px",borderRadius:10,fontSize:12,fontWeight:500}}>📲 Rappel</a>
                  </div>
                );
              })}
            </div>
          )}
          {anniversaires.length>0&&(
            <div style={{margin:"6px 16px 4px",background:"#fff8f5",borderRadius:12,padding:"10px 14px",border:"1px solid #f0ddd8"}}>
              <div style={{fontSize:12,fontWeight:500,color:"#8b5e52",marginBottom:6}}>🎂 Anniversaire cette semaine</div>
              {anniversaires.map(c=><div key={c.id} style={{fontSize:13,color:"#3a2a27"}}>{c.prenom} {c.nom} — {c.dateNaissance}</div>)}
            </div>
          )}
          <div style={S.searchWrap}>
            <span style={{fontSize:14,marginRight:8,opacity:0.4}}>🔍</span>
            <input style={S.searchInput} placeholder="Nom, prénom ou téléphone..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button style={S.clearBtn} onClick={()=>setSearch("")}>✕</button>}
          </div>
          <div style={{padding:"0 16px 8px",display:"flex",gap:6,overflowX:"auto"}}>
            <button onClick={()=>setFilterSoin("")} style={{padding:"4px 12px",borderRadius:20,fontSize:12,border:filterSoin==""?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:filterSoin==""?"#8b5e52":"#fff",color:filterSoin==""?"#fff":"#8b5e52",whiteSpace:"nowrap",flexShrink:0}}>Tous</button>
            {catalogue.map(s=><button key={s.id} onClick={()=>setFilterSoin(filterSoin===s.id?"":s.id)} style={{padding:"4px 12px",borderRadius:20,fontSize:12,border:filterSoin===s.id?`1.5px solid ${s.couleur}`:"1px solid #e8d5d0",background:filterSoin===s.id?s.couleur:"#fff",color:filterSoin===s.id?"#fff":"#8b5e52",whiteSpace:"nowrap",flexShrink:0}}>{s.nom}</button>)}
          </div>
          {filtered.length===0?(
            <div style={S.empty}>{clients.length===0?<><div style={{fontSize:36,marginBottom:10}}>✦</div><div style={{fontFamily:"'Cormorant Garamond'",fontSize:20,color:"#b5938a"}}>Aucun client enregistré</div><div style={{fontSize:13,color:"#c9a79e",marginTop:6}}>Appuyez sur + pour commencer</div></>:<div style={{color:"#c9a79e"}}>Aucun résultat</div>}</div>
          ):(
            <div style={S.list}>
              {filtered.map(c=>{
                const badge=getBadge(c.seances||0);
                return(
                  <button key={c.id} style={S.card} onClick={()=>{setSelected(c);setView("detail");}}>
                    <div style={S.avatar}>{initials(c)}</div>
                    <div style={S.cardInfo}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <div style={S.cardName}>{c.prenom} {c.nom}</div>
                        {badge&&<span style={{fontSize:10,background:badge.bg,color:badge.color,padding:"1px 7px",borderRadius:10,fontWeight:500}}>{badge.label}</span>}
                        {isBirthdayThisWeek(c.dateNaissance)&&<span style={{fontSize:12}}>🎂</span>}
                      </div>
                      <div style={S.cardSub}>
                        {(c.seances||0)>0&&<span style={S.badgeGreen}>🌿 {c.seances} séance{c.seances>1?"s":""}</span>}
                        {c.telephone&&<span style={{color:"#b5938a",fontSize:12}}>{c.telephone}</span>}
                      </div>
                    </div>
                    <div style={S.cardDate}>{c.dateVisite||""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ DETAIL ══ */}
      {view==="detail"&&selected&&(()=>{
        const fc=clients.find(c=>c.id===selected.id)||selected;
        const clientRdvs=rdvs.filter(r=>r.clientId===fc.id).sort((a,b)=>b.date.localeCompare(a.date));
        const badge=getBadge(fc.seances||0);
        const milestones=[5,10,20];
        const nextMilestone=milestones.find(m=>m>(fc.seances||0));
        return(
          <div style={S.screen}>
            <div style={S.header}>
              <button style={S.backBtn} onClick={()=>setView("list")}>← Retour</button>
              <div style={{display:"flex",gap:8}}>
                <button style={S.btnSmall} onClick={()=>{setEditId(fc.id);setForm({...EMPTY_FORM,...fc});setView("form");}}>Modifier</button>
                <button style={{...S.btnSmall,background:"#fdecea",color:"#9b2335"}} onClick={()=>{if(window.confirm("Supprimer ?"))deleteClient(fc.id);}}>Supprimer</button>
              </div>
            </div>
            <div style={S.detailHero}>
              <div style={S.avatarLg}>{initials(fc)}</div>
              <h2 style={S.detailName}>{fc.prenom} {fc.nom}</h2>
              <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6,marginTop:6}}>
                {fc.typesPeau?.map(t=><span key={t} style={S.badge}>{t}</span>)}
                {badge&&<span style={{fontSize:11,background:badge.bg,color:badge.color,padding:"2px 10px",borderRadius:10,fontWeight:500}}>{badge.label}</span>}
                {isBirthdayThisWeek(fc.dateNaissance)&&<span style={{fontSize:11,background:"#fff3cd",color:"#856404",padding:"2px 10px",borderRadius:10}}>🎂 Anniversaire cette semaine !</span>}
              </div>
            </div>
            <div style={S.seanceBox}>
              <div style={S.seanceCount}><span style={S.seanceNum}>{fc.seances||0}</span><span style={S.seanceLabel}>séance{(fc.seances||0)!==1?"s":""}</span></div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {badge&&fc.telephone&&(
                  <a href={buildFideliteMsg(fc)} target="_blank" style={{padding:"6px 12px",borderRadius:16,background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:12,fontWeight:500}}>🎁 Fidélité</a>
                )}
                <button style={S.seanceBtn} onClick={()=>addSeance(fc.id)}>＋</button>
              </div>
            </div>
            {/* Barre de progression fidélité */}
            {nextMilestone&&(
              <div style={{padding:"8px 18px",background:"#fdf8f6",borderBottom:"1px solid #f0ddd8"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#b5938a",marginBottom:4}}>
                  <span>Progression vers {nextMilestone} séances</span>
                  <span>{fc.seances||0}/{nextMilestone}</span>
                </div>
                <div style={{height:6,background:"#f0ddd8",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"linear-gradient(90deg,#8b5e52,#c9896e)",borderRadius:3,width:`${Math.min(100,((fc.seances||0)/nextMilestone)*100)}%`,transition:"width 0.3s"}}/>
                </div>
              </div>
            )}
            <div style={S.detailBody}>
              {[["📞 Téléphone",fc.telephone],["✉️ Email",fc.email],["🎂 Date de naissance",fc.dateNaissance],["📅 Dernière visite",fc.dateVisite],["🌿 Allergies",fc.allergies],["💊 Traitements",fc.traitementsEnCours],["🛍 Produits utilisés",fc.produitsUtilises],["📝 Notes",fc.notes]].map(([l,v])=>v?<div key={l} style={S.detailRow}><div style={S.detailLabel}>{l}</div><div style={S.detailVal}>{v}</div></div>:null)}
              {fc.soins?.length>0&&<div style={S.detailRow}><div style={S.detailLabel}>💆 Soins habituels</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>{fc.soins.map(s=><span key={s} style={S.badgeGreen}>{catalogue.find(x=>x.id===s)?.nom||s}</span>)}</div></div>}
              {fc.problematiquesPeau?.length>0&&<div style={S.detailRow}><div style={S.detailLabel}>⚠️ Problématiques</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>{fc.problematiquesPeau.map(p=><span key={p} style={S.badgeDark}>{p}</span>)}</div></div>}
              <PhotoSection client={fc} onAdd={addPhoto} onDelete={deletePhoto}/>
              {clientRdvs.length>0&&(
                <div style={S.detailRow}>
                  <div style={S.detailLabel}>📋 Historique RDV</div>
                  {clientRdvs.map(r=>{
                    const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                    const soinsH=ids.map(id=>catalogue.find(s=>s.id===id)).filter(Boolean);
                    return(
                      <div key={r.id} style={{...S.rdvHistItem}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                              <span style={{fontWeight:500,color:"#3a2a27",fontSize:13}}>{r.date} à {r.heure}</span>
                              {r.effectue&&<span style={{fontSize:10,background:"#d8f0e7",color:"#2d6a4f",padding:"1px 7px",borderRadius:10}}>✓ Effectué</span>}
                            </div>
                            {soinsH.map(s=><div key={s.id} style={{fontSize:12,color:"#8b5e52",marginTop:1}}>{s.nom}</div>)}
                            {r.noteSeance&&<div style={{fontSize:11,color:"#3a2a27",background:"#fdf8f6",borderRadius:6,padding:"4px 8px",marginTop:4,border:"1px solid #f0ddd8"}}>📝 {r.noteSeance}</div>}
                          </div>
                          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                            {!r.effectue&&<button style={S.validerBtn} onClick={()=>validerRdv(r)}>✓</button>}
                            <button style={{...S.editRdvBtn,width:28,height:28,fontSize:12}} onClick={()=>{setNoteRdvId(r.id);setNoteText(r.noteSeance||"");}}>📝</button>
                            <a href={buildWaLink(r,fc,catalogue)} target="_blank" style={{...S.waBtn,width:28,height:28,fontSize:12}}>📲</a>
                            <button style={{...S.editRdvBtn,width:28,height:28}} onClick={()=>{setRdvForm({...r});setView("rdvForm");}}>✏️</button>
                            <button style={{...S.delRdvBtn,width:26,height:26}} onClick={()=>deleteRdv(r.id)}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button style={S.rdvCTA} onClick={()=>{setRdvForm({clientId:fc.id,date:toIso(new Date()),heure:"09:00",soins:[],note:""});setView("rdvForm");}}>
                📅 Prendre un RDV pour {fc.prenom}
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
            <Sect title="Type de peau"><div style={{fontSize:11,color:"#b5938a",marginBottom:8}}>Sélection multiple</div><Chips items={TYPES_PEAU} selected={form.typesPeau} onToggle={v=>toggle("typesPeau",v)}/></Sect>
            <Sect title="Problématiques"><Chips items={PROBLEMATIQUES} selected={form.problematiquesPeau} onToggle={v=>toggle("problematiquesPeau",v)}/></Sect>
            <Sect title="Soins habituels"><SoinsSelector selected={form.soins} onToggle={v=>toggle("soins",v)} catalogue={catalogue}/></Sect>
            <Sect title="Infos complémentaires">
              <Fld label="Allergies" value={form.allergies} onChange={v=>setForm(f=>({...f,allergies:v}))} multiline/>
              <Fld label="Traitements en cours" value={form.traitementsEnCours} onChange={v=>setForm(f=>({...f,traitementsEnCours:v}))} multiline/>
              <Fld label="Produits utilisés" value={form.produitsUtilises} onChange={v=>setForm(f=>({...f,produitsUtilises:v}))} multiline/>
              <Fld label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))} multiline/>
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
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {/* Toggle semaine/jour */}
              <div style={{display:"flex",background:"#f0ddd8",borderRadius:20,padding:2}}>
                <button onClick={()=>setAgendaMode("semaine")} style={{padding:"4px 10px",borderRadius:18,border:"none",background:agendaMode==="semaine"?"#8b5e52":"transparent",color:agendaMode==="semaine"?"#fff":"#8b5e52",fontSize:11,fontWeight:500}}>Sem.</button>
                <button onClick={()=>setAgendaMode("jour")} style={{padding:"4px 10px",borderRadius:18,border:"none",background:agendaMode==="jour"?"#8b5e52":"transparent",color:agendaMode==="jour"?"#fff":"#8b5e52",fontSize:11,fontWeight:500}}>Jour</button>
              </div>
              <button style={S.btnRound} onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:selDay,heure:"09:00",soins:[],note:""});setView("rdvForm");}}>＋</button>
            </div>
          </div>
          <div style={S.weekNav}>
            <button style={S.weekNavBtn} onClick={()=>{const nd=addDays(weekStart,-7);setWeekStart(nd);setSelDay(toIso(nd));}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:500,color:"#3a2a27"}}>{MOIS_COURT[weekStart.getMonth()]} {weekStart.getFullYear()}</div>
              <div style={{fontSize:11,color:"#b5938a"}}>{weekStart.getDate()} – {addDays(weekStart,6).getDate()} {MOIS_COURT[addDays(weekStart,6).getMonth()]}</div>
            </div>
            <button style={S.weekNavBtn} onClick={()=>{const nd=addDays(weekStart,7);setWeekStart(nd);setSelDay(toIso(nd));}}>›</button>
          </div>
          <div style={S.weekHeader}>
            {weekDays.map((d,i)=>{
              const iso=toIso(d);const today=isToday(iso);const sel=iso===selDay;
              const count=rdvs.filter(r=>r.date===iso).length;
              return(
                <button key={iso} onClick={()=>setSelDay(iso)} style={{...S.dayCol,background:sel?"#8b5e52":today?"#fdf0ec":"transparent",border:"none"}}>
                  <div style={{fontSize:9,color:sel?"#fff":today?"#8b5e52":"#c9a79e",textTransform:"uppercase",fontWeight:500}}>{["lun.","mar.","mer.","jeu.","ven.","sam.","dim."][i]}</div>
                  <div style={{...S.dayNum,background:sel?"rgba(255,255,255,0.25)":"transparent",color:sel?"#fff":today?"#8b5e52":"#3a2a27",fontWeight:sel?700:400}}>{d.getDate()}</div>
                  {count>0&&<div style={{width:5,height:5,borderRadius:3,background:sel?"#fff":"#8b5e52",marginTop:2}}/>}
                </button>
              );
            })}
          </div>

          {/* ── MODE SEMAINE ── */}
          {agendaMode==="semaine"&&(
            <div style={{padding:"8px 16px 20px"}}>
              <div style={S.dayLabel}>{isToday(selDay)?"Aujourd'hui — "+formatDateFR(selDay):formatDateFR(selDay)}</div>
              {(()=>{
                const rdvsDuJour=rdvs.filter(r=>r.date===selDay).sort((a,b)=>a.heure.localeCompare(b.heure));
                if(rdvsDuJour.length===0)return(<div style={{textAlign:"center",padding:"30px 0",color:"#c9a79e"}}><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontFamily:"'Cormorant Garamond'",fontSize:17,color:"#b5938a"}}>Aucun RDV ce jour</div><div style={{fontSize:12,marginTop:4}}>Appuyez sur + pour ajouter</div></div>);
                return rdvsDuJour.map(r=>{
                  const client=clients.find(c=>c.id===r.clientId);
                  const nom=client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client";
                  const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                  const soinsRdv=ids.map(id=>catalogue.find(s=>s.id===id)).filter(Boolean);
                  const color=soinColor(ids[0]);
                  return(
                    <div key={r.id} style={{...S.rdvCard,borderLeft:`3px solid ${color}`,opacity:r.effectue?0.65:1}}>
                      <div style={{...S.rdvHeure,color}}>{r.heure}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <button onClick={()=>{if(client){setSelected(client);setView("detail");}}} style={{background:"none",border:"none",padding:0,cursor:client?"pointer":"default"}}>
                            <div style={{...S.rdvNom,color:client?"#8b5e52":"#3a2a27",textDecoration:client?"underline":"none",textDecorationStyle:"dotted"}}>{nom}</div>
                          </button>
                          {r.effectue&&<span style={{fontSize:10,background:"#d8f0e7",color:"#2d6a4f",padding:"1px 6px",borderRadius:8}}>✓</span>}
                        </div>
                        {soinsRdv.map(s=><div key={s.id} style={{fontSize:12,color:"#8b5e52",marginTop:1}}>{s.nom} · {s.duree}</div>)}
                        {r.noteSeance&&<div style={{fontSize:11,color:"#c9a79e",marginTop:2}}>📝 {r.noteSeance.substring(0,40)}{r.noteSeance.length>40?"...":""}</div>}
                      </div>
                      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                        {!r.effectue&&<button style={S.validerBtn} onClick={()=>validerRdv(r)}>✓</button>}
                        <button style={{...S.editRdvBtn,width:28,height:28,fontSize:12}} onClick={()=>{setNoteRdvId(r.id);setNoteText(r.noteSeance||"");}}>📝</button>
                        <a href={buildWaLink(r,client,catalogue)} target="_blank" style={{...S.waBtn,width:28,height:28,fontSize:12}}>📲</a>
                        <button style={{...S.editRdvBtn,width:28,height:28}} onClick={()=>{setRdvForm({...r});setView("rdvForm");}}>✏️</button>
                        <button style={{...S.delRdvBtn,width:26,height:26}} onClick={()=>deleteRdv(r.id)}>✕</button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ── MODE JOUR (vue créneaux) ── */}
          {agendaMode==="jour"&&(
            <div style={{overflowY:"auto",padding:"8px 16px 80px"}}>
              <div style={S.dayLabel}>{isToday(selDay)?"Aujourd'hui — "+formatDateFR(selDay):formatDateFR(selDay)}</div>
              {CRENEAUX.map(creneau=>{
                const rdvsCreneau=rdvs.filter(r=>r.date===selDay&&r.heure===creneau);
                const isCurrentHour=isToday(selDay)&&creneau===`${String(now.getHours()).padStart(2,"0")}:${now.getMinutes()<30?"00":"30"}`;
                return(
                  <div key={creneau} style={{display:"flex",gap:10,marginBottom:2,alignItems:"flex-start"}}>
                    <div style={{width:40,fontSize:11,color:isCurrentHour?"#8b5e52":"#c9a79e",fontWeight:isCurrentHour?600:400,paddingTop:8,flexShrink:0,textAlign:"right"}}>{creneau}</div>
                    <div style={{flex:1,borderTop:`1px solid ${isCurrentHour?"#8b5e52":"#f0ddd8"}`,paddingTop:4,minHeight:36}}>
                      {rdvsCreneau.length===0?(
                        <button onClick={()=>{setRdvForm({clientId:"",nomLibre:"",tel:"",date:selDay,heure:creneau,soins:[],note:""});setView("rdvForm");}} style={{width:"100%",height:32,background:"transparent",border:"none",color:"transparent",cursor:"pointer"}}>+</button>
                      ):rdvsCreneau.map(r=>{
                        const client=clients.find(c=>c.id===r.clientId);
                        const nom=client?`${client.prenom} ${client.nom}`:r.nomLibre||"Client";
                        const ids=r.soins?.length?r.soins:(r.soin?[r.soin]:[]);
                        const color=soinColor(ids[0]);
                        const soin=catalogue.find(s=>s.id===ids[0]);
                        return(
                          <div key={r.id} style={{background:`${color}22`,borderLeft:`3px solid ${color}`,borderRadius:"0 8px 8px 0",padding:"6px 10px",marginBottom:4,opacity:r.effectue?0.6:1}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <div>
                                <button onClick={()=>{if(client){setSelected(client);setView("detail");}}} style={{background:"none",border:"none",padding:0,cursor:client?"pointer":"default"}}>
                                  <div style={{fontSize:13,fontWeight:600,color:color}}>{nom}</div>
                                </button>
                                {soin&&<div style={{fontSize:11,color:"#8b5e52"}}>{soin.nom}</div>}
                              </div>
                              <div style={{display:"flex",gap:3}}>
                                {!r.effectue&&<button style={{...S.validerBtn,width:24,height:24,fontSize:12}} onClick={()=>validerRdv(r)}>✓</button>}
                                <a href={buildWaLink(r,client,catalogue)} target="_blank" style={{...S.waBtn,width:24,height:24,fontSize:11}}>📲</a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ CATALOGUE ══ */}
      {view==="catalogue"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Soins</h1></div>
            <button style={S.btnRound} onClick={()=>{setSoinForm({...EMPTY_SOIN});setView("soinForm");}}>＋</button>
          </div>
          <div style={{padding:"8px 16px 20px"}}>
            {CATEGORIES.map(cat=>{
              const items=catalogue.filter(s=>s.categorie===cat);
              if(items.length===0)return null;
              return(
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:"#c9a79e",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{cat}</div>
                  {items.map(s=>(
                    <div key={s.id} style={{...S.rdvCard,borderLeft:`3px solid ${s.couleur||"#8b5e52"}`}}>
                      <div style={{flex:1}}><div style={{fontSize:15,fontWeight:500,color:"#3a2a27"}}>{s.nom}</div><div style={{fontSize:12,color:"#b5938a",marginTop:2}}>{s.duree} · {s.prix}</div></div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={S.editRdvBtn} onClick={()=>{setSoinForm({...s});setView("soinForm");}}>✏️</button>
                        <button style={S.delRdvBtn} onClick={()=>{if(window.confirm("Supprimer ?"))deleteSoin(s.id);}}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ FORM SOIN ══ */}
      {view==="soinForm"&&soinForm&&(
        <div style={S.screen}>
          <div style={S.header}>
            <button style={S.backBtn} onClick={()=>{setView("catalogue");setSoinForm(null);}}>← Annuler</button>
            <div style={S.brandTag}>{soinForm.id?"Modifier":"Nouveau soin"}</div>
          </div>
          <div style={S.formBody}>
            <Sect title="Informations">
              <Fld label="Nom du soin *" value={soinForm.nom} onChange={v=>setSoinForm(f=>({...f,nom:v}))}/>
              <TwoCol>
                <Fld label="Durée" value={soinForm.duree} onChange={v=>setSoinForm(f=>({...f,duree:v}))}/>
                <Fld label="Prix" value={soinForm.prix} onChange={v=>setSoinForm(f=>({...f,prix:v}))}/>
              </TwoCol>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:5}}>Catégorie</div>
                <select value={soinForm.categorie} onChange={e=>setSoinForm(f=>({...f,categorie:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:15,color:"#3a2a27"}}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </Sect>
            <Sect title="Couleur dans l'agenda">
              <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                {PALETTE.map(c=><button key={c} onClick={()=>setSoinForm(f=>({...f,couleur:c}))} style={{width:32,height:32,borderRadius:16,background:c,border:soinForm.couleur===c?"3px solid #3a2a27":"2px solid transparent"}}/>)}
              </div>
            </Sect>
            <button style={{...S.saveBtn,opacity:soinForm.nom?.trim()?1:0.5}} disabled={!soinForm.nom?.trim()} onClick={()=>saveSoin(soinForm)}>{soinForm.id?"✓ Mettre à jour":"✓ Ajouter"}</button>
            <div style={{height:50}}/>
          </div>
        </div>
      )}

      {/* ══ LISTE D'ATTENTE ══ */}
      {view==="attente"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Liste d'attente</h1></div>
          </div>
          <div style={{padding:"8px 16px 20px"}}>
            {/* Ajouter à l'attente */}
            <AttenteForm clients={clients} catalogue={catalogue} onAdd={addAttente}/>
            {attente.length===0?(
              <div style={{textAlign:"center",padding:"30px 0",color:"#c9a79e"}}>
                <div style={{fontSize:28,marginBottom:8}}>⏳</div>
                <div style={{fontFamily:"'Cormorant Garamond'",fontSize:17,color:"#b5938a"}}>Aucune cliente en attente</div>
              </div>
            ):(
              attente.map(a=>{
                const client=clients.find(c=>c.id===a.clientId);
                const nom=client?`${client.prenom} ${client.nom}`:a.nomLibre||"Client";
                const soin=catalogue.find(s=>s.id===a.soinId);
                return(
                  <div key={a.id} style={{...S.rdvCard,borderLeft:"3px solid #f0a500"}}>
                    <div style={{flex:1}}>
                      <button onClick={()=>{if(client){setSelected(client);setView("detail");}}} style={{background:"none",border:"none",padding:0,cursor:client?"pointer":"default",textAlign:"left"}}>
                        <div style={{fontSize:15,fontWeight:500,color:client?"#8b5e52":"#3a2a27",textDecoration:client?"underline":"none",textDecorationStyle:"dotted"}}>{nom}</div>
                      </button>
                      {soin&&<div style={{fontSize:12,color:"#8b5e52",marginTop:2}}>{soin.nom}</div>}
                      {a.note&&<div style={{fontSize:11,color:"#c9a79e",marginTop:2}}>{a.note}</div>}
                      <div style={{fontSize:10,color:"#c9a79e",marginTop:2}}>Ajoutée le {a.date}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setRdvForm({clientId:a.clientId||"",nomLibre:a.nomLibre||"",tel:a.tel||"",date:toIso(new Date()),heure:"09:00",soins:a.soinId?[a.soinId]:[],note:""});removeAttente(a.id);setView("rdvForm");}} style={{padding:"5px 10px",borderRadius:10,border:"none",background:"#d8f0e7",color:"#2d6a4f",fontSize:12,fontWeight:500}}>→ RDV</button>
                      <button style={S.delRdvBtn} onClick={()=>removeAttente(a.id)}>✕</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══ STATS ══ */}
      {view==="stats"&&(
        <div style={{...S.screen,paddingBottom:70}}>
          <div style={S.header}>
            <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Statistiques</h1></div>
          </div>
          <div style={{padding:"16px"}}>
            <div style={{fontSize:12,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:12,textTransform:"uppercase"}}>{MOIS[now.getMonth()]} {now.getFullYear()}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <StatCard label="Séances ce mois" value={rdvsMois.length} icon="💆"/>
              <StatCard label="Revenus estimés" value={revenus.toLocaleString()+" F"} icon="💰"/>
              <StatCard label="Clientes total" value={clients.length} icon="👤"/>
              <StatCard label="En attente" value={attente.length} icon="⏳"/>
            </div>
            <div style={{background:"#fff",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8",marginBottom:12}}>
              <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>🏆 SOIN LE PLUS POPULAIRE</div>
              <div style={{fontSize:18,fontFamily:"'Cormorant Garamond'",color:"#3a2a27",fontWeight:600}}>{topSoinNom}</div>
              {topSoin&&<div style={{fontSize:12,color:"#c9a79e",marginTop:3}}>{topSoin[1]} séance{topSoin[1]>1?"s":""} au total</div>}
            </div>
            <div style={{background:"#fff",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8",marginBottom:12}}>
              <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>⭐ CLIENTES FIDÈLES</div>
              {clients.filter(c=>(c.seances||0)>=5).length===0?<div style={{color:"#c9a79e",fontSize:13}}>Aucune encore</div>:
                clients.filter(c=>(c.seances||0)>=5).sort((a,b)=>(b.seances||0)-(a.seances||0)).map(c=>{
                  const badge=getBadge(c.seances||0);
                  return(
                    <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f5ede9"}}>
                      <button onClick={()=>{setSelected(c);setView("detail");}} style={{background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:14,color:"#8b5e52",textDecoration:"underline",textDecorationStyle:"dotted"}}>{c.prenom} {c.nom}</span>
                      </button>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:11,background:badge.bg,color:badge.color,padding:"1px 8px",borderRadius:10}}>{badge.label}</span>
                        <a href={buildFideliteMsg(c)} target="_blank" style={{fontSize:11,background:"#d8f0e7",color:"#2d6a4f",padding:"1px 8px",borderRadius:10}}>🎁</a>
                      </div>
                    </div>
                  );
                })
              }
            </div>
            {anniversaires.length>0&&(
              <div style={{background:"#fff8f5",borderRadius:14,padding:"14px",border:"1px solid #f0ddd8"}}>
                <div style={{fontSize:11,color:"#b5938a",fontWeight:500,marginBottom:8}}>🎂 ANNIVERSAIRES CETTE SEMAINE</div>
                {anniversaires.map(c=>(
                  <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                    <span style={{fontSize:14,color:"#3a2a27"}}>{c.prenom} {c.nom}</span>
                    <span style={{fontSize:12,color:"#c9a79e"}}>{c.dateNaissance}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ SETTINGS ══ */}
      {view==="settings"&&(
        <SettingsView savedPin={savedPin} setSavedPin={(np)=>{setSavedPin(np);svPin({pin:np});}} showToast={showToast} setView={setView}/>
      )}

      {/* ══ FORM RDV ══ */}
      {view==="rdvForm"&&rdvForm!=null&&(
        <RdvFormView rdvForm={rdvForm} clients={clients} catalogue={catalogue} onSave={saveRdv}
          onBack={()=>{if(selected&&rdvForm.clientId===selected.id)setView("detail");else setView("agenda");setRdvForm(null);}}/>
      )}
    </div>
  );
}

// ── ATTENTE FORM ──────────────────────────────────────────────────
function AttenteForm({clients,catalogue,onAdd}){
  const [open,setOpen]=useState(false);
  const [f,setF]=useState({clientId:"",nomLibre:"",tel:"",soinId:"",note:""});
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"11px",borderRadius:12,border:"1px dashed #c9a79e",background:"#fdf8f6",color:"#8b5e52",fontSize:14,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      ＋ Ajouter à la liste d'attente
    </button>
  );
  return(
    <div style={{background:"#fff",borderRadius:12,border:"1px solid #e8d5d0",padding:"14px",marginBottom:14}}>
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:"#b5938a",marginBottom:4,fontWeight:500}}>Cliente existante</div>
        <select value={f.clientId} onChange={e=>setF(p=>({...p,clientId:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:14,color:"#3a2a27"}}>
          <option value="">— Sélectionner —</option>
          {[...clients].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
        </select>
      </div>
      {!f.clientId&&<Fld label="Ou nom libre" value={f.nomLibre} onChange={v=>setF(p=>({...p,nomLibre:v}))}/>}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,color:"#b5938a",marginBottom:4,fontWeight:500}}>Soin souhaité</div>
        <select value={f.soinId} onChange={e=>setF(p=>({...p,soinId:e.target.value}))} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:14,color:"#3a2a27"}}>
          <option value="">— Sélectionner —</option>
          {catalogue.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>
      <Fld label="Note (disponibilité, préférence...)" value={f.note} onChange={v=>setF(p=>({...p,note:v}))} multiline/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>setOpen(false)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fff",color:"#8b5e52",fontSize:13}}>Annuler</button>
        <button onClick={()=>{if(!f.clientId&&!f.nomLibre.trim())return;onAdd(f);setOpen(false);setF({clientId:"",nomLibre:"",tel:"",soinId:"",note:""});}} style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:13,fontWeight:500}}>✓ Ajouter</button>
      </div>
    </div>
  );
}

// ── PHOTOS ────────────────────────────────────────────────────────
function PhotoSection({client,onAdd,onDelete}){
  const fileRef=useRef();
  const [label,setLabel]=useState("Avant");
  const [preview,setPreview]=useState(null);
  const handleFile=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>setPreview(ev.target.result);
    reader.readAsDataURL(file);e.target.value="";
  };
  return(
    <div style={S.detailRow}>
      <div style={S.detailLabel}>📸 Suivi photos</div>
      {(client.photos||[]).length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,marginTop:4}}>
          {(client.photos||[]).map(p=>(
            <div key={p.id} style={{position:"relative",width:80}}>
              <img src={p.url} alt={p.label} style={{width:80,height:80,objectFit:"cover",borderRadius:10,border:"1px solid #f0ddd8"}}/>
              <div style={{fontSize:10,color:"#8b5e52",textAlign:"center",marginTop:2}}>{p.label}</div>
              <div style={{fontSize:10,color:"#c9a79e",textAlign:"center"}}>{p.date}</div>
              <button onClick={()=>onDelete(client.id,p.id)} style={{position:"absolute",top:2,right:2,width:18,height:18,borderRadius:9,border:"none",background:"rgba(155,35,53,0.85)",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {preview&&(
        <div style={{marginBottom:10}}>
          <img src={preview} alt="preview" style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:10,marginBottom:8}}/>
          <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
            {["Avant","Après","Pendant","Résultat"].map(l=>(
              <button key={l} onClick={()=>setLabel(l)} style={{padding:"4px 10px",borderRadius:20,fontSize:12,border:label===l?"1.5px solid #8b5e52":"1px solid #e8d5d0",background:label===l?"#8b5e52":"#fff",color:label===l?"#fff":"#8b5e52"}}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setPreview(null)} style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fff",color:"#8b5e52",fontSize:13}}>Annuler</button>
            <button onClick={()=>{onAdd(client.id,preview,label);setPreview(null);setLabel("Avant");}} style={{flex:2,padding:"8px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",fontSize:13,fontWeight:500}}>✓ Enregistrer</button>
          </div>
        </div>
      )}
      {!preview&&<button onClick={()=>fileRef.current.click()} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:10,border:"1px dashed #c9a79e",background:"#fdf8f6",color:"#8b5e52",fontSize:13,width:"100%",justifyContent:"center"}}>📷 Ajouter une photo</button>}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile}/>
    </div>
  );
}

// ── SETTINGS ─────────────────────────────────────────────────────
function SettingsView({savedPin,setSavedPin,showToast,setView}){
  const [step,setStep]=useState("menu"); // menu | verify | newpin | confirm
  const [oldPin,setOldPin]=useState("");
  const [newPin,setNewPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [error,setError]=useState("");

  const reset=()=>{setStep("menu");setOldPin("");setNewPin("");setConfirmPin("");setError("");};

  const PinInput=({value,setValue,label,onComplete})=>{
    useEffect(()=>{if(value.length===4&&onComplete)onComplete(value);},[value]);
    const digits=["1","2","3","4","5","6","7","8","9","","0","⌫"];
    return(
      <div>
        <div style={{fontSize:13,color:"#8b5e52",textAlign:"center",marginBottom:16,fontWeight:500}}>{label}</div>
        <div style={{display:"flex",gap:14,justifyContent:"center",marginBottom:24}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<value.length?"#8b5e52":"#e8d5d0"}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
          {digits.map((d,i)=>(
            <button key={i} onClick={()=>{
              if(d==="")return;
              if(d==="⌫"){setValue(p=>p.slice(0,-1));return;}
              if(value.length<4)setValue(p=>p+d);
            }} style={{height:56,borderRadius:14,border:"1px solid #f0ddd8",background:d===""?"transparent":"#fff",fontSize:20,color:"#3a2a27",cursor:d===""?"default":"pointer"}}>
              {d}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return(
    <div style={S.screen}>
      <div style={S.header}>
        <div><div style={S.brandTag}>K's Beauty Studio</div><h1 style={S.title}>Réglages</h1></div>
      </div>
      <div style={{padding:"20px 18px"}}>

        {step==="menu"&&(
          <div>
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #f0ddd8",overflow:"hidden",marginBottom:16}}>
              <div style={{padding:"14px 16px",borderBottom:"1px solid #f5ede9"}}>
                <div style={{fontSize:12,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:2}}>CODE PIN ACTUEL</div>
                <div style={{fontSize:15,color:"#3a2a27",letterSpacing:4}}>{"●".repeat(savedPin.length)}</div>
              </div>
              <button onClick={()=>{setStep("verify");setOldPin("");}} style={{width:"100%",padding:"14px 16px",border:"none",background:"#fff",textAlign:"left",fontSize:15,color:"#8b5e52",fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                🔐 Changer le code PIN <span style={{color:"#c9a79e"}}>›</span>
              </button>
            </div>
            <div style={{background:"#fff",borderRadius:14,border:"1px solid #f0ddd8",padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:12,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:8}}>À PROPOS</div>
              <div style={{fontSize:14,color:"#3a2a27",lineHeight:1.7}}>
                K's Beauty Studio v2.0<br/>
                <span style={{color:"#c9a79e",fontSize:12}}>by K's Make Up Addict — Abidjan</span>
              </div>
            </div>
          </div>
        )}

        {step==="verify"&&(
          <div style={{textAlign:"center",paddingTop:20}}>
            <div style={{fontSize:14,color:"#c9a79e",marginBottom:20}}>Entre ton code PIN actuel pour continuer</div>
            <PinInput value={oldPin} setValue={setOldPin} label="Code actuel" onComplete={(v)=>{
              if(v===savedPin){setStep("newpin");setOldPin("");}
              else{setError("Code incorrect");setTimeout(()=>{setOldPin("");setError("");},800);}
            }}/>
            {error&&<div style={{color:"#9b2335",fontSize:13,marginTop:16}}>{error}</div>}
            <button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button>
          </div>
        )}

        {step==="newpin"&&(
          <div style={{textAlign:"center",paddingTop:20}}>
            <div style={{fontSize:14,color:"#c9a79e",marginBottom:20}}>Choisis ton nouveau code à 4 chiffres</div>
            <PinInput value={newPin} setValue={setNewPin} label="Nouveau code" onComplete={()=>setTimeout(()=>setStep("confirm"),300)}/>
            <button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button>
          </div>
        )}

        {step==="confirm"&&(
          <div style={{textAlign:"center",paddingTop:20}}>
            <div style={{fontSize:14,color:"#c9a79e",marginBottom:20}}>Confirme ton nouveau code</div>
            <PinInput value={confirmPin} setValue={setConfirmPin} label="Confirmer le code" onComplete={(v)=>{
              if(v===newPin){setSavedPin(newPin);showToast("Code PIN modifié ✓");reset();setView("list");}
              else{setError("Les codes ne correspondent pas");setTimeout(()=>{setConfirmPin("");setError("");},800);}
            }}/>
            {error&&<div style={{color:"#9b2335",fontSize:13,marginTop:16}}>{error}</div>}
            <button onClick={reset} style={{marginTop:24,color:"#b5938a",background:"none",border:"none",fontSize:14,cursor:"pointer"}}>Annuler</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RDV FORM ──────────────────────────────────────────────────────
function RdvFormView({rdvForm,clients,catalogue,onSave,onBack}){
  const [f,setF]=useState({...rdvForm,soins:rdvForm.soins?.length?rdvForm.soins:(rdvForm.soin?[rdvForm.soin]:[])});
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
            <div style={{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:5}}>Cliente existante</div>
            <select value={f.clientId||""} onChange={e=>set("clientId",e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #e8d5d0",background:"#fdf8f6",fontSize:15,color:"#3a2a27"}}>
              <option value="">— Sélectionner —</option>
              {[...clients].sort((a,b)=>a.nom.localeCompare(b.nom)).map(c=><option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
            </select>
          </div>
          {!f.clientId&&(
            <div>
              <div style={{fontSize:11,color:"#2d6a4f",background:"#d8f0e7",borderRadius:8,padding:"6px 10px",marginBottom:10}}>💡 Une fiche client sera créée automatiquement</div>
              <Fld label="Nom complet (Prénom Nom)" value={f.nomLibre||""} onChange={v=>set("nomLibre",v)}/>
              <Fld label="Téléphone WhatsApp" value={f.tel||""} onChange={v=>set("tel",v)} type="tel"/>
            </div>
          )}
        </Sect>
        <Sect title="Date & heure"><TwoCol><Fld label="Date" value={f.date} onChange={v=>set("date",v)} type="date"/><Fld label="Heure" value={f.heure} onChange={v=>set("heure",v)} type="time"/></TwoCol></Sect>
        <Sect title="Soins & prestations"><div style={{fontSize:11,color:"#b5938a",marginBottom:10}}>Sélection multiple possible</div><SoinsSelector selected={f.soins||[]} onToggle={toggleSoin} catalogue={catalogue}/></Sect>
        <Sect title="Note (optionnel)"><Fld label="" value={f.note||""} onChange={v=>set("note",v)} multiline/></Sect>
        <button style={{...S.saveBtn,opacity:valid?1:0.5}} disabled={!valid} onClick={()=>onSave(f)}>{isEdit?"✓ Modifier le RDV":"✓ Confirmer le RDV"}</button>
        <div style={{height:50}}/>
      </div>
    </div>
  );
}

// ── COMPOSANTS ────────────────────────────────────────────────────
function StatCard({label,value,icon}){
  return(
    <div style={{background:"#fff",borderRadius:12,padding:"14px",border:"1px solid #f0ddd8",textAlign:"center"}}>
      <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
      <div style={{fontSize:20,fontFamily:"'Cormorant Garamond'",color:"#3a2a27",fontWeight:600}}>{value}</div>
      <div style={{fontSize:11,color:"#b5938a",marginTop:2}}>{label}</div>
    </div>
  );
}
function SoinsSelector({selected,onToggle,catalogue}){
  return(
    <div>
      {CATEGORIES.map(cat=>{
        const items=catalogue.filter(s=>s.categorie===cat);
        if(items.length===0)return null;
        return(
          <div key={cat} style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#c9a79e",letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:500}}>{cat}</div>
            {items.map(s=>{
              const active=selected.includes(s.id);const color=s.couleur||"#8b5e52";
              return(
                <button key={s.id} onClick={()=>onToggle(s.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",marginBottom:7,borderRadius:12,border:active?`1.5px solid ${color}`:"1px solid #e8d5d0",background:active?`${color}18`:"#fff",textAlign:"left"}}>
                  <div><div style={{fontSize:14,fontWeight:active?600:400,color:active?color:"#3a2a27"}}>{s.nom}</div><div style={{fontSize:11,color:"#b5938a",marginTop:1}}>{s.duree}</div></div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:600,color:active?color:"#8b5e52"}}>{s.prix}</span>{active&&<span style={{color,fontSize:16}}>✓</span>}</div>
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
  searchWrap:{display:"flex",alignItems:"center",margin:"8px 16px 6px",background:"#fff",borderRadius:12,border:"1px solid #e8d5d0",padding:"0 12px"},
  searchInput:{flex:1,border:"none",background:"none",padding:"10px 0",fontSize:15,color:"#3a2a27"},
  clearBtn:{background:"none",border:"none",color:"#b5938a",fontSize:14,padding:"0 4px"},
  list:{padding:"6px 16px 20px",display:"flex",flexDirection:"column",gap:10},
  card:{display:"flex",alignItems:"center",background:"#fff",borderRadius:14,padding:"12px",border:"1px solid #f0ddd8",textAlign:"left",width:"100%",gap:10},
  avatar:{width:44,height:44,borderRadius:22,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontFamily:"'Cormorant Garamond'",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  avatarLg:{width:68,height:68,borderRadius:34,background:"linear-gradient(135deg,#e8c4bb,#c9896e)",color:"#fff",fontFamily:"'Cormorant Garamond'",fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"},
  cardInfo:{flex:1,minWidth:0},
  cardName:{fontSize:15,fontWeight:500,color:"#3a2a27",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
  cardSub:{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"},
  cardDate:{fontSize:11,color:"#c9a79e",flexShrink:0},
  badge:{background:"#fdecea",color:"#8b5e52",fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:500},
  badgeDark:{background:"#f0ddd8",color:"#6b3f35",fontSize:12,padding:"3px 10px",borderRadius:10},
  badgeGreen:{background:"#d8f0e7",color:"#2d6a4f",fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:500},
  empty:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:40,textAlign:"center",minHeight:200},
  detailHero:{padding:"20px 20px 14px",textAlign:"center",borderBottom:"1px solid #f0ddd8"},
  detailName:{fontFamily:"'Cormorant Garamond'",fontSize:26,color:"#3a2a27",margin:"0 0 6px",fontWeight:600},
  detailBody:{padding:"8px 18px 40px"},
  detailRow:{marginBottom:14,paddingBottom:12,borderBottom:"1px solid #f5ede9"},
  detailLabel:{fontSize:11,color:"#b5938a",fontWeight:500,letterSpacing:0.5,marginBottom:4},
  detailVal:{fontSize:15,color:"#3a2a27",lineHeight:1.5},
  seanceBox:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",background:"#fff8f5",borderBottom:"1px solid #f0ddd8"},
  seanceCount:{display:"flex",alignItems:"baseline",gap:6},
  seanceNum:{fontFamily:"'Cormorant Garamond'",fontSize:36,color:"#8b5e52",fontWeight:600,lineHeight:1},
  seanceLabel:{fontSize:13,color:"#b5938a"},
  seanceBtn:{padding:"7px 14px",borderRadius:20,border:"1.5px solid #8b5e52",background:"#fff",color:"#8b5e52",fontSize:13,fontWeight:500},
  rdvHistItem:{padding:"8px 0",borderBottom:"1px solid #fdecea"},
  rdvCTA:{width:"100%",padding:"13px",borderRadius:14,background:"linear-gradient(135deg,#2d6a4f,#52b788)",color:"#fff",border:"none",fontSize:15,fontWeight:500,marginTop:12},
  weekNav:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 18px 6px"},
  weekNavBtn:{background:"none",border:"1px solid #e8d5d0",borderRadius:20,width:30,height:30,fontSize:17,color:"#8b5e52",display:"flex",alignItems:"center",justifyContent:"center"},
  weekHeader:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,padding:"4px 10px 0",borderBottom:"1px solid #f0ddd8"},
  dayCol:{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 2px 7px",borderRadius:10},
  dayNum:{width:26,height:26,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,marginTop:3},
  dayLabel:{fontSize:12,fontWeight:600,color:"#8b5e52",letterSpacing:0.5,marginBottom:8,marginTop:4},
  rdvCard:{display:"flex",alignItems:"center",background:"#fff",borderRadius:12,padding:"11px",border:"1px solid #f0ddd8",gap:8,marginBottom:8},
  rdvHeure:{fontFamily:"'Cormorant Garamond'",fontSize:19,fontWeight:600,flexShrink:0,minWidth:46,lineHeight:1.2},
  rdvNom:{fontSize:14,fontWeight:500,color:"#3a2a27"},
  validerBtn:{width:30,height:30,borderRadius:15,border:"none",background:"#d8f0e7",color:"#2d6a4f",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  waBtn:{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:15,background:"#25D366",fontSize:13,flexShrink:0},
  editRdvBtn:{width:30,height:30,borderRadius:15,border:"none",background:"#f0ddd8",color:"#8b5e52",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  delRdvBtn:{width:28,height:28,borderRadius:14,border:"none",background:"#fdecea",color:"#9b2335",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  formBody:{padding:"16px 18px",overflowY:"auto",flex:1},
  saveBtn:{width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#8b5e52,#c9896e)",color:"#fff",border:"none",fontSize:16,fontWeight:500,marginTop:8},
  toast:{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",color:"#fff",padding:"10px 22px",borderRadius:20,fontSize:14,zIndex:100,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.18)"},
  bottomNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #f0ddd8",display:"flex",zIndex:20},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0 12px",background:"none",border:"none",position:"relative"},
  navIcon:{fontSize:18},
  navLabel:{fontSize:10,marginTop:2,fontWeight:500},
};

